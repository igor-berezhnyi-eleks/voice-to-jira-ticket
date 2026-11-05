namespace VoiceToTicket.Api.Features.Tickets.Contract;

public sealed record BugDetails(
    IReadOnlyList<string> StepsToReproduce,
    string ActualResult,
    string ExpectedResult,
    string Environment);
