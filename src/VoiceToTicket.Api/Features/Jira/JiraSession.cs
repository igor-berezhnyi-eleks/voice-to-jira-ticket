using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;

namespace VoiceToTicket.Api.Features.Jira;

/// <summary>
/// The Jira session: <c>{email, apiToken, issuedAt}</c> in one cookie, encrypted with Data Protection (jira-plan
/// section 3). Basic auth has no server-side session, so the credential has to come back with each request.
/// The cookie is a session cookie; its absolute lifetime is <c>Jira:SessionHours</c>, checked against
/// <c>issuedAt</c>. A tampered, unreadable or expired cookie is the same as no cookie.
/// </summary>
public sealed class JiraSession(
    IDataProtectionProvider dataProtection,
    IOptions<JiraOptions> options,
    TimeProvider timeProvider)
{
    public const string CookieName = "vtt_jira";
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
                || string.IsNullOrEmpty(payload.Email)
                || string.IsNullOrEmpty(payload.ApiToken)
                || timeProvider.GetUtcNow() - payload.IssuedAt >= TimeSpan.FromHours(options.Value.SessionHours)
                || payload.IssuedAt > timeProvider.GetUtcNow())
            {
                return null;
            }

            return new JiraCredentials(payload.Email, payload.ApiToken, payload.DisplayName);
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
        var payload = new SessionPayload(credentials.Email, credentials.ApiToken, timeProvider.GetUtcNow(), credentials.DisplayName);
        context.Response.Cookies.Append(CookieName, protector.Protect(JsonSerializer.Serialize(payload)), CookieOptions(context));
    }

    public void Clear(HttpContext context) => context.Response.Cookies.Delete(CookieName, CookieOptions(context));

    // Secure follows the request: the demo runs over http://localhost, a real deployment over https.
    private static CookieOptions CookieOptions(HttpContext context) => new()
    {
        HttpOnly = true,
        SameSite = SameSiteMode.Strict,
        Path = CookiePath,
        Secure = context.Request.IsHttps,
        IsEssential = true,
    };

    private sealed record SessionPayload(string Email, string ApiToken, DateTimeOffset IssuedAt, string? DisplayName);
}
