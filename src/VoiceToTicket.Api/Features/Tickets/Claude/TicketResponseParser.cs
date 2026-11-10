using System.Text.Json;
using VoiceToTicket.Api.Features.Tickets.Contract;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Features.Tickets.Claude;

/// <summary>
/// Turns Claude's reply into a validated ticket (plan 4.6). Pure. Error details name rules and never contain the
/// model's text, because that text is derived from the transcript.
/// </summary>
public static class TicketResponseParser
{
    public const string RefusalStopReason = "refusal";
    public const string MaxTokensStopReason = "max_tokens";
    public const string EndTurnStopReason = "end_turn";

    /// <exception cref="ApiException">With code <c>llm_refused</c> (422), <c>llm_truncated</c> or <c>llm_invalid_output</c> (502).</exception>
    public static Ticket Parse(ClaudeReply reply)
    {
        ArgumentNullException.ThrowIfNull(reply);

        switch (reply.StopReason)
        {
            case RefusalStopReason:
                throw new ApiException(
                    StatusCodes.Status422UnprocessableEntity,
                    ErrorCodes.LlmRefused,
                    "The model declined to process this transcript.",
                    "Rephrase or shorten the report and try again.");

            case MaxTokensStopReason:
                throw new ApiException(
                    StatusCodes.Status502BadGateway,
                    ErrorCodes.LlmTruncated,
                    "The model's answer was cut off.",
                    "The ticket did not fit in the allowed output length. Try again or shorten the report.");

            case EndTurnStopReason:
                break;

            default:
                throw Invalid($"The model stopped with an unexpected reason ({reply.StopReason ?? "none"}).");
        }

        if (string.IsNullOrWhiteSpace(reply.Text))
        {
            throw Invalid("The model returned no text.");
        }

        Ticket? ticket;
        try
        {
            ticket = JsonSerializer.Deserialize<Ticket>(reply.Text, TicketJson.Options);
        }
        catch (JsonException exception)
        {
            throw Invalid("The model's answer is not a ticket in the expected format.", exception);
        }

        if (ticket is null)
        {
            throw Invalid("The model's answer is empty.");
        }

        var errors = TicketValidator.Validate(ticket);
        if (errors.Count > 0)
        {
            throw Invalid("The ticket breaks these rules: " + string.Join(" ", errors));
        }

        return ticket;
    }

    private static ApiException Invalid(string detail, Exception? inner = null) => new(
        StatusCodes.Status502BadGateway,
        ErrorCodes.LlmInvalidOutput,
        "The model returned a ticket that cannot be used.",
        detail,
        inner);
}
