using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using VoiceToTicket.Api.Features.Jira;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Tests.Jira;

/// <summary>
/// J10: the Jira type (Cloud or Server) and the sign-in (Basic or Bearer) are chosen on connect and kept in the session.
/// <c>Jira:Deployment</c> and <c>Jira:ServerAuthScheme</c> are only the defaults.
/// </summary>
public sealed class JiraSessionTypeTests
{
    private const string CloudSite = "https://example.atlassian.net";
    private const string ServerSite = "https://jira.company.com";

    // ---------- connect validation

    [Theory]
    [InlineData("Cloud", "Bearer", "dev")]
    [InlineData("Banana", null, "dev")]
    [InlineData("1", null, "dev")]
    [InlineData("Server", "Token", "dev")]
    [InlineData("Server", "0", "dev")]
    [InlineData("Server", "Basic", "")]
    [InlineData("Cloud", "Basic", " ")]
    [InlineData("Cloud", null, null)]
    public async Task An_invalid_type_or_sign_in_or_a_missing_login_is_400_with_no_call_and_no_cookie(string? deployment, string? authScheme, string? login)
    {
        var fake = new FakeJiraClient();
        using var factory = WithFake(fake, JiraDeployment.Server, JiraServerAuthScheme.Bearer);

        var response = await NewClient(factory).PostAsJsonAsync(
            "/api/jira/session",
            new { siteUrl = ServerSite, deployment, authScheme, login, secret = "secret-token" },
            Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(ErrorCodes.Validation, (await ReadJson(response)).GetProperty("code").GetString());
        Assert.Equal(0, fake.Calls);
        Assert.False(response.Headers.Contains("Set-Cookie"));
    }

    [Theory]
    [InlineData(JiraDeployment.Cloud, JiraServerAuthScheme.Bearer, JiraDeployment.Cloud, JiraServerAuthScheme.Basic)]
    [InlineData(JiraDeployment.Server, JiraServerAuthScheme.Bearer, JiraDeployment.Server, JiraServerAuthScheme.Bearer)]
    [InlineData(JiraDeployment.Server, JiraServerAuthScheme.Basic, JiraDeployment.Server, JiraServerAuthScheme.Basic)]
    public async Task A_request_without_type_and_sign_in_uses_the_configured_defaults(
        JiraDeployment configured,
        JiraServerAuthScheme configuredScheme,
        JiraDeployment expected,
        JiraServerAuthScheme expectedScheme)
    {
        var fake = new FakeJiraClient();
        using var factory = WithFake(fake, configured, configuredScheme);

        var response = await NewClient(factory).PostAsJsonAsync("/api/jira/session", new { siteUrl = ServerSite, login = "dev", secret = "secret-token" }, Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal((expected, expectedScheme), (fake.LastCredentials!.Deployment, fake.LastCredentials.AuthScheme));
    }

    [Fact]
    public async Task Server_without_a_sign_in_gets_the_configured_server_sign_in_even_when_cloud_is_the_default()
    {
        var fake = new FakeJiraClient();
        using var factory = WithFake(fake, JiraDeployment.Cloud, JiraServerAuthScheme.Bearer);

        var response = await NewClient(factory).PostAsJsonAsync(
            "/api/jira/session",
            new { siteUrl = ServerSite, deployment = "server", login = "someone", secret = "secret-token" },
            Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new JiraCredentials("", "secret-token", ServerSite, null, JiraDeployment.Server, JiraServerAuthScheme.Bearer), fake.LastCredentials);
    }

    // ---------- one instance, several types

    [Fact]
    public async Task Cloud_and_server_sessions_live_in_one_instance_and_each_uses_its_own_calls_and_header()
    {
        var seen = new ConcurrentQueue<HttpRequestMessage>();
        using var factory = WithHandler(JiraDeployment.Cloud, JiraServerAuthScheme.Basic, request =>
        {
            seen.Enqueue(request);
            return request.RequestUri!.AbsolutePath.EndsWith("/myself", StringComparison.Ordinal)
                ? Json("""{"displayName":"Ada"}""")
                : request.RequestUri.AbsolutePath.EndsWith("/createmeta", StringComparison.Ordinal)
                    ? Json("""{"projects":[{"key":"DEMO","name":"Demo","issuetypes":[]}]}""")
                    : Json("""{"values":[{"key":"SCRUM","name":"Scrum"}]}""");
        });
        using var client = NewClient(factory);

        var cloud = await ConnectAs(client, CloudSite, "Cloud", null, "me@example.com", "cloud-token");
        var bearer = await ConnectAs(client, ServerSite, "Server", "Bearer", null, "server-token");
        var basic = await ConnectAs(client, ServerSite, "Server", "Basic", "dev", "server-password");
        seen.Clear();

        var cloudProjects = await ReadJson(await Send(client, "/api/jira/projects", cloud));
        var cloudCall = Dequeue(seen);
        var bearerProjects = await ReadJson(await Send(client, "/api/jira/projects", bearer));
        var bearerCall = Dequeue(seen);
        await Send(client, "/api/jira/projects", basic);
        var basicCall = Dequeue(seen);

        Assert.Equal("SCRUM", cloudProjects[0].GetProperty("key").GetString());
        Assert.Equal($"{CloudSite}/rest/api/2/project/search?action=create&maxResults=50", cloudCall.RequestUri!.ToString());
        Assert.Equal(("Basic", "me@example.com:cloud-token"), Header(cloudCall));

        Assert.Equal("DEMO", bearerProjects[0].GetProperty("key").GetString());
        Assert.Equal($"{ServerSite}/rest/api/2/issue/createmeta", bearerCall.RequestUri!.ToString());
        Assert.Equal(("Bearer", "server-token"), Header(bearerCall));

        Assert.Equal($"{ServerSite}/rest/api/2/issue/createmeta", basicCall.RequestUri!.ToString());
        Assert.Equal(("Basic", "dev:server-password"), Header(basicCall));
    }

    [Theory]
    [InlineData(JiraDeployment.Cloud, "Server", "/rest/api/2/search")]
    [InlineData(JiraDeployment.Server, "Cloud", "/rest/api/2/search/jql")]
    public async Task The_session_type_not_the_configuration_decides_the_calls(JiraDeployment configured, string chosen, string expectedPath)
    {
        var seen = new ConcurrentQueue<HttpRequestMessage>();
        using var factory = WithHandler(configured, JiraServerAuthScheme.Basic, request =>
        {
            seen.Enqueue(request);
            return Json("""{"displayName":"Ada","issues":[]}""");
        });
        using var client = NewClient(factory);
        var site = chosen == "Cloud" ? CloudSite : ServerSite;
        var cookie = await ConnectAs(client, site, chosen, "Basic", "dev", "secret-token");
        seen.Clear();

        var response = await Send(client, "/api/jira/issues/search", cookie, """{"projectKey":"DEMO","issueTypeIds":null,"query":"login"}""");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(site + expectedPath, Dequeue(seen).RequestUri!.ToString());
    }

    // ---------- error wording

    [Theory]
    [InlineData(JiraDeployment.Cloud, "Server", "Basic", "username and password or token")]
    [InlineData(JiraDeployment.Cloud, "Server", "Bearer", "username and password or token")]
    [InlineData(JiraDeployment.Server, "Cloud", "Basic", "email and token")]
    public async Task A_401_on_the_login_check_uses_the_wording_of_the_chosen_type(JiraDeployment configured, string chosen, string scheme, string expected)
    {
        using var factory = WithHandler(configured, JiraServerAuthScheme.Bearer, _ => new HttpResponseMessage(HttpStatusCode.Unauthorized)
        {
            Content = new StringContent("{}", Encoding.UTF8, "application/json"),
        });

        var response = await NewClient(factory).PostAsJsonAsync(
            "/api/jira/session",
            new { siteUrl = chosen == "Cloud" ? CloudSite : ServerSite, deployment = chosen, authScheme = scheme, login = "dev", secret = "wrong" },
            Ct);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var body = await ReadJson(response);
        Assert.Equal(ErrorCodes.JiraAuthDenied, body.GetProperty("code").GetString());
        Assert.Contains(expected, body.GetProperty("title").GetString());
    }

    // ---------- old cookies

    [Fact]
    public async Task An_old_cookie_gets_the_configured_type_and_a_request_body_cannot_change_it()
    {
        var seen = new ConcurrentQueue<HttpRequestMessage>();
        using var factory = WithHandler(JiraDeployment.Server, JiraServerAuthScheme.Basic, request =>
        {
            seen.Enqueue(request);
            return Json("""{"issues":[]}""");
        });
        using var client = NewClient(factory);
        var old = OldCookie(factory, login: "dev", siteUrl: ServerSite);

        var status = await ReadJson(await Send(client, "/api/jira/status", old));
        var response = await Send(
            client,
            "/api/jira/issues/search",
            old,
            """{"projectKey":"DEMO","issueTypeIds":null,"query":"login","deployment":"Cloud","authScheme":"Bearer"}""");

        Assert.True(status.GetProperty("connected").GetBoolean());
        Assert.Equal(("Server", "Basic"), (status.GetProperty("deployment").GetString(), status.GetProperty("authScheme").GetString()));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var call = Dequeue(seen);
        Assert.Equal($"{ServerSite}/rest/api/2/search", call.RequestUri!.ToString());
        Assert.Equal(("Basic", "dev:secret-token"), Header(call));
    }

    // ---------- status

    [Fact]
    public async Task Status_returns_the_session_values_when_connected_and_the_defaults_otherwise()
    {
        using var factory = WithFake(new FakeJiraClient(), JiraDeployment.Cloud, JiraServerAuthScheme.Basic);
        using var client = NewClient(factory);

        var before = await ReadJson(await client.GetAsync("/api/jira/status", Ct));
        var cookie = await ConnectAs(client, ServerSite, "Server", "Bearer", null, "server-token");
        var after = await ReadJson(await Send(client, "/api/jira/status", cookie));

        Assert.Equal(("Cloud", "Basic", "Basic"), Values(before));
        Assert.Equal(("Server", "Bearer", "Basic"), Values(after));
        Assert.Equal(ServerSite, after.GetProperty("siteUrl").GetString());
    }

    // ---------- helpers

    private static (string?, string?, string?) Values(JsonElement status) =>
        (status.GetProperty("deployment").GetString(), status.GetProperty("authScheme").GetString(), status.GetProperty("defaultServerAuthScheme").GetString());

    private static Dictionary<string, string?> Settings(JiraDeployment deployment, JiraServerAuthScheme scheme) => new()
    {
        ["Jira:Enabled"] = "true",
        ["Jira:BaseUrl"] = "",
        ["Jira:AllowedHosts:0"] = "*.atlassian.net",
        ["Jira:AllowedHosts:1"] = "jira.company.com",
        ["Jira:Deployment"] = deployment.ToString(),
        ["Jira:ServerAuthScheme"] = scheme.ToString(),
    };

    private static WebApplicationFactory<Program> WithFake(IJiraClient fake, JiraDeployment deployment, JiraServerAuthScheme scheme) =>
        new ApiFactory().WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration(configuration => configuration.AddInMemoryCollection(Settings(deployment, scheme)));
            builder.ConfigureTestServices(services => services.AddSingleton(fake));
        });

