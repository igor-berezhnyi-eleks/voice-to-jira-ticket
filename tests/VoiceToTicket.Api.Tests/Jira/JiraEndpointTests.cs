using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using VoiceToTicket.Api.Features.Jira;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Tests.Jira;

/// <summary>The Jira session endpoints through the whole pipeline, with a fake Jira client.</summary>
public sealed class JiraEndpointTests
{
    private static readonly DateTimeOffset Start = new(2026, 11, 12, 9, 0, 0, TimeSpan.Zero);
    private const string Body = """{"email": "dev@example.com", "apiToken": "secret-token"}""";

    private readonly ManualTimeProvider time = new(Start);

    [Fact]
    public async Task Status_says_disabled_when_Jira_is_off_and_does_not_call_Jira()
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake, enabled: false);
        using var client = NewClient(factory);

        var status = await GetStatus(client);

        Assert.False(status.GetProperty("enabled").GetBoolean());
        Assert.False(status.GetProperty("connected").GetBoolean());
        Assert.Equal(0, fake.Calls);
    }

    [Fact]
    public async Task Session_and_delete_return_404_jira_not_configured_when_Jira_is_off()
    {
        using var factory = Create(new FakeJiraClient(), enabled: false);
        using var client = NewClient(factory);

        var post = await client.PostAsync("/api/jira/session", Json(Body), Ct);
        var delete = await client.DeleteAsync("/api/jira/session", Ct);

        foreach (var response in new[] { post, delete })
        {
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal(ErrorCodes.JiraNotConfigured, (await ReadJson(response)).GetProperty("code").GetString());
        }
    }

    [Fact]
    public async Task Status_before_connecting_is_enabled_and_not_connected_with_the_default_project()
    {
        using var factory = Create(new FakeJiraClient());
        using var client = NewClient(factory);

        var status = await GetStatus(client);

        Assert.True(status.GetProperty("enabled").GetBoolean());
        Assert.False(status.GetProperty("connected").GetBoolean());
        Assert.Equal(JsonValueKind.Null, status.GetProperty("displayName").ValueKind);
        Assert.Equal("SCRUM", status.GetProperty("defaultProjectKey").GetString());
    }

    [Fact]
    public async Task Connecting_returns_the_display_name_sets_the_cookie_and_status_then_says_connected()
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake);
        using var client = NewClient(factory);

        var response = await client.PostAsync("/api/jira/session", Json(Body), Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Ada Lovelace", (await ReadJson(response)).GetProperty("displayName").GetString());
        Assert.Equal(new JiraCredentials("dev@example.com", "secret-token"), fake.LastCredentials);

        var cookie = SetCookie(response);
        var header = cookie.Header.ToLowerInvariant();
        Assert.Contains("httponly", header);
        Assert.Contains("samesite=strict", header);
        Assert.Contains("path=/api/jira", header);
        Assert.DoesNotContain("secret-token", cookie.Header);
        Assert.DoesNotContain("dev@example.com", cookie.Header);

        var status = await GetStatus(client, cookie.Value);
        Assert.True(status.GetProperty("connected").GetBoolean());
        Assert.Equal("Ada Lovelace", status.GetProperty("displayName").GetString());
        Assert.Equal(1, fake.Calls); // status did not call Jira
    }

    [Fact]
    public async Task The_session_expires_after_the_session_hours()
    {
        using var factory = Create(new FakeJiraClient());
        using var client = NewClient(factory);
        var cookie = SetCookie(await client.PostAsync("/api/jira/session", Json(Body), Ct));

        time.Advance(TimeSpan.FromHours(7));
        Assert.True((await GetStatus(client, cookie.Value)).GetProperty("connected").GetBoolean());

        time.Advance(TimeSpan.FromHours(1));
        Assert.False((await GetStatus(client, cookie.Value)).GetProperty("connected").GetBoolean());
    }

    [Fact]
    public async Task A_tampered_cookie_is_not_a_session()
    {
        using var factory = Create(new FakeJiraClient());
        using var client = NewClient(factory);

        var status = await GetStatus(client, "tampered-value");

        Assert.False(status.GetProperty("connected").GetBoolean());
    }

    [Fact]
    public async Task Delete_returns_204_and_clears_the_cookie()
    {
        using var factory = Create(new FakeJiraClient());
        using var client = NewClient(factory);

        var response = await client.DeleteAsync("/api/jira/session", Ct);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var header = SetCookie(response).Header.ToLowerInvariant();
        Assert.Contains("expires=thu, 01 jan 1970", header);
        Assert.Contains("path=/api/jira", header);
    }

    [Fact]
    public async Task A_wrong_token_is_401_jira_auth_denied_and_stores_nothing()
    {
        using var factory = Create(new FailingJiraClient(() => new JiraApiException(401, ErrorCodes.JiraAuthDenied, "Denied.")));
        using var client = NewClient(factory);

        var response = await client.PostAsync("/api/jira/session", Json(Body), Ct);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(ErrorCodes.JiraAuthDenied, (await ReadJson(response)).GetProperty("code").GetString());
        Assert.False(response.Headers.Contains("Set-Cookie"));
    }

    [Fact]
    public async Task A_Jira_401_on_a_call_made_with_the_session_clears_the_cookie()
    {
        using var factory = Create(new FailingJiraClient(JiraErrors.AuthRequired));
        using var client = NewClient(factory);

        var response = await client.PostAsync("/api/jira/session", Json(Body), Ct);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(ErrorCodes.JiraAuthRequired, (await ReadJson(response)).GetProperty("code").GetString());
        var header = SetCookie(response).Header.ToLowerInvariant();
        Assert.Contains("expires=thu, 01 jan 1970", header);
        Assert.Contains("path=/api/jira", header);
    }

    [Fact]
    public async Task A_rejected_call_carries_the_field_errors_and_a_rate_limit_carries_the_retry_hint()
    {
        var errors = new Dictionary<string, string> { ["summary"] = "Required" };
        var rejected = new JiraApiException(422, ErrorCodes.JiraRejected, "Rejected.", extensions: new Dictionary<string, object?>
        {
            ["errors"] = errors,
            ["errorMessages"] = new List<string> { "Wrong type" },
        });
        using var factory = Create(new FailingJiraClient(() => rejected));
        using var client = NewClient(factory);

        var body = await ReadJson(await client.PostAsync("/api/jira/session", Json(Body), Ct));

        Assert.Equal("Required", body.GetProperty("errors").GetProperty("summary").GetString());
        Assert.Equal("Wrong type", body.GetProperty("errorMessages")[0].GetString());

        var limited = new JiraApiException(503, ErrorCodes.JiraRateLimited, "Busy.", extensions: new Dictionary<string, object?> { ["retryAfterSeconds"] = 30 });
        using var limitedFactory = Create(new FailingJiraClient(() => limited));
        using var limitedClient = NewClient(limitedFactory);

        var limitedBody = await ReadJson(await limitedClient.PostAsync("/api/jira/session", Json(Body), Ct));

        Assert.Equal(30, limitedBody.GetProperty("retryAfterSeconds").GetInt32());
    }

    [Fact]
    public async Task A_non_JSON_body_is_415()
    {
        using var factory = Create(new FakeJiraClient());
        using var client = NewClient(factory);

        var response = await client.PostAsync("/api/jira/session", new StringContent("email=a&apiToken=b", Encoding.UTF8, "application/x-www-form-urlencoded"), Ct);

        Assert.Equal(HttpStatusCode.UnsupportedMediaType, response.StatusCode);
    }

    [Theory]
    [InlineData("""{"email": "", "apiToken": "x"}""")]
    [InlineData("""{"email": "a@b.c", "apiToken": ""}""")]
    [InlineData("""{"email": "a@b.c"}""")]
    [InlineData("{}")]
    public async Task A_missing_email_or_token_is_400_validation(string body)
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake);
        using var client = NewClient(factory);

        var response = await client.PostAsync("/api/jira/session", Json(body), Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(ErrorCodes.Validation, (await ReadJson(response)).GetProperty("code").GetString());
        Assert.Equal(0, fake.Calls);
    }

    [Fact]
    public async Task No_log_entry_holds_the_token_the_email_or_the_authorization_header()
    {
        var logs = new LogCollector();
        var responses = new Queue<HttpStatusCode>([HttpStatusCode.Unauthorized, HttpStatusCode.OK, HttpStatusCode.InternalServerError]);
        var handler = new LambdaHandler(_ =>
        {
            var status = responses.Dequeue();
            return new HttpResponseMessage(status) { Content = new StringContent("""{"displayName": "Ada Lovelace"}""", Encoding.UTF8, "application/json") };
        });
        using var factory = new ApiFactory().WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration(configuration => configuration.AddInMemoryCollection(JiraSettings(true)));
            builder.ConfigureLogging(logging =>
            {
                logging.SetMinimumLevel(LogLevel.Trace);
                logging.AddProvider(logs);
            });
            builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<TimeProvider>(time);
                services.AddHttpClient<IJiraClient, JiraClient>().ConfigurePrimaryHttpMessageHandler(() => handler);
            });
        });
        using var client = NewClient(factory);

        foreach (var _ in Enumerable.Range(0, 3))
        {
            await client.PostAsync("/api/jira/session", Json(Body), Ct);
        }

        var basic = Convert.ToBase64String("dev@example.com:secret-token"u8.ToArray());
        Assert.NotEmpty(logs.Entries);
        Assert.Contains(logs.Entries, entry => entry.Contains("Jira answered"));
        foreach (var entry in logs.Entries)
        {
            Assert.DoesNotContain("secret-token", entry);
            Assert.DoesNotContain("dev@example.com", entry);
            Assert.DoesNotContain(basic, entry);
            Assert.DoesNotContain("Basic ", entry);
        }
    }

    private WebApplicationFactory<Program> Create(IJiraClient fake, bool enabled = true) =>
        new ApiFactory().WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration(configuration => configuration.AddInMemoryCollection(JiraSettings(enabled)));
            builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<TimeProvider>(time);
                services.AddSingleton(fake);
            });
        });

    private static Dictionary<string, string?> JiraSettings(bool enabled) => new()
    {
        ["Jira:Enabled"] = enabled ? "true" : "false",
        ["Jira:BaseUrl"] = "https://jira.test",
        ["Jira:DefaultProjectKey"] = "SCRUM",
    };

    private static HttpClient NewClient(WebApplicationFactory<Program> factory) =>
        factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static StringContent Json(string body) => new(body, Encoding.UTF8, "application/json");

    private static async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement.Clone();

    private static async Task<JsonElement> GetStatus(HttpClient client, string? cookieValue = null)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/jira/status");
        if (cookieValue is not null)
        {
            request.Headers.Add("Cookie", $"vtt_jira={cookieValue}");
        }

        return await ReadJson(await client.SendAsync(request, Ct));
    }

    private static (string Header, string Value) SetCookie(HttpResponseMessage response)
    {
        var header = Assert.Single(response.Headers.GetValues("Set-Cookie"));
        Assert.StartsWith("vtt_jira=", header);
        return (header, header["vtt_jira=".Length..header.IndexOf(';')]);
    }

    private sealed class LambdaHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(respond(request));
    }
}
