namespace VoiceToJira.Api.Features.Jira;

// BaseUrl is the Jira Cloud site the user typed at login, normalised to https://<site>.atlassian.net.
public sealed record JiraCredentials(string BaseUrl, string Email, string ApiToken)
{
    public static bool TryNormalizeBaseUrl(string? input, out string baseUrl)
    {
        baseUrl = string.Empty;
        var text = input?.Trim() ?? string.Empty;
        if (!text.Contains("://"))
        {
            text = "https://" + text;
        }

        // Only Atlassian Cloud hosts: the server sends the user's token to this address.
        if (!Uri.TryCreate(text, UriKind.Absolute, out var uri)
            || uri.Scheme != Uri.UriSchemeHttps
            || !uri.Host.EndsWith(".atlassian.net", StringComparison.OrdinalIgnoreCase)
            || uri.Host.Length == ".atlassian.net".Length)
        {
            return false;
        }

        baseUrl = $"https://{uri.Host.ToLowerInvariant()}";
        return true;
    }
}

public sealed record JiraBoard(int Id, string Name, string? ProjectKey);

public sealed record JiraIssueRef(string Key, string Summary);

public sealed record CreatedIssue(string Key, string Url, string? Warning);

public sealed record LoginRequest(string? BaseUrl, string? Email, string? ApiToken);

// IssueType is optional: when set (the user picked one), it replaces the configured Bug/Feature mapping.
public sealed record CreateIssueRequest(string? Type, string? Title, string? Description, string? ProjectKey, string? ParentKey, string? IssueType = null);

// Suggested is the project's issue type matching the configured mapping, or null when the user has to pick one.
public sealed record IssueTypeChoices(IReadOnlyList<string> Available, string? Suggested);

// A failed Jira call. Errors maps Jira field ids (summary, description, parent, ...) to messages.
public sealed class JiraException(int statusCode, string message, IReadOnlyDictionary<string, string>? errors = null) : Exception(message)
{
    public int StatusCode { get; } = statusCode;

    public IReadOnlyDictionary<string, string> Errors { get; } = errors ?? new Dictionary<string, string>();
}
