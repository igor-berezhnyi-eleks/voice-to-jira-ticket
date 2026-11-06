namespace VoiceToJira.Api.Features.Jira;

public sealed class JiraOptions
{
    public const string SectionName = "Jira";

    // Optional until the Jira integration (stretch) is used.
    public string BaseUrl { get; set; } = string.Empty;

    public string? CaCertPath { get; set; }

    // Ticket type (Bug, Feature) → Jira issue type name.
    public Dictionary<string, string> IssueTypeMap { get; set; } = [];

    public bool HasValidBaseUrl() =>
        string.IsNullOrEmpty(BaseUrl)
        || (Uri.TryCreate(BaseUrl, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps));
}
