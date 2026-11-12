namespace VoiceToTicket.Api.Features.Jira;

/// <summary>The issue type to suggest for each ticket type; null when the project has none to suggest.</summary>
public sealed record IssueTypeSuggestion(string? BugTypeId, string? FeatureTypeId);

/// <summary>Picks a suggested issue type per ticket type from configured names (jira-plan 4.1). Pure.</summary>
public static class IssueTypeSuggester
{
    /// <param name="types">The creatable types (no subtasks), in Jira's order.</param>
    public static IssueTypeSuggestion Suggest(
        IReadOnlyList<JiraIssueTypeInfo> types,
        IReadOnlyList<string> bugNames,
        IReadOnlyList<string> featureNames)
    {
        // With nothing preferred, or no preferred name present, the first top-level type is the suggestion for both.
        var fallback = types.FirstOrDefault(type => type.HierarchyLevel == 0)?.Id;
        return new IssueTypeSuggestion(
            FirstNamed(types, bugNames) ?? fallback,
            FirstNamed(types, featureNames) ?? fallback);
    }

    private static string? FirstNamed(IReadOnlyList<JiraIssueTypeInfo> types, IReadOnlyList<string> names)
    {
        foreach (var name in names)
        {
            var match = types.FirstOrDefault(type => string.Equals(type.Name, name, StringComparison.OrdinalIgnoreCase));
            if (match is not null)
            {
                return match.Id;
            }
        }

        return null;
    }
}
