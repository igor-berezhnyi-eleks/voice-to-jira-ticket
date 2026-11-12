using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using VoiceToTicket.Api.Features.Jira;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Tests.Jira;

public sealed class JiraSessionTests
{
    private static readonly DateTimeOffset Start = new(2026, 11, 12, 9, 0, 0, TimeSpan.Zero);
    private static readonly JiraCredentials Credentials = new("dev@example.com", "secret-token", "Ada Lovelace");

    private readonly ManualTimeProvider time = new(Start);
    private readonly EphemeralDataProtectionProvider protection = new();

    [Fact]
    public void A_written_cookie_reads_back_the_credentials_and_name()
    {
        var session = CreateSession();

        var cookie = WriteCookie(session);
        var read = session.Read(RequestWith(cookie));

        Assert.Equal(Credentials, read);
    }

    [Fact]
    public void The_cookie_has_the_required_attributes()
    {
        var context = new DefaultHttpContext();
        CreateSession().Write(context, Credentials);

        var header = context.Response.Headers.SetCookie.ToString().ToLowerInvariant();

        Assert.StartsWith("vtt_jira=", header);
        Assert.Contains("httponly", header);
        Assert.Contains("samesite=strict", header);
        Assert.Contains("path=/api/jira", header);
        Assert.DoesNotContain("secure", header); // plain http
        Assert.DoesNotContain("expires", header); // a session cookie; the lifetime is checked server-side
        Assert.DoesNotContain("max-age", header);
    }

    [Fact]
    public void The_cookie_is_secure_on_https()
    {
        var context = new DefaultHttpContext();
        context.Request.Scheme = "https";
        CreateSession().Write(context, Credentials);

        Assert.Contains("secure", context.Response.Headers.SetCookie.ToString().ToLowerInvariant());
    }

    [Fact]
    public void The_cookie_value_holds_neither_the_token_nor_the_email_in_clear_text()
    {
        var cookie = WriteCookie(CreateSession());

        Assert.DoesNotContain("secret-token", cookie);
        Assert.DoesNotContain("dev@example.com", cookie);
        Assert.DoesNotContain("example.com", cookie);
        Assert.DoesNotContain("Ada", cookie);
        Assert.DoesNotContain(Convert.ToBase64String("dev@example.com:secret-token"u8.ToArray()), cookie);
    }

    [Fact]
    public void A_cookie_older_than_the_session_hours_is_treated_as_absent()
    {
        var session = CreateSession(sessionHours: 8);
        var cookie = WriteCookie(session);

        time.Advance(TimeSpan.FromHours(8).Subtract(TimeSpan.FromSeconds(1)));
        Assert.NotNull(session.Read(RequestWith(cookie)));

        time.Advance(TimeSpan.FromSeconds(1));
        Assert.Null(session.Read(RequestWith(cookie)));
    }

    [Fact]
    public void A_cookie_dated_in_the_future_is_treated_as_absent()
    {
        var session = CreateSession();
        var cookie = WriteCookie(session);

        time.Advance(TimeSpan.FromHours(-1));

        Assert.Null(session.Read(RequestWith(cookie)));
    }

    [Theory]
    [InlineData("")]
    [InlineData("garbage")]
    [InlineData("CfDJ8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")]
    public void An_unreadable_cookie_is_treated_as_absent(string value)
    {
        Assert.Null(CreateSession().Read(RequestWith(value)));
    }

    [Fact]
    public void A_tampered_cookie_is_treated_as_absent()
    {
        var session = CreateSession();
        var cookie = WriteCookie(session);
        var middle = cookie.Length / 2;
        var tampered = cookie[..middle] + (cookie[middle] == 'A' ? 'B' : 'A') + cookie[(middle + 1)..];

        Assert.Null(session.Read(RequestWith(tampered)));
    }

    [Fact]
    public void A_cookie_protected_by_another_key_ring_is_treated_as_absent()
    {
        var cookie = WriteCookie(CreateSession());
        var otherKeys = new JiraSession(new EphemeralDataProtectionProvider(), Options(8), time);

        Assert.Null(otherKeys.Read(RequestWith(cookie)));
    }

    [Fact]
    public void Require_throws_jira_auth_required_without_a_session()
    {
        var exception = Assert.Throws<JiraApiException>(() => CreateSession().Require(new DefaultHttpContext()));

        Assert.Equal((401, ErrorCodes.JiraAuthRequired), (exception.StatusCode, exception.Code));
    }

    [Fact]
    public void Clear_expires_the_cookie_on_the_same_path()
    {
        var context = new DefaultHttpContext();
        CreateSession().Clear(context);

        var header = context.Response.Headers.SetCookie.ToString().ToLowerInvariant();
        Assert.StartsWith("vtt_jira=;", header);
        Assert.Contains("path=/api/jira", header);
        Assert.Contains("expires=thu, 01 jan 1970", header);
    }

    private JiraSession CreateSession(int sessionHours = 8) => new(protection, Options(sessionHours), time);

    private static IOptions<JiraOptions> Options(int sessionHours) =>
        Microsoft.Extensions.Options.Options.Create(new JiraOptions { Enabled = true, BaseUrl = "https://jira.test", SessionHours = sessionHours });

    private static string WriteCookie(JiraSession session)
    {
        var context = new DefaultHttpContext();
        session.Write(context, Credentials);
        var header = context.Response.Headers.SetCookie.ToString();
        return header["vtt_jira=".Length..header.IndexOf(';')];
    }

    private static HttpContext RequestWith(string cookieValue)
    {
        var context = new DefaultHttpContext();
        context.Request.Headers.Cookie = $"vtt_jira={cookieValue}";
        return context;
    }
}
