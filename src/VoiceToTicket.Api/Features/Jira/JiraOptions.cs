namespace VoiceToTicket.Api.Features.Jira;

/// <summary>
/// Jira settings (jira-plan section 5). When Jira is enabled, either <see cref="BaseUrl"/> or <see cref="AllowedHosts"/>
/// is required: the user types the address, and only an allowed host is called. Everything else is a suggestion or a default.
/// </summary>
public sealed class JiraOptions
{
    public const string SectionName = "Jira";
    public const string InvalidMessage =
        $"When Jira is enabled, {SectionName}:{nameof(BaseUrl)} must be an absolute https URL or {SectionName}:{nameof(AllowedHosts)} must list hosts (exact like jira.company.com, or *.atlassian.net; no scheme, port or path), and the {nameof(BaseUrl)} host must be on that list. {nameof(Deployment)} must be Cloud or Server, {nameof(ServerAuthScheme)} must be Bearer or Basic, and {nameof(TimeoutSeconds)} and {nameof(SessionHours)} must be positive.";

    public static readonly IReadOnlyList<string> DefaultBugTypes = ["Bug", "Defect"];
    public static readonly IReadOnlyList<string> DefaultFeatureTypes = ["Story", "Feature", "Task"];

    public bool Enabled { get; set; }

    /// <summary>Cloud (email + API token, the default) or Server (self-hosted Jira Server / Data Center; jira-plan section 14).</summary>
    public JiraDeployment Deployment { get; set; } = JiraDeployment.Cloud;

    /// <summary>Server only: how the secret is sent. Bearer (token only, the default) or Basic (login + password).</summary>
    public JiraServerAuthScheme ServerAuthScheme { get; set; } = JiraServerAuthScheme.Bearer;

    /// <summary>The address shown in the Connect panel by default. Optional when <see cref="AllowedHosts"/> is set.</summary>
    public string? BaseUrl { get; set; }

    /// <summary>
    /// Hosts the app may call: exact (<c>jira.company.com</c>) or a leading wildcard (<c>*.atlassian.net</c>). When empty,
    /// only the <see cref="BaseUrl"/> host is allowed.
    /// </summary>
    public string[]? AllowedHosts { get; set; }

    public string? DefaultProjectKey { get; set; }

    public PreferredIssueTypeOptions PreferredIssueTypes { get; set; } = new();

    public string DefaultLinkType { get; set; } = "Relates";

    public int TimeoutSeconds { get; set; } = 15;

    public int SessionHours { get; set; } = 8;

    /// <summary>The normalized <see cref="BaseUrl"/> (https, no trailing slash), or null when it is not set or not valid.</summary>
    public string? DefaultSiteUrl => JiraSiteAddress.Normalize(BaseUrl);

    /// <summary>The configured, non-blank host patterns; the <see cref="BaseUrl"/> host alone when none are configured.</summary>
    public IReadOnlyList<string> EffectiveAllowedHosts
    {
        get
        {
            var configured = AllowedHosts?.Where(host => !string.IsNullOrWhiteSpace(host)).Select(host => host.Trim()).ToArray() ?? [];
            if (configured.Length > 0)
            {
                return configured;
            }

            return DefaultSiteUrl is { } site ? [new Uri(site).Host] : [];
        }
    }

    public bool IsServer => Deployment == JiraDeployment.Server;

    /// <summary>True when the secret is sent as a Bearer token: Server mode with <see cref="JiraServerAuthScheme.Bearer"/>.</summary>
    public bool IsBearer => IsServer && ServerAuthScheme == JiraServerAuthScheme.Bearer;

    public bool IsValid()
    {
        if (!Enabled)
        {
            return true;
        }

        var hosts = EffectiveAllowedHosts;
        var baseUrlOk = string.IsNullOrWhiteSpace(BaseUrl) ? hosts.Count > 0 : DefaultSiteUrl is { } site && JiraSiteAddress.IsAllowed(site, hosts);
        return Enum.IsDefined(Deployment)
            && Enum.IsDefined(ServerAuthScheme)
            && hosts.All(JiraSiteAddress.IsValidPattern)
            && baseUrlOk
            && TimeoutSeconds > 0
            && SessionHours > 0;
    }
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
