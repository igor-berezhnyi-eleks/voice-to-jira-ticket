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
using VoiceToTicket.Api.Features.Jira.Contract;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Tests.Jira;

/// <summary>The Jira address typed by the user and checked against <c>Jira:AllowedHosts</c> (J9), through the whole pipeline.</summary>
public sealed class JiraAddressEndpointTests
{
    private readonly ManualTimeProvider time = new(new DateTimeOffset(2026, 11, 18, 9, 0, 0, TimeSpan.Zero));

    private static readonly Dictionary<string, string?> Allowlist = new()
    {
        ["Jira:AllowedHosts:0"] = "*.atlassian.net",
        ["Jira:AllowedHosts:1"] = "jira.company.com",
    };

    [Fact]
    public async Task An_allowed_address_is_normalized_stored_and_used_for_the_call()
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake, Allowlist);
        using var client = NewClient(factory);

        var response = await Connect(client, "  https://Example.Atlassian.NET/  ");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("https://example.atlassian.net", fake.LastCredentials!.SiteUrl);
        var status = await GetStatus(client, CookieOf(response));
        Assert.Equal("https://example.atlassian.net", status.GetProperty("siteUrl").GetString());
    }

    [Fact]
    public async Task A_company_address_with_a_port_and_path_is_allowed_by_its_exact_host()
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake, Allowlist);
        using var client = NewClient(factory);

        var response = await Connect(client, "https://jira.company.com:8443/jira");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("https://jira.company.com:8443/jira", fake.LastCredentials!.SiteUrl);
    }

    [Theory]
    [InlineData("https://evil.example.com")]
    [InlineData("https://atlassian.net")]
    [InlineData("https://example.atlassian.net.evil.com")]
    [InlineData("https://sub.jira.company.com")]
    [InlineData("http://example.atlassian.net")]
    [InlineData("example.atlassian.net")]
    [InlineData("https://user:pw@example.atlassian.net")]
    [InlineData("https://example.atlassian.net?next=https://evil.com")]
    [InlineData("https://example.atlassian.net#frag")]
    [InlineData("https://localhost")]
    [InlineData("https://127.0.0.1")]
    [InlineData("https://[::1]")]
    [InlineData("https://169.254.169.254")]
    [InlineData("https://10.0.0.5:8443")]
    [InlineData("file:///etc/passwd")]
    public async Task An_address_off_the_allowlist_is_400_validation_with_no_call_and_no_cookie(string address)
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake, Allowlist);
        using var client = NewClient(factory);

        var response = await Connect(client, address);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await ReadJson(response);
        Assert.Equal(ErrorCodes.Validation, body.GetProperty("code").GetString());
        Assert.Equal(0, fake.Calls);
        Assert.False(response.Headers.Contains("Set-Cookie"));
    }

    [Fact]
    public async Task An_internal_host_is_allowed_only_when_listed_exactly()
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake, new() { ["Jira:AllowedHosts:0"] = "localhost" });
        using var client = NewClient(factory);

        Assert.Equal(HttpStatusCode.OK, (await Connect(client, "https://localhost:9443")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Connect(client, "https://127.0.0.1:9443")).StatusCode);
    }

    [Fact]
    public async Task Without_an_address_the_configured_default_is_used()
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake, new() { ["Jira:BaseUrl"] = "https://jira.test" });
        using var client = NewClient(factory);

        var response = await Connect(client, null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("https://jira.test", fake.LastCredentials!.SiteUrl);
    }

    [Fact]
    public async Task Without_an_address_and_without_a_default_it_is_400_validation()
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake, Allowlist);
        using var client = NewClient(factory);

        var response = await Connect(client, null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(ErrorCodes.Validation, (await ReadJson(response)).GetProperty("code").GetString());
        Assert.Equal(0, fake.Calls);
    }

    [Fact]
    public async Task With_only_a_base_url_configured_only_its_host_is_allowed()
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake, new() { ["Jira:BaseUrl"] = "https://jira.test" });
        using var client = NewClient(factory);

        Assert.Equal(HttpStatusCode.OK, (await Connect(client, "https://jira.test")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Connect(client, "https://other.test")).StatusCode);
    }

    [Fact]
    public async Task Status_lists_the_default_the_allowed_hosts_and_no_site_before_connecting()
    {
        using var factory = Create(new FakeJiraClient(), new(Allowlist) { ["Jira:BaseUrl"] = "https://example.atlassian.net" });
        using var client = NewClient(factory);

        var status = await GetStatus(client);

        Assert.Equal(JsonValueKind.Null, status.GetProperty("siteUrl").ValueKind);
        Assert.Equal("https://example.atlassian.net", status.GetProperty("defaultSiteUrl").GetString());
        Assert.Equal(["*.atlassian.net", "jira.company.com"], status.GetProperty("allowedHosts").EnumerateArray().Select(host => host.GetString()));
    }

    [Fact]
    public async Task Status_has_no_default_when_only_an_allowlist_is_configured_and_lists_the_base_url_host_otherwise()
    {
        using var factory = Create(new FakeJiraClient(), Allowlist);
        using var client = NewClient(factory);
        var status = await GetStatus(client);
        Assert.Equal(JsonValueKind.Null, status.GetProperty("defaultSiteUrl").ValueKind);

        using var baseOnly = Create(new FakeJiraClient(), new() { ["Jira:BaseUrl"] = "https://jira.test" });
        using var baseClient = NewClient(baseOnly);
        var baseStatus = await GetStatus(baseClient);
        Assert.Equal(["jira.test"], baseStatus.GetProperty("allowedHosts").EnumerateArray().Select(host => host.GetString()));
    }

    [Fact]
    public async Task Later_calls_use_the_session_address_and_ignore_one_in_the_request()
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake, Allowlist);
        using var client = NewClient(factory);
        var cookie = CookieOf(await Connect(client, "https://example.atlassian.net"));

        using var search = new HttpRequestMessage(HttpMethod.Post, "/api/jira/issues/search")
        {
            Content = new StringContent(
                """{"projectKey":"SCRUM","query":"login","siteUrl":"https://jira.company.com"}""",
                Encoding.UTF8,
                "application/json"),
        };
        search.Headers.Add("Cookie", $"vtt_jira={cookie}");
        await client.SendAsync(search, Ct);
        using var projects = new HttpRequestMessage(HttpMethod.Get, "/api/jira/projects?siteUrl=https://jira.company.com");
        projects.Headers.Add("Cookie", $"vtt_jira={cookie}");
        await client.SendAsync(projects, Ct);

        Assert.Equal("https://example.atlassian.net", fake.LastCredentials!.SiteUrl);
    }

    [Fact]
    public async Task The_created_issue_link_uses_the_session_address()
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake, Allowlist);
        using var client = NewClient(factory);
        var cookie = CookieOf(await Connect(client, "https://jira.company.com:8443/jira"));
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/jira/issues")
        {
            Content = new StringContent(
                """{"projectKey":"SCRUM","issueTypeId":"10004","summary":"S","description":"D","fields":{},"links":[],"siteUrl":"https://evil.example.com"}""",
                Encoding.UTF8,
                "application/json"),
        };
        request.Headers.Add("Cookie", $"vtt_jira={cookie}");

        var body = await ReadJson(await client.SendAsync(request, Ct));

        Assert.Equal("https://jira.company.com:8443/jira/browse/SCRUM-124", body.GetProperty("url").GetString());
    }

    [Fact]
    public async Task Logs_hold_neither_the_secret_nor_the_path_of_the_address()
    {
        var logs = new LogCollector();
        using var factory = Create(new FakeJiraClient(), Allowlist, logs);
        using var client = NewClient(factory);

        await Connect(client, "https://jira.company.com:8443/secret-context");

        Assert.Contains(logs.Entries, entry => entry.Contains("Connected to Jira"));
        foreach (var entry in logs.Entries)
        {
            Assert.DoesNotContain("secret-token", entry);
            Assert.DoesNotContain("secret-context", entry);
        }
    }

    private WebApplicationFactory<Program> Create(IJiraClient fake, Dictionary<string, string?> settings, LogCollector? logs = null) =>
        new ApiFactory().WithWebHostBuilder(builder =>
        {
            // Development settings have a BaseUrl of their own; start from none so each test says what it needs.
            var merged = new Dictionary<string, string?>(settings) { ["Jira:Enabled"] = "true" };
            merged.TryAdd("Jira:BaseUrl", "");
            builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(merged));
            if (logs is not null)
            {
                builder.ConfigureLogging(logging =>
                {
                    logging.SetMinimumLevel(LogLevel.Trace);
                    logging.AddProvider(logs);
                });
            }

            builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<TimeProvider>(time);
                services.AddSingleton(fake);
            });
        });

    private static HttpClient NewClient(WebApplicationFactory<Program> factory) =>
        factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    private static Task<HttpResponseMessage> Connect(HttpClient client, string? siteUrl) =>
        client.PostAsJsonAsync("/api/jira/session", new JiraSessionRequest("dev@example.com", "secret-token", siteUrl), Ct);

    private static string CookieOf(HttpResponseMessage response)
    {
        var header = Assert.Single(response.Headers.GetValues("Set-Cookie"));
        return header["vtt_jira=".Length..header.IndexOf(';')];
    }

    private static async Task<JsonElement> GetStatus(HttpClient client, string? cookie = null)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/jira/status");
        if (cookie is not null)
        {
            request.Headers.Add("Cookie", $"vtt_jira={cookie}");
        }

        return await ReadJson(await client.SendAsync(request, Ct));
    }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement.Clone();
}
