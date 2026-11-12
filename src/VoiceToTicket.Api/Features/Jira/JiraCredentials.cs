namespace VoiceToTicket.Api.Features.Jira;

/// <summary>What a Jira call needs to sign in. Never logged and never returned to the browser.</summary>
public sealed record JiraCredentials(string Email, string ApiToken, string? DisplayName = null)
{
    public override string ToString() => nameof(JiraCredentials);
}

/// <summary>The part of <c>GET /rest/api/2/myself</c> the app uses.</summary>
public sealed record JiraUser(string DisplayName);
