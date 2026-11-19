namespace VoiceToTicket.Api.Features.Jira;

/// <summary>
/// What a Jira call needs: Cloud email + API token, Server login + password or token, and the site the user connected to.
/// <paramref name="Login"/> is empty for a Server Bearer token. <paramref name="SiteUrl"/> is a normalized, allowlisted
/// address (<see cref="JiraSiteAddress"/>) taken from the session cookie, never from a request. Never logged and never
/// returned to the browser (the site URL is returned by <c>status</c> only).
/// </summary>
public sealed record JiraCredentials(string Login, string Secret, string SiteUrl, string? DisplayName = null)
{
    public override string ToString() => nameof(JiraCredentials);
}

/// <summary>The part of <c>GET /rest/api/2/myself</c> the app uses.</summary>
public sealed record JiraUser(string DisplayName);
