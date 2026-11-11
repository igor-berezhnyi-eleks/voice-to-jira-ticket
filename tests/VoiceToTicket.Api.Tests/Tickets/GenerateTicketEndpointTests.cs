using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using VoiceToTicket.Api.Features.Tickets;
using VoiceToTicket.Api.Features.Tickets.Contract;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Tests.Tickets;

/// <summary>Plan 4.4: <c>POST /api/tickets</c> through the whole HTTP pipeline, in both error-handling modes.</summary>
public sealed class GenerateTicketEndpointTests
{
    private const string Path = "/api/tickets";
    private const string BugTranscript = "The app crashes when I save an invoice. It happens every day.";
    private const string FeatureTranscript = "Please add a dark mode to the settings page.";

    [Theory]
    [InlineData("Development")]
    [InlineData("Production")]
    public async Task Bug_transcript_returns_a_bug_ticket(string environment)
    {
        using var body = await PostSuccessfullyAsync(environment, BugTranscript);

        var ticket = ReadTicket(body);
        Assert.Equal(TicketType.Bug, ticket.Type);
        Assert.Equal("The app crashes when I save an invoice", ticket.Title);
        Assert.Empty(TicketValidator.Validate(ticket));
        AssertFakeMetadata(body);
    }

    [Theory]
    [InlineData("Development")]
    [InlineData("Production")]
    public async Task Feature_transcript_returns_a_feature_ticket(string environment)
    {
        using var body = await PostSuccessfullyAsync(environment, FeatureTranscript);

        var ticket = ReadTicket(body);
        Assert.Equal(TicketType.Feature, ticket.Type);
        Assert.Empty(TicketValidator.Validate(ticket));
        AssertFakeMetadata(body);
    }

    [Fact]
    public async Task Response_has_exactly_the_planned_shape()
    {
        using var body = await PostSuccessfullyAsync("Production", BugTranscript);

        Assert.Equal(
            ["ticket", "provider", "model", "durationMs", "usage", "attempts", "firstAttemptValid"],
            body.RootElement.EnumerateObject().Select(property => property.Name));
        Assert.Equal(1, body.RootElement.GetProperty("attempts").GetInt32());
        Assert.True(body.RootElement.GetProperty("firstAttemptValid").GetBoolean());

        var ticket = body.RootElement.GetProperty("ticket");
        Assert.Equal("Bug", ticket.GetProperty("type").GetString());
        Assert.Equal(JsonValueKind.Null, ticket.GetProperty("feature").ValueKind);
    }

    [Theory]
    [InlineData(20)]
    [InlineData(20_000)]
    public async Task Length_limits_are_inclusive(int length)
    {
        using var body = await PostSuccessfullyAsync("Production", new string('a', length));

        Assert.Empty(TicketValidator.Validate(ReadTicket(body)));
    }

