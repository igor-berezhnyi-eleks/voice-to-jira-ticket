using VoiceToTicket.Api.Features.Jira.Contract;

namespace VoiceToTicket.Api.Features.Jira;

/// <summary>An issue found by key, with the type id the search filters need.</summary>
public sealed record JiraIssueDetail(JiraIssueHit Hit, string IssueTypeId);

/// <summary>Calls to Jira Cloud with the user's own credentials. Failures are <see cref="JiraApiException"/>s.</summary>
public interface IJiraClient
{
    /// <summary>Checks the credentials (<c>GET /rest/api/2/myself</c>). A 401 is <c>jira_auth_denied</c>.</summary>
    Task<JiraUser> GetMyselfAsync(JiraCredentials credentials, CancellationToken cancellationToken);

    /// <summary>Projects the user can create issues in: the first page of 50 (<c>project/search?action=create</c>).</summary>
    Task<IReadOnlyList<JiraProject>> GetProjectsAsync(JiraCredentials credentials, CancellationToken cancellationToken);

    /// <summary>All issue types of a project, subtasks included: the first page of 50 (create metadata).</summary>
    Task<IReadOnlyList<JiraIssueTypeInfo>> GetIssueTypesAsync(JiraCredentials credentials, string projectKey, CancellationToken cancellationToken);

    /// <summary>Every field of the create screen for one issue type. Reads all pages and fails with <c>jira_unavailable</c> past 500 fields.</summary>
    Task<IReadOnlyList<CreateMetaField>> GetCreateFieldsAsync(
        JiraCredentials credentials,
        string projectKey,
        string issueTypeId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<JiraLinkType>> GetLinkTypesAsync(JiraCredentials credentials, CancellationToken cancellationToken);

    /// <summary>Enhanced JQL search (<c>POST search/jql</c>), at most 20 hits. The JQL goes in the body, never the URL.</summary>
    Task<IReadOnlyList<JiraIssueHit>> SearchIssuesAsync(JiraCredentials credentials, string jql, CancellationToken cancellationToken);

    /// <summary>One issue by key, or null when Jira answers 404.</summary>
    Task<JiraIssueDetail?> GetIssueAsync(JiraCredentials credentials, string issueKey, CancellationToken cancellationToken);
}
