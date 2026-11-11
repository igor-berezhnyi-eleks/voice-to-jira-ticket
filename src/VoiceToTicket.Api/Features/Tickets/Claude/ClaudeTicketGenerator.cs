using Anthropic.Exceptions;
using Microsoft.Extensions.Options;
using VoiceToTicket.Api.Features.Tickets.Contract;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Features.Tickets.Claude;

/// <summary>
/// Generates a ticket with a non-streaming Claude call (plan 4.6, decision D6). An unusable ticket is retried once with the
/// same request (D15); the result says how many attempts it took and whether the first was valid, so the evaluation can
/// report both rates. Refusals, truncation and timeouts are not retried. The SDK retries connection errors, 5xx and 429 by itself.
/// </summary>
public sealed class ClaudeTicketGenerator(
    IClaudeMessages messages,
    IOptions<ClaudeOptions> options,
    TimeProvider timeProvider,
    ILogger<ClaudeTicketGenerator> logger) : ITicketGenerator
{
    /// <summary>Key in <see cref="Exception.Data"/> of a failure thrown by <see cref="GenerateAsync"/>: the number of model calls made (an <see cref="int"/>).</summary>
    public const string AttemptsDataKey = "VoiceToTicket.Attempts";

    /// <summary>Retries after an unusable ticket (decision D15). Other failures are never retried here.</summary>
    private const int MaxRetries = 1;

    /// <summary>Models with server-side refusal fallback (decision D7). Haiku has none: a refusal becomes an error.</summary>
    private static readonly string[] ModelsWithRefusalFallback = ["claude-sonnet-5-5", "claude-opus-5-5"];

    public async Task<GenerationResult> GenerateAsync(string transcript, CancellationToken cancellationToken, TicketType? requestedType = null)
    {
        ArgumentNullException.ThrowIfNull(transcript);
        var settings = options.Value;
        var start = timeProvider.GetTimestamp();

        var request = new ClaudeRequest(
            settings.Model,
            TicketPrompt.System,
            TicketPrompt.UserMessage(transcript, requestedType),
            TicketJson.ExportSchema(),
            settings.Effort,
            settings.MaxTokens,
            RefusalFallback: ModelsWithRefusalFallback.Contains(settings.Model));

        long inputTokens = 0;
        long outputTokens = 0;
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                var reply = await CallAsync(request, settings.TimeoutSeconds, cancellationToken);
                inputTokens += reply.InputTokens;
                outputTokens += reply.OutputTokens;
                var ticket = TicketResponseParser.Parse(reply);
                if (requestedType is { } wanted && ticket.Type != wanted)
                {
                    // A ticket of the other type is unusable here and takes the same single retry (decision D16).
                    throw new ApiException(
                        StatusCodes.Status502BadGateway,
                        ErrorCodes.LlmInvalidOutput,
                        "The model returned a ticket that cannot be used.",
                        "The ticket is not of the requested type.");
                }

                var durationMs = (long)timeProvider.GetElapsedTime(start).TotalMilliseconds;
                return new GenerationResult(
                    ticket,
                    TicketGeneratorOptions.ClaudeProvider,
                    settings.Model,
                    durationMs,
                    new TokenUsage(inputTokens, outputTokens),
                    attempt,
                    FirstAttemptValid: attempt == 1);
            }
            catch (ApiException exception) when (exception.Code == ErrorCodes.LlmInvalidOutput && attempt <= MaxRetries)
            {
                // One retry with the same request (decision D15). Log the code only: the reply is derived from the transcript.
                logger.LogWarning("Claude attempt {Attempt} returned an unusable ticket ({Code}); trying once more", attempt, exception.Code);
                cancellationToken.ThrowIfCancellationRequested();
            }
            catch (ApiException exception)
            {
                // Lets the evaluation record how many calls a failed ticket took (a failure on the retry makes it 2).
                exception.Data[AttemptsDataKey] = attempt;
                throw;
            }
        }
    }

    /// <summary>One Claude call with its own deadline; failures become <see cref="ApiException"/>s.</summary>
    private async Task<ClaudeReply> CallAsync(ClaudeRequest request, int timeoutSeconds, CancellationToken cancellationToken)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));
        try
        {
            return await messages.CreateAsync(request, timeout.Token);
        }
        catch (Exception exception) when (!cancellationToken.IsCancellationRequested && TryMap(exception) is { } mapped)
        {
            // Log the exception type only: SDK messages can echo parts of the request, and the request holds the transcript.
            logger.LogWarning("Claude call failed with {ExceptionType}, answered as {Code}", exception.GetType().Name, mapped.Code);
            throw mapped;
        }
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
