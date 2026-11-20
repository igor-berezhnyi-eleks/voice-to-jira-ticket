using Anthropic.Exceptions;
using Microsoft.Extensions.Options;
using VoiceToTicket.Api.Features.Tickets.Claude;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Features.Translations;

/// <summary>
/// Translates with one non-streaming Claude call (decision D20). No retry: the user presses the button again. The SDK
/// retries connection errors, 5xx and 429 by itself. Nothing derived from the text is logged.
/// </summary>
public sealed class ClaudeTranslator(
    IClaudeMessages messages,
    IOptions<TranslationOptions> options,
    ILogger<ClaudeTranslator> logger) : ITranslator
{
    /// <summary>Models with server-side refusal fallback (decision D7). Haiku has none: a refusal becomes an error.</summary>
    private static readonly string[] ModelsWithRefusalFallback = ["claude-sonnet-5-5", "claude-opus-5-5"];

    public async Task<TranslatorReply> TranslateAsync(string text, string to, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(text);
        var settings = options.Value;

        var request = new ClaudeRequest(
            settings.Model,
            TranslationPrompt.System,
            TranslationPrompt.UserMessage(text, to),
            TranslationPrompt.Schema(),
            settings.Effort,
            settings.MaxTokens,
            RefusalFallback: ModelsWithRefusalFallback.Contains(settings.Model));

        var reply = await CallAsync(request, settings.TimeoutSeconds, cancellationToken);
        var (from, translated) = TranslationResponseParser.Parse(reply);
        return new TranslatorReply(from, translated, settings.Model);
    }

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
            // Log the exception type only: SDK messages can echo parts of the request, and the request holds the text.
            logger.LogWarning("Claude translation call failed with {ExceptionType}, answered as {Code}", exception.GetType().Name, mapped.Code);
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
            "The translator is not available.",
            "Try again in a moment. If it keeps failing, check the API key and the service status.",
            exception),
        _ => null,
    };
}
