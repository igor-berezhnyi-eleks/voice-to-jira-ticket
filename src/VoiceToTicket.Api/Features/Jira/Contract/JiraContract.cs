using System.ComponentModel.DataAnnotations;

namespace VoiceToTicket.Api.Features.Jira.Contract;

/// <param name="Enabled">False when <c>Jira:Enabled</c> is off: the web keeps the Jira button disabled.</param>
/// <param name="Connected">True when the request carries a valid, unexpired Jira session cookie. Jira is not called.</param>
/// <param name="Deployment"><c>Cloud</c> or <c>Server</c>.</param>
/// <param name="AuthScheme"><c>Basic</c> (Cloud, or Server with a password) or <c>Bearer</c> (Server with a token): tells the Connect panel what to ask for.</param>
public sealed record JiraStatus(
    bool Enabled,
    bool Connected,
    string? DisplayName,
    string? DefaultProjectKey,
    string Deployment,
    string AuthScheme);

/// <param name="Login">Cloud email, or Server username. Empty for a Server Bearer token (checked by the endpoint).</param>
/// <param name="Secret">Cloud API token, or Server password or token.</param>
public sealed record JiraSessionRequest(
    [StringLength(320)] string? Login,
    [Required, StringLength(2048)] string Secret);

public sealed record JiraSessionResponse(string DisplayName);