    [Fact]
    public async Task Duration_is_measured_with_the_injected_time_provider()
    {
        await using var factory = new ApiFactory("Production").WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services =>
                services.AddSingleton<TimeProvider>(new SteppingTimeProvider(TimeSpan.FromMilliseconds(250)))));
        using var client = factory.CreateClient();

        using var response = await PostAsync(client, FeatureTranscript);

        response.EnsureSuccessStatusCode();
        using var body = await ReadJsonAsync(response);
        Assert.Equal(250, body.RootElement.GetProperty("durationMs").GetInt64());
    }

    public static TheoryData<string, string> InvalidTranscripts()
    {
        var data = new TheoryData<string, string>();
        foreach (var environment in new[] { "Development", "Production" })
        {
            data.Add(environment, new string('a', 19));
            data.Add(environment, new string('a', 20_001));
            data.Add(environment, new string(' ', 30));
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(InvalidTranscripts))]
    public async Task Invalid_transcript_returns_a_validation_problem_naming_the_field(string environment, string transcript)
    {
        await using var factory = new ApiFactory(environment);
        using var client = factory.CreateClient();

        using var response = await PostAsync(client, transcript);

        using var body = await AssertValidationProblemAsync(response);

        // The framework names the key after the C# member, not the camelCase JSON property (see the T1.3 log).
        var errors = body.RootElement.GetProperty("errors").EnumerateObject().Single();
        Assert.Equal(nameof(GenerateTicketRequest.Transcript), errors.Name);

        // The body never echoes the submitted text.
        Assert.DoesNotContain(new string(transcript[0], 19), body.RootElement.GetRawText(), StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("Development", "{}")]
    [InlineData("Production", "{}")]
    [InlineData("Development", """{"transcript":null}""")]
    [InlineData("Production", """{"transcript":null}""")]
    [InlineData("Development", """{"transcript":42}""")]
    [InlineData("Production", """{"transcript":42}""")]
    [InlineData("Development", "not json")]
    [InlineData("Production", "not json")]
    [InlineData("Development", "null")]
    [InlineData("Production", "null")]
    public async Task Malformed_or_incomplete_body_returns_a_validation_problem(string environment, string json)
    {
        await using var factory = new ApiFactory(environment);
        using var client = factory.CreateClient();
        using var content = new StringContent(json, Encoding.UTF8, "application/json");

        using var response = await client.PostAsync(Path, content, TestContext.Current.CancellationToken);

        (await AssertValidationProblemAsync(response)).Dispose();
    }

    [Theory]
    [InlineData("Development")]
    [InlineData("Production")]
    public async Task Missing_body_returns_a_validation_problem(string environment)
    {
        await using var factory = new ApiFactory(environment);
        using var client = factory.CreateClient();

        using var response = await client.PostAsync(Path, content: null, TestContext.Current.CancellationToken);

        (await AssertValidationProblemAsync(response)).Dispose();
    }

    [Theory]
    [InlineData("Development")]
    [InlineData("Production")]
    public async Task Transcript_text_is_not_logged_at_information_or_above(string environment)
    {
        const string Marker = "ZEBRAMARKER";
        var logs = new CapturingLoggerProvider();
        await using var factory = new ApiFactory(environment).WithWebHostBuilder(builder =>
            builder.ConfigureLogging(logging =>
            {
                logging.SetMinimumLevel(LogLevel.Trace);
                logging.AddProvider(logs);
            }));
        using var client = factory.CreateClient();
        var cancellationToken = TestContext.Current.CancellationToken;

        // Success, both validation failures, and a body that does not parse.
        (await PostAsync(client, $"The app crashes with {Marker} on save.")).Dispose();
        (await PostAsync(client, Marker)).Dispose();
        (await PostAsync(client, Marker + new string('a', 20_000))).Dispose();
        using var malformed = new StringContent($$"""{"transcript":"{{Marker}}""", Encoding.UTF8, "application/json");
        (await client.PostAsync(Path, malformed, cancellationToken)).Dispose();

        var loud = logs.Entries.Where(entry => entry.Level >= LogLevel.Information).ToList();
        Assert.DoesNotContain(loud, entry => entry.Text.Contains(Marker, StringComparison.Ordinal));

        // The log line the plan asks for exists, so the check above is not passing on an empty log.
        Assert.Contains(loud, entry =>
            entry.Category.EndsWith(nameof(GenerateTicketRequest), StringComparison.Ordinal)
            && entry.Text.Contains("characters", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Openapi_document_describes_the_endpoint()
    {
        await using var factory = new ApiFactory("Development");
        using var client = factory.CreateClient();

        using var body = JsonDocument.Parse(await client.GetStringAsync("/openapi/v1.json", TestContext.Current.CancellationToken));

        var post = body.RootElement.GetProperty("paths").GetProperty(Path).GetProperty("post");
        Assert.True(post.GetProperty("responses").TryGetProperty("200", out _));
        Assert.True(post.GetProperty("responses").TryGetProperty("400", out _));
    }

    private static async Task<JsonDocument> PostSuccessfullyAsync(string environment, string transcript)
    {
        await using var factory = new ApiFactory(environment);
        using var client = factory.CreateClient();

        using var response = await PostAsync(client, transcript);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJsonAsync(response);
    }

    private static Task<HttpResponseMessage> PostAsync(HttpClient client, string transcript) =>
        client.PostAsJsonAsync(Path, new { transcript }, TestContext.Current.CancellationToken);

    private static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));

    // The strict contract options: the ticket on the wire must be readable as the contract says.
    private static Ticket ReadTicket(JsonDocument body)
    {
        var ticket = body.RootElement.GetProperty("ticket").Deserialize<Ticket>(TicketJson.Options);
        Assert.NotNull(ticket);
        return ticket;
    }

    private static void AssertFakeMetadata(JsonDocument body)
    {
        Assert.Equal("Fake", body.RootElement.GetProperty("provider").GetString());
        Assert.Equal("fake", body.RootElement.GetProperty("model").GetString());
        Assert.True(body.RootElement.GetProperty("durationMs").GetInt64() >= 0);
        Assert.Equal(JsonValueKind.Null, body.RootElement.GetProperty("usage").ValueKind);
    }

    private static async Task<JsonDocument> AssertValidationProblemAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var body = await ReadJsonAsync(response);
        Assert.Equal(400, body.RootElement.GetProperty("status").GetInt32());
        Assert.Equal(ErrorCodes.Validation, body.RootElement.GetProperty("code").GetString());
        return body;
    }

    private sealed class CapturingLoggerProvider : ILoggerProvider
    {
        public ConcurrentQueue<(string Category, LogLevel Level, string Text)> Entries { get; } = new();

        public ILogger CreateLogger(string categoryName) => new CapturingLogger(categoryName, Entries);

        public void Dispose()
        {
        }

        private sealed class CapturingLogger(string category, ConcurrentQueue<(string, LogLevel, string)> entries) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state)
                where TState : notnull => null;

            public bool IsEnabled(LogLevel logLevel) => true;

            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
                entries.Enqueue((category, logLevel, $"{formatter(state, exception)} {exception}"));
        }
    }
}
