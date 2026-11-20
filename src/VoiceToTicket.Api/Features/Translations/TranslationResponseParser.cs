using System.Text.Json;
using System.Text.RegularExpressions;
using VoiceToTicket.Api.Features.Tickets.Claude;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Features.Translations;

/// <summary>
/// Turns Claude's reply into a source language and a translation. Pure. Error details name rules and never contain the
/// model's text, because that text is derived from the report.
/// </summary>
public static partial class TranslationResponseParser
{
    [GeneratedRegex("^[a-z]{2}$")]
    private static partial Regex LanguageCode();

    /// <exception cref="ApiException">With code <c>llm_refused</c> (422), <c>llm_truncated</c> or <c>llm_invalid_output</c> (502).</exception>
    public static (string From, string Text) Parse(ClaudeReply reply)
    {
        ArgumentNullException.ThrowIfNull(reply);

        switch (reply.StopReason)
        {
            case TicketResponseParser.RefusalStopReason:
                throw new ApiException(
                    StatusCodes.Status422UnprocessableEntity,
                    ErrorCodes.LlmRefused,
                    "The model declined to translate this text.",
                    "Rephrase or shorten the report and try again.");

            case TicketResponseParser.MaxTokensStopReason:
                throw new ApiException(
                    StatusCodes.Status502BadGateway,
                    ErrorCodes.LlmTruncated,
                    "The model's translation was cut off.",
                    "The translation did not fit in the allowed output length. Try again or translate a shorter text.");

            case TicketResponseParser.EndTurnStopReason:
                break;

            default:
                throw Invalid($"The model stopped with an unexpected reason ({reply.StopReason ?? "none"}).");
        }

        if (string.IsNullOrWhiteSpace(reply.Text))
        {
            throw Invalid("The model returned no text.");
        }

        Reply? parsed;
        try
        {
            parsed = JsonSerializer.Deserialize<Reply>(reply.Text, JsonSerializerOptions.Web);
        }
        catch (JsonException exception)
        {
            throw Invalid("The model's answer is not in the expected format.", exception);
        }

        if (parsed?.From is null || !LanguageCode().IsMatch(parsed.From))
        {
            throw Invalid("The source language is not a two-letter lower-case code.");
        }

        if (string.IsNullOrWhiteSpace(parsed.Text))
        {
            throw Invalid("The translation is empty.");
        }

        return (parsed.From, parsed.Text);
    }

    private static ApiException Invalid(string detail, Exception? inner = null) => new(
        StatusCodes.Status502BadGateway,
        ErrorCodes.LlmInvalidOutput,
        "The model returned a translation that cannot be used.",
        detail,
        inner);

    private sealed record Reply(string? From, string? Text);
}
