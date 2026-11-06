using System.Text.Json.Serialization;

namespace VoiceToJira.Api.Features.Tickets;

[JsonConverter(typeof(JsonStringEnumConverter<TicketType>))]
public enum TicketType
{
    Bug,
    Feature,
}

// The ticket returned by the API: flat JSON with "type" as the discriminator, e.g.
// {"type":"Bug","title":...,"stepsToReproduce":[...],...,"missingInformation":[...]}.
[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(BugTicket), "Bug")]
[JsonDerivedType(typeof(FeatureTicket), "Feature")]
public abstract record Ticket
{
    [JsonIgnore]
    public TicketType Type => this is BugTicket ? TicketType.Bug : TicketType.Feature;

    // Orders keep the JSON in contract order: title, description, type-specific fields, missingInformation.
    [JsonPropertyOrder(-2)]
    public string Title { get; init; } = string.Empty;

    [JsonPropertyOrder(-1)]
    public string Description { get; init; } = string.Empty;

    // Field names (camelCase) left empty. Computed in code, never by the model.
    [JsonPropertyOrder(1)]
    public IReadOnlyList<string> MissingInformation { get; init; } = [];
}

public sealed record BugTicket : Ticket
{
    public IReadOnlyList<string> StepsToReproduce { get; init; } = [];
    public string ActualResult { get; init; } = string.Empty;
    public string ExpectedResult { get; init; } = string.Empty;
    public string Environment { get; init; } = string.Empty;
}

public sealed record FeatureTicket : Ticket
{
    public string UserOrBusinessNeed { get; init; } = string.Empty;
    public IReadOnlyList<string> AcceptanceCriteria { get; init; } = [];
}

// What Claude returns (see TicketPrompt.Schema): nested so the schema can fix each type's fields.
// Exactly one of Bug / Feature is set, the one matching Type (enforced by TicketValidator).
public sealed record ClaudeTicketOutput
{
    public required TicketType Type { get; init; }
    public BugTicket? Bug { get; init; }
    public FeatureTicket? Feature { get; init; }
}

public sealed record GenerateTicketRequest(string? Transcript);
