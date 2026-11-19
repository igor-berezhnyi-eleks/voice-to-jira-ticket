using System.ComponentModel.DataAnnotations;

namespace VoiceToTicket.Api.Features.Jira.Contract;

/// <param name="Enabled">False when <c>Jira:Enabled</c> is off: the web keeps the Jira button disabled.</param>
/// <param name="Connected">True when the request carries a valid, unexpired Jira session cookie. Jira is not called.</param>
/// <param name="Deployment"><c>Cloud</c> or <c>Server</c>.</param>
/// <param name="SiteUrl">The Jira address of the current session (normalized), or null when not connected.</param>
/// <param name="DefaultSiteUrl">The address from <c>Jira:BaseUrl</c> to pre-fill the Connect panel, or null when none is configured.</param>
/// <param name="AllowedHosts">The host patterns the server accepts (<c>Jira:AllowedHosts</c>, or the <c>BaseUrl</c> host), shown as a hint.</param>
/// <param name="AuthScheme"><c>Basic</c> (Cloud, or Server with a password) or <c>Bearer</c> (Server with a token): tells the Connect panel what to ask for.</param>
public sealed record JiraStatus(
    bool Enabled,
    bool Connected,
    string? DisplayName,
    string? DefaultProjectKey,
    string Deployment,
    string AuthScheme,
    string? SiteUrl,
    string? DefaultSiteUrl,
    string[] AllowedHosts);

/// <param name="Login">Cloud email, or Server username. Empty for a Server Bearer token (checked by the endpoint).</param>
/// <param name="Secret">Cloud API token, or Server password or token.</param>
/// <param name="SiteUrl">The Jira address the user typed. Empty means <c>Jira:BaseUrl</c>. It must be https and on the allowlist; later calls use the address stored in the session, never one from a request.</param>
public sealed record JiraSessionRequest(
    [StringLength(320)] string? Login,
    [Required, StringLength(2048)] string Secret,
    [StringLength(2048)] string? SiteUrl = null);

public sealed record JiraSessionResponse(string DisplayName);
