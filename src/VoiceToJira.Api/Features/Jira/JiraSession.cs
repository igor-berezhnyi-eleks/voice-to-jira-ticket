using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;

namespace VoiceToJira.Api.Features.Jira;

// Keeps the user's Jira username and password only in an encrypted HttpOnly cookie. Nothing is stored on the server.
public sealed class JiraSession(IDataProtectionProvider dataProtection)
{
    public const string CookieName = "jira_session";

    private readonly IDataProtector protector = dataProtection.CreateProtector("VoiceToJira.JiraSession");

    public void Write(HttpContext context, JiraCredentials credentials) =>
        context.Response.Cookies.Append(CookieName, protector.Protect($"{credentials.Username}\n{credentials.Password}"), new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Strict,
            Secure = context.Request.IsHttps,
            IsEssential = true,
        });

    public JiraCredentials? Read(HttpContext context)
    {
        if (!context.Request.Cookies.TryGetValue(CookieName, out var cookie))
        {
            return null;
        }

        try
        {
            var parts = protector.Unprotect(cookie).Split('\n', 2);
            return parts.Length == 2 ? new JiraCredentials(parts[0], parts[1]) : null;
        }
        catch (CryptographicException)
        {
            return null;
        }
    }

    public void Clear(HttpContext context) => context.Response.Cookies.Delete(CookieName);
}
