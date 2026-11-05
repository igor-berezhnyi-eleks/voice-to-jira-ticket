namespace VoiceToTicket.Api.Features.Tickets.Contract;

public sealed record FeatureDetails(
    string UserNeed,
    string ProposedBehavior,
    IReadOnlyList<string> AcceptanceCriteria);
