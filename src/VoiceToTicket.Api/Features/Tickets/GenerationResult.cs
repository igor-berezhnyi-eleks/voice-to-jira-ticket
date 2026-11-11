using VoiceToTicket.Api.Features.Tickets.Contract;

namespace VoiceToTicket.Api.Features.Tickets;

/// <summary>A generated ticket and how it was made. This is also the response body of <c>POST /api/tickets</c> (plan 4.4).</summary>
/// <param name="DurationMs">Covers every attempt.</param>
/// <param name="Usage">Null when the provider uses no tokens; otherwise the sum over all attempts.</param>
/// <param name="Attempts">Model calls made for this ticket: 1, or 2 after a retry on invalid output (decision D15).</param>
/// <param name="FirstAttemptValid">False when the first reply was unusable and the retry produced the ticket.</param>
public sealed record GenerationResult(
    Ticket Ticket,
    string Provider,
    string Model,
    long DurationMs,
    TokenUsage? Usage,
    int Attempts,
    bool FirstAttemptValid);

public sealed record TokenUsage(
    long InputTokens,
    long OutputTokens);
