using Microsoft.AspNetCore.Http;
using System.Text.Json;
using Anthropic.Exceptions;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using VoiceToTicket.Api.Features.Tickets;
using VoiceToTicket.Api.Features.Tickets.Claude;
using VoiceToTicket.Api.Features.Tickets.Contract;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Tests.Tickets.Claude;

/// <summary>Plan 4.6: the request the generator builds and how failures become error codes. No network.</summary>
public sealed class ClaudeTicketGeneratorTests
{
    private const string Transcript = "Saving an invoice with an empty date crashes the editor.";

    [Fact]
    public async Task Builds_one_request_from_the_prompt_the_schema_and_the_settings()
    {
        var messages = new FakeMessages();
        var generator = Create(messages, new ClaudeOptions { ApiKey = "k", Model = "claude-sonnet-5-5", Effort = "high", MaxTokens = 1234 });

        await generator.GenerateAsync(Transcript, TestContext.Current.CancellationToken);

        var request = Assert.Single(messages.Requests);
        Assert.Equal("claude-sonnet-5-5", request.Model);
        Assert.Equal("high", request.Effort);
        Assert.Equal(1234, request.MaxTokens);
        Assert.Equal(TicketPrompt.System, request.SystemPrompt);
        Assert.Equal(TicketPrompt.UserMessage(Transcript), request.UserMessage);
        Assert.Equal(TicketJson.ExportSchemaText(), request.Schema.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
    }

    [Theory]
    [InlineData("claude-sonnet-5-5", true)]
    [InlineData("claude-opus-5-5", true)]
    [InlineData("claude-haiku-5-5", false)]
    public async Task Refusal_fallback_is_requested_only_for_models_that_have_it(string model, bool expected)
    {
        var messages = new FakeMessages();
        var generator = Create(messages, new ClaudeOptions { ApiKey = "k", Model = model });

        await generator.GenerateAsync(Transcript, TestContext.Current.CancellationToken);

        Assert.Equal(expected, messages.Requests.Single().RefusalFallback);
    }

    [Fact]
    public async Task Result_carries_provider_model_usage_and_duration()
    {
        var generator = Create(
            new FakeMessages { Reply = new ClaudeReply(TicketSamples.FeatureExampleJson, "end_turn", 111, 222) },
            new ClaudeOptions { ApiKey = "k", Model = "claude-haiku-5-5" });

        var result = await generator.GenerateAsync(Transcript, TestContext.Current.CancellationToken);

        Assert.Equal("Claude", result.Provider);
        Assert.Equal("claude-haiku-5-5", result.Model);
        Assert.Equal(TicketType.Feature, result.Ticket.Type);
        Assert.Equal(new TokenUsage(111, 222), result.Usage);
        Assert.Equal(250, result.DurationMs);
    }

    [Fact]
    public async Task A_refusal_reply_surfaces_as_llm_refused()
    {
        var generator = Create(new FakeMessages { Reply = new ClaudeReply(null, "refusal", 1, 0) });

        var exception = await Assert.ThrowsAsync<ApiException>(() => generator.GenerateAsync(Transcript, TestContext.Current.CancellationToken));

        Assert.Equal(ErrorCodes.LlmRefused, exception.Code);
    }

    [Fact]
    public async Task An_invalid_ticket_is_not_retried()
    {
        var messages = new FakeMessages { Reply = new ClaudeReply("not json", "end_turn", 1, 1) };
        var generator = Create(messages);

        var exception = await Assert.ThrowsAsync<ApiException>(() => generator.GenerateAsync(Transcript, TestContext.Current.CancellationToken));

        Assert.Equal(ErrorCodes.LlmInvalidOutput, exception.Code);
        Assert.Single(messages.Requests);
    }

    public static TheoryData<Exception, string, int> Failures => new()
    {
        { new HttpRequestException("connection refused"), ErrorCodes.LlmUnavailable, StatusCodes.Status503ServiceUnavailable },
        { new AnthropicIOException("io", new HttpRequestException("io")), ErrorCodes.LlmUnavailable, StatusCodes.Status503ServiceUnavailable },
        { new TimeoutException(), ErrorCodes.LlmTimeout, StatusCodes.Status504GatewayTimeout },
        { new TaskCanceledException("http timeout"), ErrorCodes.LlmTimeout, StatusCodes.Status504GatewayTimeout },
    };

    [Theory]
    [MemberData(nameof(Failures))]
    public async Task Transport_failures_map_to_their_code(Exception failure, string code, int status)
    {
        var generator = Create(new FakeMessages { Failure = failure });

        var exception = await Assert.ThrowsAsync<ApiException>(() => generator.GenerateAsync(Transcript, TestContext.Current.CancellationToken));

        Assert.Equal(code, exception.Code);
        Assert.Equal(status, exception.StatusCode);
        Assert.Same(failure, exception.InnerException);
    }

    [Theory]
    [InlineData(typeof(AnthropicUnauthorizedException))]
    [InlineData(typeof(AnthropicForbiddenException))]
    [InlineData(typeof(AnthropicBadRequestException))]
    [InlineData(typeof(AnthropicNotFoundException))]
    [InlineData(typeof(AnthropicRateLimitException))]
    [InlineData(typeof(Anthropic5xxException))]
    public void Every_api_status_exception_of_the_sdk_maps_to_unavailable(Type sdkException)
    {
        // The SDK's exceptions are hard to construct, so this pins the class hierarchy the mapping relies on.
        Assert.True(sdkException.IsAssignableTo(typeof(AnthropicException)));
    }

    [Fact]
    public async Task A_bug_in_our_own_code_is_not_hidden_as_a_claude_failure()
    {
        var generator = Create(new FakeMessages { Failure = new InvalidOperationException("boom") });

        await Assert.ThrowsAsync<InvalidOperationException>(() => generator.GenerateAsync(Transcript, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Cancellation_by_the_caller_is_not_turned_into_an_error_code()
    {
        using var cancelled = new CancellationTokenSource();
        await cancelled.CancelAsync();
        var generator = Create(new FakeMessages { WaitForCancellation = true });

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => generator.GenerateAsync(Transcript, cancelled.Token));
    }

    [Fact]
    public async Task The_deadline_from_settings_maps_to_llm_timeout()
    {
        var generator = Create(new FakeMessages { WaitForCancellation = true }, new ClaudeOptions { ApiKey = "k", TimeoutSeconds = 1 });

        var exception = await Assert.ThrowsAsync<ApiException>(() => generator.GenerateAsync(Transcript, TestContext.Current.CancellationToken));

        Assert.Equal(ErrorCodes.LlmTimeout, exception.Code);
    }

    private static ClaudeTicketGenerator Create(FakeMessages messages, ClaudeOptions? options = null) =>
        new(messages, Options.Create(options ?? new ClaudeOptions { ApiKey = "k" }), new StepClock(), NullLogger<ClaudeTicketGenerator>.Instance);

    private sealed class FakeMessages : IClaudeMessages
    {
        public List<ClaudeRequest> Requests { get; } = [];

        public ClaudeReply Reply { get; init; } = new(TicketSamples.PlanBugExampleJson, "end_turn", 5, 6);

        public Exception? Failure { get; init; }

        public bool WaitForCancellation { get; init; }

        public async Task<ClaudeReply> CreateAsync(ClaudeRequest request, CancellationToken cancellationToken)
        {
            Requests.Add(request);
            if (WaitForCancellation)
            {
                await Task.Delay(Timeout.Infinite, cancellationToken);
            }

            return Failure is null ? Reply : throw Failure;
        }
    }

    /// <summary>Every timestamp is 250 ms after the previous one, so a measured duration is exactly 250 ms.</summary>
    private sealed class StepClock : TimeProvider
    {
        private long _ticks;

        public override long TimestampFrequency => 1000;

        public override long GetTimestamp() => _ticks += 250;
    }
}
