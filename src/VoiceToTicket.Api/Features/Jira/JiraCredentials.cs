namespace VoiceToTicket.Api.Features.Jira;

/// <summary>
/// What a Jira call needs: Cloud email + API token, Server login + password or token, the site the user connected to,
/// and the Jira type and sign-in the user chose (J10). <paramref name="Login"/> is empty for a Server Bearer token.
/// <paramref name="SiteUrl"/> is a normalized, allowlisted address (<see cref="JiraSiteAddress"/>), and
/// <paramref name="Deployment"/> and <paramref name="AuthScheme"/> are checked values; all three come from the session
/// cookie, never from a later request. Never logged and never returned to the browser (the site URL, the type and
/// the sign-in are returned by <c>status</c> only).
/// </summary>
public sealed record JiraCredentials(
    string Login,
    string Secret,
    string SiteUrl,
    string? DisplayName = null,
    JiraDeployment Deployment = JiraDeployment.Cloud,
    JiraServerAuthScheme AuthScheme = JiraServerAuthScheme.Basic)
{
    public bool IsServer => Deployment == JiraDeployment.Server;

    /// <summary>True when the secret is sent as a Bearer token: a Server session with <see cref="JiraServerAuthScheme.Bearer"/>.</summary>
    public bool IsBearer => IsServer && AuthScheme == JiraServerAuthScheme.Bearer;

    public override string ToString() => nameof(JiraCredentials);
}

/// <summary>The part of <c>GET /rest/api/2/myself</c> the app uses.</summary>
public sealed record JiraUser(string DisplayName);
