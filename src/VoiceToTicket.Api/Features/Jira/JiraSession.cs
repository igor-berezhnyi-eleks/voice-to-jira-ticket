using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;

namespace VoiceToTicket.Api.Features.Jira;

/// <summary>
/// The Jira session: <c>{login, secret, siteUrl, deployment, authScheme, issuedAt}</c> in one cookie, encrypted with Data Protection (jira-plan
/// section 3). Basic auth has no server-side session, so the credential has to come back with each request.
/// The cookie is a session cookie; its absolute lifetime is <c>Jira:SessionHours</c>, checked against
/// <c>issuedAt</c>. A tampered, unreadable or expired cookie is the same as no cookie, and so is one whose site is no
/// longer on the allowlist. A cookie from before the address was chosen by the user has no site and gets
/// <c>Jira:BaseUrl</c>, or counts as no session when that is not set. A cookie from before the type was chosen per
/// session (J10) gets <c>Jira:Deployment</c> and <c>Jira:ServerAuthScheme</c>. An unknown type or sign-in, Cloud with
/// Bearer, or Basic without a login is no session.
/// </summary>
public sealed class JiraSession(
    IDataProtectionProvider dataProtection,
    IOptions<JiraOptions> options,
    TimeProvider timeProvider)
{
    public const string CookieName = "vtt_jira";
    /// <summary>The cookie's path below the app's <c>PathBase</c>: <c>/api/jira</c> locally, <c>/alt/api/jira</c> on the VM (D28).</summary>
    public const string CookiePath = "/api/jira";

    private readonly IDataProtector protector = dataProtection.CreateProtector("VoiceToTicket.Jira.Session.v1");

    public JiraCredentials? Read(HttpContext context)
    {
        if (!context.Request.Cookies.TryGetValue(CookieName, out var value) || string.IsNullOrEmpty(value))
        {
            return null;
        }

        try
        {
            var payload = JsonSerializer.Deserialize<SessionPayload>(protector.Unprotect(value));
            if (payload is null
                || string.IsNullOrEmpty(payload.Secret)
                || timeProvider.GetUtcNow() - payload.IssuedAt >= TimeSpan.FromHours(options.Value.SessionHours)
                || payload.IssuedAt > timeProvider.GetUtcNow())
            {
                return null;
            }

            var settings = options.Value;
            var siteUrl = payload.SiteUrl is null ? settings.DefaultSiteUrl : JiraSiteAddress.Normalize(payload.SiteUrl);
            if (siteUrl is null || !JiraSiteAddress.IsAllowed(siteUrl, settings.EffectiveAllowedHosts))
            {
                return null;
            }

            var deployment = settings.Deployment;
            if (payload.Deployment is not null && !JiraEnumNames.TryParse(payload.Deployment, out deployment))
            {
                return null;
            }

            var scheme = settings.DefaultAuthScheme(deployment);
            if (payload.AuthScheme is not null && !JiraEnumNames.TryParse(payload.AuthScheme, out scheme))
            {
                return null;
            }

            var login = payload.Login ?? "";
            var bearer = scheme == JiraServerAuthScheme.Bearer;
            if ((bearer && deployment == JiraDeployment.Cloud) || (!bearer && login.Length == 0))
            {
                return null;
            }

            return new JiraCredentials(bearer ? "" : login, payload.Secret, siteUrl, payload.DisplayName, deployment, scheme);
        }
        catch (Exception exception) when (exception is System.Security.Cryptography.CryptographicException or JsonException)
        {
            return null;
        }
    }

    /// <summary>The credentials of this request, or a <c>jira_auth_required</c> error.</summary>
    public JiraCredentials Require(HttpContext context) => Read(context) ?? throw JiraErrors.AuthRequired();

    public void Write(HttpContext context, JiraCredentials credentials)
    {
        var payload = new SessionPayload(
            credentials.Login,
            credentials.Secret,
            timeProvider.GetUtcNow(),
            credentials.DisplayName,
            credentials.SiteUrl,
            credentials.Deployment.ToString(),
            credentials.AuthScheme.ToString());
        context.Response.Cookies.Append(CookieName, protector.Protect(JsonSerializer.Serialize(payload)), CookieOptions(context));
    }

    public void Clear(HttpContext context) => context.Response.Cookies.Delete(CookieName, CookieOptions(context));

    // Secure follows the request: the demo runs over http://localhost, a real deployment over https. The path includes the
    // PathBase, so the browser sends the cookie only to this app's Jira routes, never to another app on the same origin.
    private static CookieOptions CookieOptions(HttpContext context) => new()
    {
        HttpOnly = true,
        SameSite = SameSiteMode.Strict,
        Path = context.Request.PathBase.Add(CookiePath).Value,
        Secure = context.Request.IsHttps,
        IsEssential = true,
    };

    // Deployment and AuthScheme are names (null in a cookie from before J10), so an unknown value is caught on read.
    private sealed record SessionPayload(
        string? Login,
        string? Secret,
        DateTimeOffset IssuedAt,
        string? DisplayName,
        string? SiteUrl = null,
        string? Deployment = null,
        string? AuthScheme = null);
}
