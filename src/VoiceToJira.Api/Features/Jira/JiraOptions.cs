namespace VoiceToJira.Api.Features.Jira;

public sealed class JiraOptions
{
    public const string SectionName = "Jira";

    // Ticket type (Bug, Feature) → Jira issue type name.
    public Dictionary<string, string> IssueTypeMap { get; set; } = [];

    // Link type name used to connect a Bug to a Story.
    public string LinkTypeName { get; set; } = "Relates";

    public string IssueType(string ticketType) =>
        IssueTypeMap.TryGetValue(ticketType, out var name) && !string.IsNullOrWhiteSpace(name)
            ? name
            : ticketType == "Feature" ? "Story" : ticketType;
}
