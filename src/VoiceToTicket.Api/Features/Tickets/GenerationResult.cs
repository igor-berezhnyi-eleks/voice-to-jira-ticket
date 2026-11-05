using VoiceToTicket.Api.Features.Tickets.Contract;

namespace VoiceToTicket.Api.Features.Tickets;

/// <summary>A generated ticket and how it was made. This is also the response body of <c>POST /api/tickets</c> (plan 4.4).</summary>
/// <param name="Usage">Null when the provider uses no tokens.</param>
public sealed record GenerationResult(
    Ticket Ticket,
    string Provider,
    string Model,
    long DurationMs,
    TokenUsage? Usage);

public sealed record TokenUsage(
    long InputTokens,
    long OutputTokens);
