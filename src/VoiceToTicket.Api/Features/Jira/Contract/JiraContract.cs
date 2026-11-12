using System.ComponentModel.DataAnnotations;

namespace VoiceToTicket.Api.Features.Jira.Contract;

/// <param name="Enabled">False when <c>Jira:Enabled</c> is off: the web keeps the Jira button disabled.</param>
/// <param name="Connected">True when the request carries a valid, unexpired Jira session cookie. Jira is not called.</param>
public sealed record JiraStatus(bool Enabled, bool Connected, string? DisplayName, string? DefaultProjectKey);

public sealed record JiraSessionRequest(
    [Required, StringLength(320)] string Email,
    [Required, StringLength(2048)] string ApiToken);

public sealed record JiraSessionResponse(string DisplayName);
