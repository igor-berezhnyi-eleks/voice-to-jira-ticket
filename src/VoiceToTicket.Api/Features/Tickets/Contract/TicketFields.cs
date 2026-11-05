namespace VoiceToTicket.Api.Features.Tickets.Contract;

/// <summary>The gap marker and the field paths accepted in <see cref="MissingInformation.Field"/>.</summary>
public static class TicketFields
{
    /// <summary>The exact value of a string field the speaker gave no information for.</summary>
    public const string NotProvided = "Not provided";

    public const string Title = "title";
    public const string Description = "description";

    public const string BugStepsToReproduce = "bug.stepsToReproduce";
    public const string BugActualResult = "bug.actualResult";
    public const string BugExpectedResult = "bug.expectedResult";
    public const string BugEnvironment = "bug.environment";

    public const string FeatureUserNeed = "feature.userNeed";
    public const string FeatureProposedBehavior = "feature.proposedBehavior";
    public const string FeatureAcceptanceCriteria = "feature.acceptanceCriteria";

    private static readonly string[] BugFields =
    [
        Title,
        Description,
        BugStepsToReproduce,
        BugActualResult,
        BugExpectedResult,
        BugEnvironment,
    ];

    private static readonly string[] FeatureFields =
    [
        Title,
        Description,
        FeatureUserNeed,
        FeatureProposedBehavior,
        FeatureAcceptanceCriteria,
    ];

    /// <summary>The paths that exist on a ticket of this type.</summary>
    public static IReadOnlyList<string> For(TicketType type) => type switch
    {
        TicketType.Bug => BugFields,
        TicketType.Feature => FeatureFields,
        _ => [],
    };
}