    // The real JiraClient against a stub handler, so the request shapes and headers can be read.
    private static WebApplicationFactory<Program> WithHandler(JiraDeployment deployment, JiraServerAuthScheme scheme, Func<HttpRequestMessage, HttpResponseMessage> respond) =>
        new ApiFactory().WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration(configuration => configuration.AddInMemoryCollection(Settings(deployment, scheme)));
            builder.ConfigureTestServices(services => services
                .AddHttpClient<IJiraClient, JiraClient>()
                .ConfigurePrimaryHttpMessageHandler(() => new LambdaHandler((request, _) => Task.FromResult(respond(request)))));
        });

    // A cookie as J9 and earlier wrote it: no type and no sign-in.
    private static string OldCookie(WebApplicationFactory<Program> factory, string login, string siteUrl)
    {
        var protector = factory.Services.GetRequiredService<IDataProtectionProvider>().CreateProtector("VoiceToTicket.Jira.Session.v1");
        var time = factory.Services.GetRequiredService<TimeProvider>();
        return protector.Protect(JsonSerializer.Serialize(new { Login = login, Secret = "secret-token", IssuedAt = time.GetUtcNow(), DisplayName = "Ada", SiteUrl = siteUrl }));
    }

    private static HttpClient NewClient(WebApplicationFactory<Program> factory) =>
        factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    private static async Task<string> ConnectAs(HttpClient client, string siteUrl, string deployment, string? authScheme, string? login, string secret)
    {
        var response = await client.PostAsJsonAsync("/api/jira/session", new { siteUrl, deployment, authScheme, login, secret }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var header = Assert.Single(response.Headers.GetValues("Set-Cookie"));
        return header["vtt_jira=".Length..header.IndexOf(';')];
    }

    // GET when no body is given, POST with the body otherwise.
    private static async Task<HttpResponseMessage> Send(HttpClient client, string path, string cookie, string? json = null)
    {
        using var request = new HttpRequestMessage(json is null ? HttpMethod.Get : HttpMethod.Post, path);
        request.Headers.Add("Cookie", $"vtt_jira={cookie}");
        if (json is not null)
        {
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }

        return await client.SendAsync(request, Ct);
    }

    private static HttpRequestMessage Dequeue(ConcurrentQueue<HttpRequestMessage> seen) =>
        Assert.Single(seen.ToArray()) is var single && seen.TryDequeue(out _) ? single : throw new InvalidOperationException();

    private static (string, string) Header(HttpRequestMessage request)
    {
        var authorization = request.Headers.Authorization!;
        var value = authorization.Scheme == "Basic" ? Encoding.UTF8.GetString(Convert.FromBase64String(authorization.Parameter!)) : authorization.Parameter!;
        return (authorization.Scheme, value);
    }

    private static async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement.Clone();

    private static HttpResponseMessage Json(string body) =>
        new(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    private static CancellationToken Ct => TestContext.Current.CancellationToken;
}
