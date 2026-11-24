using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using VoiceToTicket.Api.Infrastructure;
using VoiceToTicket.Api.Tests.Jira;

namespace VoiceToTicket.Api.Tests.Features.Spa;

/// <summary>
/// The app served under a prefix, as on the shared VM, where the colleague's Caddy forwards <c>/alt/*</c> without
/// stripping it (deployment plan D28). Without <c>PathBase</c> the other test classes cover the app at <c>/</c>.
/// </summary>
public sealed class PathBaseTests : IAsyncLifetime
{
    private const string IndexHtml = "<!doctype html><title>spa-index</title>";
    private const string AssetContent = "console.log('asset');";
    private const string SignIn = """{"login": "dev@example.com", "secret": "secret-token"}""";

    private readonly string _webRoot = Directory.CreateTempSubdirectory("vtt-webroot-").FullName;
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    public ValueTask InitializeAsync()
    {
        File.WriteAllText(Path.Combine(_webRoot, "index.html"), IndexHtml);
        Directory.CreateDirectory(Path.Combine(_webRoot, "assets"));
        File.WriteAllText(Path.Combine(_webRoot, "assets", "app.js"), AssetContent);

        _factory = new ApiFactory("Production").WithWebHostBuilder(builder =>
        {
            builder.UseWebRoot(_webRoot);
            builder.ConfigureAppConfiguration(configuration => configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["PathBase"] = "/alt",
                ["Jira:Enabled"] = "true",
                ["Jira:BaseUrl"] = "https://jira.test",
            }));
            builder.ConfigureTestServices(services => services.AddSingleton<VoiceToTicket.Api.Features.Jira.IJiraClient>(new FakeJiraClient()));
        });
        _client = _factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        return ValueTask.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
        Directory.Delete(_webRoot, recursive: true);
    }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Health_answers_under_the_prefix()
    {
        using var response = await _client.GetAsync("/alt/health", Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        Assert.Equal("ok", body.RootElement.GetProperty("status").GetString());
    }

    [Theory]
    [InlineData("/alt/")]
    [InlineData("/alt/some/client/path")]
    public async Task Client_paths_under_the_prefix_serve_index_html(string path)
    {
        using var response = await _client.GetAsync(path, Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(IndexHtml, await response.Content.ReadAsStringAsync(Ct));
    }

    [Fact]
    public async Task Assets_are_served_under_the_prefix()
    {
        using var response = await _client.GetAsync("/alt/assets/app.js", Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(AssetContent, await response.Content.ReadAsStringAsync(Ct));
    }

    [Fact]
    public async Task Generating_a_ticket_works_under_the_prefix()
    {
        using var response = await _client.PostAsJsonAsync(
            "/alt/api/tickets",
            new { transcript = "The invoice editor crashes when the date is empty." },
            Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        Assert.Equal("Fake", body.RootElement.GetProperty("provider").GetString());
    }

    // Routing has to see the path without the prefix: otherwise these would be the SPA (GET) or 404 instead of 405.
    [Theory]
    [InlineData("GET", "/alt/api/unknown", HttpStatusCode.NotFound, ErrorCodes.NotFound)]
    [InlineData("GET", "/alt/api/tickets", HttpStatusCode.MethodNotAllowed, ErrorCodes.MethodNotAllowed)]
    [InlineData("POST", "/alt/health", HttpStatusCode.MethodNotAllowed, ErrorCodes.MethodNotAllowed)]
    public async Task Api_errors_under_the_prefix_are_the_same_problems(string method, string path, HttpStatusCode status, string code)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), path);
        using var response = await _client.SendAsync(request, Ct);

        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        Assert.Equal(code, body.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Jira_cookie_path_includes_the_prefix_when_set_and_when_cleared()
    {
        using var signIn = await _client.PostAsync("/alt/api/jira/session", new StringContent(SignIn, Encoding.UTF8, "application/json"), Ct);
        using var signOut = await _client.DeleteAsync("/alt/api/jira/session", Ct);

        Assert.Equal(HttpStatusCode.OK, signIn.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, signOut.StatusCode);
        foreach (var response in new[] { signIn, signOut })
        {
            var header = Assert.Single(response.Headers.GetValues("Set-Cookie")).ToLowerInvariant();
            Assert.StartsWith("vtt_jira=", header);
            Assert.Contains("path=/alt/api/jira", header);
        }
    }

    [Theory]
    [InlineData("")]
    [InlineData("/alt")]
    [InlineData("/a/b")]
    public void Valid_path_bases(string value) => Assert.True(new PathBaseOptions { PathBase = value }.IsValid());

    [Theory]
    [InlineData("alt")]
    [InlineData("/alt/")]
    [InlineData("/")]
    [InlineData("//alt")]
    [InlineData("/alt?x")]
    [InlineData("/alt#x")]
    [InlineData("\\alt")]
    public void Invalid_path_bases(string value) => Assert.False(new PathBaseOptions { PathBase = value }.IsValid());

    [Fact]
    public void An_invalid_path_base_stops_the_app_at_start()
    {
        using var factory = new ApiFactory().WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration(configuration =>
                configuration.AddInMemoryCollection(new Dictionary<string, string?> { ["PathBase"] = "/alt/" })));

        var error = Assert.ThrowsAny<Exception>(() => factory.CreateClient());
        Assert.Contains(PathBaseOptions.InvalidMessage, error.ToString());
    }
}
