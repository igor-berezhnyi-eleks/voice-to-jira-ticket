namespace VoiceToTicket.Api.Features.Jira;

/// <summary>
/// Jira Cloud settings (jira-plan section 5). Only <see cref="BaseUrl"/> is required, and only when Jira is enabled.
/// Everything else is a suggestion or a default.
/// </summary>
public sealed class JiraOptions
{
    public const string SectionName = "Jira";
    public const string InvalidMessage =
        $"{SectionName}:{nameof(BaseUrl)} must be an absolute https URL when Jira is enabled, {nameof(Deployment)} must be Cloud or Server, {nameof(ServerAuthScheme)} must be Bearer or Basic, and {nameof(TimeoutSeconds)} and {nameof(SessionHours)} must be positive.";

    public static readonly IReadOnlyList<string> DefaultBugTypes = ["Bug", "Defect"];
    public static readonly IReadOnlyList<string> DefaultFeatureTypes = ["Story", "Feature", "Task"];

    public bool Enabled { get; set; }

    /// <summary>Cloud (email + API token, the default) or Server (self-hosted Jira Server / Data Center; jira-plan section 14).</summary>
    public JiraDeployment Deployment { get; set; } = JiraDeployment.Cloud;

    /// <summary>Server only: how the secret is sent. Bearer (token only, the default) or Basic (login + password).</summary>
    public JiraServerAuthScheme ServerAuthScheme { get; set; } = JiraServerAuthScheme.Bearer;

    public string? BaseUrl { get; set; }

    public string? DefaultProjectKey { get; set; }

    public PreferredIssueTypeOptions PreferredIssueTypes { get; set; } = new();

    public string DefaultLinkType { get; set; } = "Relates";

    public int TimeoutSeconds { get; set; } = 15;

    public int SessionHours { get; set; } = 8;

    /// <summary>The site URL without a trailing slash, for building links. Only call it when <see cref="Enabled"/> is true.</summary>
    public string SiteUrl => BaseUrl!.TrimEnd('/');

    public bool IsServer => Deployment == JiraDeployment.Server;

    /// <summary>True when the secret is sent as a Bearer token: Server mode with <see cref="JiraServerAuthScheme.Bearer"/>.</summary>
    public bool IsBearer => IsServer && ServerAuthScheme == JiraServerAuthScheme.Bearer;

    public bool IsValid() =>
        !Enabled
        || (Enum.IsDefined(Deployment)
            && Enum.IsDefined(ServerAuthScheme)
            && Uri.TryCreate(BaseUrl, UriKind.Absolute, out var uri)
            && uri.Scheme == Uri.UriSchemeHttps
            && TimeoutSeconds > 0
            && SessionHours > 0);
}

public enum JiraDeployment
{
    Cloud,
    Server,
}

public enum JiraServerAuthScheme
{
    Bearer,
    Basic,
}

/// <summary>
/// Names tried in order, case-insensitive. The properties are null when not configured, so the defaults apply;
/// a configured list replaces the default instead of adding to it (the configuration binder would append to a
/// list that already has items). A configured empty value means "no preference".
/// </summary>
public sealed class PreferredIssueTypeOptions
{
    public string[]? Bug { get; set; }

    public string[]? Feature { get; set; }

    public IReadOnlyList<string> BugNames => Clean(Bug) ?? JiraOptions.DefaultBugTypes;

    public IReadOnlyList<string> FeatureNames => Clean(Feature) ?? JiraOptions.DefaultFeatureTypes;

    private static string[]? Clean(string[]? names) =>
        names?.Where(name => !string.IsNullOrWhiteSpace(name)).Select(name => name.Trim()).ToArray();
}
