namespace VoiceToTicket.Api.Features.Tickets.Contract;

/// <param name="Field">A path from <see cref="TicketFields"/>, such as "bug.environment"; null for a general gap.</param>
/// <param name="Question">A short question to the reporter.</param>
public sealed record MissingInformation(
    string? Field,
    string Question);
