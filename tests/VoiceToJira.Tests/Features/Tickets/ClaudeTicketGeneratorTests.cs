using System.Net;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using VoiceToJira.Api.Features.Tickets;

namespace VoiceToJira.Tests.Features.Tickets;

public sealed class ClaudeTicketGeneratorTests
{
    private const string BugJson = """
        {"type":"Bug","bug":{"title":"Avatar reverts after refresh","description":"A new profile picture is lost after reload.",
        "stepsToReproduce":["Upload a profile picture","Refresh the page"],"actualResult":"The old picture is shown.",
        "expectedResult":"","environment":"Firefox"},"feature":null}
        """;

    private readonly StubHandler handler = new();

    [Fact]
    public async Task Valid_answer_becomes_a_ticket_with_missing_information()
    {
        handler.Respond(MessageJson(BugJson, "end_turn"));

        var ticket = await CreateGenerator().GenerateAsync("my transcript", TestContext.Current.CancellationToken);

        var bug = ticket.Should().BeOfType<BugTicket>().Subject;
        bug.Environment.Should().Be("Firefox");
        bug.MissingInformation.Should().Equal("expectedResult");
    }

    [Fact]
    public async Task Request_uses_configured_model_structured_output_and_refusal_fallback()
    {
        handler.Respond(MessageJson(BugJson, "end_turn"));

        await CreateGenerator().GenerateAsync("my transcript", TestContext.Current.CancellationToken);

        using var body = JsonDocument.Parse(handler.LastBody!);
        var root = body.RootElement;
        root.GetProperty("model").GetString().Should().Be("claude-test-model");
        root.GetProperty("max_tokens").GetInt32().Should().Be(4096);
        root.GetProperty("fallbacks").GetString().Should().Be("default");
        root.GetProperty("output_config").GetProperty("effort").GetString().Should().Be("medium");
        root.GetProperty("output_config").GetProperty("format").GetProperty("type").GetString().Should().Be("json_schema");
        root.GetProperty("system").GetString().Should().Be(TicketPrompt.System);
        root.GetProperty("messages")[0].GetProperty("content").GetString().Should().Contain("my transcript");
        handler.LastBetaHeader.Should().Contain("server-side-fallback-2026-07-01");
    }

    [Theory]
    [InlineData("refusal", TicketGenerationError.Refused)]
    [InlineData("max_tokens", TicketGenerationError.Truncated)]
    public async Task Stop_reason_is_checked_before_parsing(string stopReason, TicketGenerationError expected)
    {
        handler.Respond(MessageJson("{\"type\":", stopReason));

        var act = () => CreateGenerator().GenerateAsync("t", TestContext.Current.CancellationToken);

        (await act.Should().ThrowAsync<TicketGenerationException>()).Which.Error.Should().Be(expected);
    }

    [Theory]
    [InlineData("not json")]
    [InlineData("""{"type":"Feature","bug":null,"feature":null}""")]
    public async Task Malformed_or_contract_breaking_output_is_invalid(string text)
    {
        handler.Respond(MessageJson(text, "end_turn"));

        var act = () => CreateGenerator().GenerateAsync("t", TestContext.Current.CancellationToken);

        (await act.Should().ThrowAsync<TicketGenerationException>()).Which.Error.Should().Be(TicketGenerationError.InvalidOutput);
    }

    [Fact]
    public async Task Api_error_is_reported_as_unavailable()
    {
        handler.Respond("""{"type":"error","error":{"type":"api_error","message":"boom"}}""", HttpStatusCode.InternalServerError);

        var act = () => CreateGenerator().GenerateAsync("t", TestContext.Current.CancellationToken);

        (await act.Should().ThrowAsync<TicketGenerationException>()).Which.Error.Should().Be(TicketGenerationError.Unavailable);
    }

    [Fact]
    public async Task Missing_api_key_fails_without_calling_claude()
    {
        var act = () => CreateGenerator(apiKey: "").GenerateAsync("t", TestContext.Current.CancellationToken);

        (await act.Should().ThrowAsync<TicketGenerationException>()).Which.Error.Should().Be(TicketGenerationError.NotConfigured);
        handler.LastBody.Should().BeNull();
    }

    private ClaudeTicketGenerator CreateGenerator(string apiKey = "test-key")
    {
        var factory = new Mock<IHttpClientFactory>();
        factory.Setup(f => f.CreateClient(ClaudeTicketGenerator.HttpClientName)).Returns(() => new HttpClient(handler));

        var options = Options.Create(new ClaudeOptions
        {
            ApiKey = apiKey,
            Model = "claude-test-model",
            Effort = "medium",
            MaxTokens = 4096,
            MaxRetries = 0,
        });

        return new ClaudeTicketGenerator(factory.Object, options, NullLogger<ClaudeTicketGenerator>.Instance);
    }

    private static string MessageJson(string text, string stopReason) => JsonSerializer.Serialize(new
    {
        id = "msg_test",
        type = "message",
        role = "assistant",
        model = "claude-test-model",
        content = new[] { new { type = "text", text } },
        stop_reason = stopReason,
        stop_sequence = (string?)null,
        usage = new { input_tokens = 10, output_tokens = 20 },
    });

    private sealed class StubHandler : HttpMessageHandler
    {
        private string responseBody = "{}";
        private HttpStatusCode status = HttpStatusCode.OK;

        public string? LastBody { get; private set; }

        public string? LastBetaHeader { get; private set; }

        public void Respond(string body, HttpStatusCode code = HttpStatusCode.OK) => (responseBody, status) = (body, code);

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastBody = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
            LastBetaHeader = request.Headers.TryGetValues("anthropic-beta", out var values) ? string.Join(",", values) : null;
            return new HttpResponseMessage(status) { Content = new StringContent(responseBody, Encoding.UTF8, "application/json") };
        }
    }
}
