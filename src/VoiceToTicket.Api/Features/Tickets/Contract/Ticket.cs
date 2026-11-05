namespace VoiceToTicket.Api.Features.Tickets.Contract;

/// <param name="Bug">Set only when <paramref name="Type"/> is <see cref="TicketType.Bug"/>.</param>
/// <param name="Feature">Set only when <paramref name="Type"/> is <see cref="TicketType.Feature"/>.</param>
public sealed record Ticket(
    TicketType Type,
    string Title,
    string Description,
    BugDetails? Bug,
    FeatureDetails? Feature,
    IReadOnlyList<MissingInformation> MissingInformation);
