using Microsoft.AspNetCore.Http;
using System.Text.Json;
using Anthropic.Exceptions;
using Microsoft.Extensions.Logging;
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
    public async Task A_valid_first_reply_makes_one_call_and_says_so()
    {
        var messages = new FakeMessages();

        var result = await Create(messages).GenerateAsync(Transcript, TestContext.Current.CancellationToken);

        Assert.Single(messages.Requests);
        Assert.Equal(1, result.Attempts);
        Assert.True(result.FirstAttemptValid);
    }

    [Fact]
    public async Task An_invalid_first_reply_is_retried_once_with_the_same_request()
    {
        var messages = new FakeMessages { Sequence = [Invalid(10, 1), Valid(111, 222)] };

        var result = await Create(messages).GenerateAsync(Transcript, TestContext.Current.CancellationToken);

        Assert.Equal(2, messages.Requests.Count);
        Assert.Equal(messages.Requests[0], messages.Requests[1]);
        Assert.Equal(2, result.Attempts);
        Assert.False(result.FirstAttemptValid);
        Assert.Equal(TicketType.Feature, result.Ticket.Type);
    }

    [Fact]
    public async Task Usage_and_duration_cover_both_attempts()
    {
        var clock = new ManualClock();
        var messages = new FakeMessages { Sequence = [Invalid(10, 1), Valid(111, 222)], OnCall = () => clock.Advance(300) };

        var result = await Create(messages, clock: clock).GenerateAsync(Transcript, TestContext.Current.CancellationToken);

        Assert.Equal(new TokenUsage(121, 223), result.Usage);
        Assert.Equal(600, result.DurationMs);
    }

    [Fact]
    public async Task Two_invalid_replies_fail_with_llm_invalid_output_after_exactly_two_calls()
    {
        var messages = new FakeMessages { Sequence = [Invalid(1, 1), Invalid(1, 1), Valid(1, 1)] };

        var exception = await Assert.ThrowsAsync<ApiException>(() => Create(messages).GenerateAsync(Transcript, TestContext.Current.CancellationToken));

        Assert.Equal(ErrorCodes.LlmInvalidOutput, exception.Code);
        Assert.Equal(StatusCodes.Status502BadGateway, exception.StatusCode);
        Assert.Equal(2, messages.Requests.Count);
    }

    [Fact]
    public async Task A_valid_json_ticket_that_breaks_a_rule_is_retried_like_unparseable_text()
    {
        var messages = new FakeMessages { Sequence = [new ClaudeReply("""{"type":"Bug"}""", "end_turn", 1, 1), Valid(1, 1)] };

        var result = await Create(messages).GenerateAsync(Transcript, TestContext.Current.CancellationToken);

        Assert.Equal(2, result.Attempts);
    }

    [Fact]
    public async Task A_failure_says_how_many_calls_were_made()
    {
        var afterRetry = await Assert.ThrowsAsync<ApiException>(() =>
            Create(new FakeMessages { Sequence = [Invalid(1, 1), Invalid(1, 1)] }).GenerateAsync(Transcript, TestContext.Current.CancellationToken));
        var timeoutOnRetry = await Assert.ThrowsAsync<ApiException>(() =>
            Create(new FakeMessages { Sequence = [Invalid(1, 1)], FailureAfterSequence = new TimeoutException() }).GenerateAsync(Transcript, TestContext.Current.CancellationToken));
        var refusal = await Assert.ThrowsAsync<ApiException>(() =>
            Create(new FakeMessages { Reply = new ClaudeReply(null, "refusal", 1, 0) }).GenerateAsync(Transcript, TestContext.Current.CancellationToken));

        Assert.Equal(2, afterRetry.Data[ClaudeTicketGenerator.AttemptsDataKey]);
        Assert.Equal(2, timeoutOnRetry.Data[ClaudeTicketGenerator.AttemptsDataKey]);
        Assert.Equal(1, refusal.Data[ClaudeTicketGenerator.AttemptsDataKey]);
    }

    [Theory]
    [InlineData("refusal", ErrorCodes.LlmRefused)]
    [InlineData("max_tokens", ErrorCodes.LlmTruncated)]
    public async Task Refusals_and_truncation_are_not_retried(string stopReason, string code)
    {
        var messages = new FakeMessages { Sequence = [new ClaudeReply(null, stopReason, 1, 0), Valid(1, 1)] };

        var exception = await Assert.ThrowsAsync<ApiException>(() => Create(messages).GenerateAsync(Transcript, TestContext.Current.CancellationToken));

        Assert.Equal(code, exception.Code);
        Assert.Single(messages.Requests);
    }

    [Fact]
    public async Task A_transport_failure_on_the_first_attempt_is_not_retried()
    {
        var messages = new FakeMessages { Failure = new HttpRequestException("down") };

        var exception = await Assert.ThrowsAsync<ApiException>(() => Create(messages).GenerateAsync(Transcript, TestContext.Current.CancellationToken));

        Assert.Equal(ErrorCodes.LlmUnavailable, exception.Code);
        Assert.Single(messages.Requests);
    }

    [Fact]
    public async Task A_failure_on_the_retry_keeps_its_own_code()
    {
        var messages = new FakeMessages { Sequence = [Invalid(1, 1)], FailureAfterSequence = new TimeoutException() };

        var exception = await Assert.ThrowsAsync<ApiException>(() => Create(messages).GenerateAsync(Transcript, TestContext.Current.CancellationToken));

        Assert.Equal(ErrorCodes.LlmTimeout, exception.Code);
        Assert.Equal(2, messages.Requests.Count);
    }

    [Fact]
    public async Task Cancellation_between_attempts_stops_without_a_retry()
    {
        using var cancelled = new CancellationTokenSource();
        var messages = new FakeMessages { Sequence = [Invalid(1, 1), Valid(1, 1)], OnCall = () => cancelled.Cancel() };

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => Create(messages).GenerateAsync(Transcript, cancelled.Token));

        Assert.Single(messages.Requests);
    }

    [Fact]
    public async Task The_deadline_applies_to_each_attempt_separately()
    {
        var messages = new FakeMessages { Sequence = [Invalid(1, 1)], WaitForCancellationAfterSequence = true };
        var generator = Create(messages, new ClaudeOptions { ApiKey = "k", TimeoutSeconds = 1 });

        var exception = await Assert.ThrowsAsync<ApiException>(() => generator.GenerateAsync(Transcript, TestContext.Current.CancellationToken));

        Assert.Equal(ErrorCodes.LlmTimeout, exception.Code);
        Assert.Equal(2, messages.Requests.Count);
    }

    [Fact]
    public async Task A_retry_logs_the_attempt_and_code_but_never_transcript_or_model_text()
    {
        const string modelText = "SECRET-MODEL-TEXT";
        var logger = new CapturingLogger();
        var messages = new FakeMessages { Sequence = [new ClaudeReply(modelText, "end_turn", 1, 1), Valid(1, 1)] };
        var generator = new ClaudeTicketGenerator(messages, Options.Create(new ClaudeOptions { ApiKey = "k" }), new StepClock(), logger);

        await generator.GenerateAsync(Transcript + " SECRET-TRANSCRIPT", TestContext.Current.CancellationToken);

        var entry = Assert.Single(logger.Entries);
        Assert.Contains(ErrorCodes.LlmInvalidOutput, entry);
        Assert.DoesNotContain("SECRET", entry);
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

    private static ClaudeReply Invalid(long input, long output) => new("not json", "end_turn", input, output);

    private static ClaudeReply Valid(long input, long output) => new(TicketSamples.FeatureExampleJson, "end_turn", input, output);

    private static ClaudeTicketGenerator Create(FakeMessages messages, ClaudeOptions? options = null, TimeProvider? clock = null) =>
        new(messages, Options.Create(options ?? new ClaudeOptions { ApiKey = "k" }), clock ?? new StepClock(), NullLogger<ClaudeTicketGenerator>.Instance);

    private sealed class FakeMessages : IClaudeMessages
    {
        public List<ClaudeRequest> Requests { get; } = [];

        public ClaudeReply Reply { get; init; } = new(TicketSamples.PlanBugExampleJson, "end_turn", 5, 6);

        public Exception? Failure { get; init; }

        public bool WaitForCancellation { get; init; }

        /// <summary>Replies for the first calls, in order. Once used up, <see cref="FailureAfterSequence"/>, waiting, or <see cref="Reply"/> follows.</summary>
        public IReadOnlyList<ClaudeReply> Sequence { get; init; } = [];

        public Exception? FailureAfterSequence { get; init; }

        public bool WaitForCancellationAfterSequence { get; init; }

        public Action? OnCall { get; init; }

        public async Task<ClaudeReply> CreateAsync(ClaudeRequest request, CancellationToken cancellationToken)
        {
            Requests.Add(request);
            OnCall?.Invoke();
            var index = Requests.Count - 1;
            if (index < Sequence.Count)
            {
                return Sequence[index];
            }

            if (Sequence.Count > 0 && FailureAfterSequence is not null)
            {
                throw FailureAfterSequence;
            }

            if (WaitForCancellation || (Sequence.Count > 0 && WaitForCancellationAfterSequence))
            {
                await Task.Delay(Timeout.Infinite, cancellationToken);
            }

            return Failure is null ? Reply : throw Failure;
        }
    }

    private sealed class ManualClock : TimeProvider
    {
        private long _ticks;

        public override long TimestampFrequency => 1000;

        public override long GetTimestamp() => _ticks;

        public void Advance(long milliseconds) => _ticks += milliseconds;
    }

    private sealed class CapturingLogger : ILogger<ClaudeTicketGenerator>
    {
        public List<string> Entries { get; } = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
            Entries.Add($"{logLevel}: {formatter(state, exception)}");
    }

    /// <summary>Every timestamp is 250 ms after the previous one, so a measured duration is exactly 250 ms.</summary>
    private sealed class StepClock : TimeProvider
    {
        private long _ticks;

        public override long TimestampFrequency => 1000;

        public override long GetTimestamp() => _ticks += 250;
    }
}
