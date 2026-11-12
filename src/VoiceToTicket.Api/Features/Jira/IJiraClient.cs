namespace VoiceToTicket.Api.Features.Jira;

/// <summary>Calls to Jira Cloud with the user's own credentials. Failures are <see cref="JiraApiException"/>s.</summary>
public interface IJiraClient
{
    /// <summary>Checks the credentials (<c>GET /rest/api/2/myself</c>). A 401 is <c>jira_auth_denied</c>.</summary>
    Task<JiraUser> GetMyselfAsync(JiraCredentials credentials, CancellationToken cancellationToken);
}
