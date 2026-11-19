using System.ComponentModel.DataAnnotations;

namespace VoiceToTicket.Api.Features.Jira.Contract;

/// <param name="Enabled">False when <c>Jira:Enabled</c> is off: the web keeps the Jira button disabled.</param>
/// <param name="Connected">True when the request carries a valid, unexpired Jira session cookie. Jira is not called.</param>
/// <param name="Deployment"><c>Cloud</c> or <c>Server</c>: the session's type when connected, otherwise <c>Jira:Deployment</c> (the Connect panel's default).</param>
/// <param name="SiteUrl">The Jira address of the current session (normalized), or null when not connected.</param>
/// <param name="DefaultSiteUrl">The address from <c>Jira:BaseUrl</c> to pre-fill the Connect panel, or null when none is configured.</param>
/// <param name="AllowedHosts">The host patterns the server accepts (<c>Jira:AllowedHosts</c>, or the <c>BaseUrl</c> host), shown as a hint.</param>
/// <param name="AuthScheme"><c>Basic</c> (Cloud, or Server with a password) or <c>Bearer</c> (Server with a token): the session's sign-in when connected, otherwise the default for <paramref name="Deployment"/>.</param>
/// <param name="DefaultServerAuthScheme"><c>Jira:ServerAuthScheme</c>: the sign-in the Connect panel starts with when the user picks Server.</param>
public sealed record JiraStatus(
    bool Enabled,
    bool Connected,
    string? DisplayName,
    string? DefaultProjectKey,
    string Deployment,
    string AuthScheme,
    string DefaultServerAuthScheme,
    string? SiteUrl,
    string? DefaultSiteUrl,
    string[] AllowedHosts);

/// <param name="Login">Cloud email, or Server username. Empty for a Server Bearer token (checked by the endpoint).</param>
/// <param name="Secret">Cloud API token, or Server password or token.</param>
/// <param name="SiteUrl">The Jira address the user typed. Empty means <c>Jira:BaseUrl</c>. It must be https and on the allowlist; later calls use the address stored in the session, never one from a request.</param>
/// <param name="Deployment"><c>Cloud</c> or <c>Server</c>. Empty means <c>Jira:Deployment</c>. Kept in the session like the address.</param>
/// <param name="AuthScheme"><c>Basic</c>, or <c>Bearer</c> (Server only). Empty means Basic on Cloud and <c>Jira:ServerAuthScheme</c> on Server.</param>
public sealed record JiraSessionRequest(
    [StringLength(320)] string? Login,
    [Required, StringLength(2048)] string Secret,
    [StringLength(2048)] string? SiteUrl = null,
    [StringLength(20)] string? Deployment = null,
    [StringLength(20)] string? AuthScheme = null);

public sealed record JiraSessionResponse(string DisplayName);
