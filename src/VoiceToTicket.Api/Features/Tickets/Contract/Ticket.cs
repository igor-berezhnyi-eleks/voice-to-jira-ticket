namespace VoiceToTicket.Api.Features.Tickets.Contract;

/// <param name="Language">ISO 639-1 code (two lower-case letters) of the language the ticket text is written in, for example <c>en</c> or <c>uk</c>. Listed second so the model states it before it writes the fields.</param>
/// <param name="Bug">Set only when <paramref name="Type"/> is <see cref="TicketType.Bug"/>.</param>
/// <param name="Feature">Set only when <paramref name="Type"/> is <see cref="TicketType.Feature"/>.</param>
public sealed record Ticket(
    TicketType Type,
    string Language,
    string Title,
    string Description,
    BugDetails? Bug,
    FeatureDetails? Feature,
    IReadOnlyList<MissingInformation> MissingInformation);
