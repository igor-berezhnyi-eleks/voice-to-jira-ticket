using Anthropic.Exceptions;
using Microsoft.Extensions.Options;
using VoiceToTicket.Api.Features.Tickets.Contract;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Features.Tickets.Claude;

/// <summary>
/// Generates a ticket with one non-streaming Claude call (plan 4.6, decision D6). No retry on an invalid ticket (D15):
/// the failure is returned so the evaluation can measure it. The SDK retries connection errors, 5xx and 429 by itself.
/// </summary>
public sealed class ClaudeTicketGenerator(
    IClaudeMessages messages,
    IOptions<ClaudeOptions> options,
    TimeProvider timeProvider,
    ILogger<ClaudeTicketGenerator> logger) : ITicketGenerator
{
    /// <summary>Models with server-side refusal fallback (decision D7). Haiku has none: a refusal becomes an error.</summary>
    private static readonly string[] ModelsWithRefusalFallback = ["claude-sonnet-5-5", "claude-opus-5-5"];

    public async Task<GenerationResult> GenerateAsync(string transcript, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(transcript);
        var settings = options.Value;
        var start = timeProvider.GetTimestamp();

        var request = new ClaudeRequest(
            settings.Model,
            TicketPrompt.System,
            TicketPrompt.UserMessage(transcript),
            TicketJson.ExportSchema(),
            settings.Effort,
            settings.MaxTokens,
            RefusalFallback: ModelsWithRefusalFallback.Contains(settings.Model));

        ClaudeReply reply;
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(settings.TimeoutSeconds));
        try
        {
            reply = await messages.CreateAsync(request, timeout.Token);
        }
        catch (Exception exception) when (!cancellationToken.IsCancellationRequested && TryMap(exception) is { } mapped)
        {
            // Log the exception type only: SDK messages can echo parts of the request, and the request holds the transcript.
            logger.LogWarning("Claude call failed with {ExceptionType}, answered as {Code}", exception.GetType().Name, mapped.Code);
            throw mapped;
        }

        var ticket = TicketResponseParser.Parse(reply);
        var durationMs = (long)timeProvider.GetElapsedTime(start).TotalMilliseconds;
        return new GenerationResult(
            ticket,
            TicketGeneratorOptions.ClaudeProvider,
            settings.Model,
            durationMs,
            new TokenUsage(reply.InputTokens, reply.OutputTokens));
    }

    /// <summary>Null for an exception that is a bug, not a Claude failure; the caller lets it surface as a 500.</summary>
    internal static ApiException? TryMap(Exception exception) => exception switch
    {
        OperationCanceledException or TimeoutException => new ApiException(
            StatusCodes.Status504GatewayTimeout,
            ErrorCodes.LlmTimeout,
            "The model took too long to answer.",
            "Try again.",
            exception),
        AnthropicException or HttpRequestException => new ApiException(
            StatusCodes.Status503ServiceUnavailable,
            ErrorCodes.LlmUnavailable,
            "The ticket generator is not available.",
            "Try again in a moment. If it keeps failing, check the API key and the service status.",
            exception),
        _ => null,
    };
}
