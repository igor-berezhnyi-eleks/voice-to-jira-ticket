using System.Text;
using System.Text.RegularExpressions;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Features.Jira;

/// <summary>A JQL query, plus the issue key to look up separately when the text looks like one.</summary>
public sealed record JqlQuery(string Jql, string? Key);

/// <summary>
/// Builds the issue-search JQL from fixed parts (jira-plan 4.5). Pure. A project key and type ids are checked, search
/// text is cleaned and escaped. A key-shaped text is returned as <see cref="JqlQuery.Key"/> instead of a
/// <c>key = ...</c> clause, because Jira rejects a query that names a key that does not exist.
/// </summary>
public static partial class JqlBuilder
{
    public const int MaxQueryLength = 100;

    [GeneratedRegex("^[A-Z][A-Z0-9_]+$")]
    private static partial Regex ProjectKeyPattern();

    [GeneratedRegex(@"^[A-Za-z][A-Za-z0-9_]+-\d+$")]
    private static partial Regex KeyPattern();

    [GeneratedRegex(@"^\d{1,18}$")]
    private static partial Regex NumericIdPattern();

    public static bool IsIssueKey(string text) => KeyPattern().IsMatch(text);

    public static bool IsProjectKey(string text) => ProjectKeyPattern().IsMatch(text);

    public static bool IsNumericId(string text) => NumericIdPattern().IsMatch(text);

    public static JqlQuery Build(string? projectKey, IReadOnlyList<string>? issueTypeIds, string? query)
    {
        if (!string.IsNullOrWhiteSpace(projectKey) && !ProjectKeyPattern().IsMatch(projectKey))
        {
            throw Invalid("The project key is not valid.");
        }

        var typeIds = issueTypeIds ?? [];
        if (typeIds.Any(id => !NumericIdPattern().IsMatch(id)))
        {
            throw Invalid("An issue type id is not valid.");
        }

        var text = Clean(query);
        var hasProject = !string.IsNullOrWhiteSpace(projectKey);
        if (!hasProject && text.Length == 0)
        {
            throw Invalid("Give a project or some search text.");
        }

        var clauses = new List<string>();
        if (hasProject)
        {
            clauses.Add($"project = \"{projectKey}\"");
        }

        if (typeIds.Count > 0)
        {
            clauses.Add($"issuetype in ({string.Join(", ", typeIds)})");
        }

        if (text.Length > 0)
        {
            clauses.Add($"summary ~ \"{Escape(text)}*\"");
        }

        var key = !string.IsNullOrWhiteSpace(query) && IsIssueKey(query.Trim()) ? query.Trim().ToUpperInvariant() : null;
        return new JqlQuery(string.Join(" AND ", clauses) + " ORDER BY updated DESC", key);
    }

    // Text-search characters that would act as operators or wildcards become spaces. Atlassian notes that escaped
    // special characters are not searchable reliably, so they are not worth keeping.
    private static string Clean(string? query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return "";
        }

        var builder = new StringBuilder();
        foreach (var character in query.Trim())
        {
            builder.Append("+-&|!(){}[]^~*?:".Contains(character) || char.IsControl(character) ? ' ' : character);
        }

        var cleaned = string.Join(' ', builder.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries));
        return cleaned.Length <= MaxQueryLength ? cleaned : cleaned[..MaxQueryLength].TrimEnd();
    }

    private static string Escape(string text) => text.Replace("\\", "\\\\").Replace("\"", "\\\"");

    private static ApiException Invalid(string detail) =>
        new(StatusCodes.Status400BadRequest, ErrorCodes.Validation, "The request is not valid.", detail);
}
