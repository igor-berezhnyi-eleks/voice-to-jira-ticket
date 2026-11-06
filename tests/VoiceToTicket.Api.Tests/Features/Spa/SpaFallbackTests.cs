using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Tests.Features.Spa;

/// <summary>The API serves the built SPA (D3), but unknown API routes must stay real 404s.</summary>
public sealed class SpaFallbackTests : IAsyncLifetime
{
    private const string IndexHtml = "<!doctype html><title>spa-index</title>";
    private const string AssetContent = "console.log('asset');";

    private readonly string _webRoot = Directory.CreateTempSubdirectory("vtt-webroot-").FullName;
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    public ValueTask InitializeAsync()
    {
        File.WriteAllText(Path.Combine(_webRoot, "index.html"), IndexHtml);
        Directory.CreateDirectory(Path.Combine(_webRoot, "assets"));
        File.WriteAllText(Path.Combine(_webRoot, "assets", "app.js"), AssetContent);

        _factory = new ApiFactory("Production").WithWebHostBuilder(builder => builder.UseWebRoot(_webRoot));
        _client = _factory.CreateClient();
        return ValueTask.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
        Directory.Delete(_webRoot, recursive: true);
    }

    [Theory]
    [InlineData("/")]
    [InlineData("/some/client/path")]
    [InlineData("/apiary")]
    [InlineData("/healthy")]
    public async Task Non_api_paths_serve_index_html(string path)
    {
        using var response = await _client.GetAsync(path, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(IndexHtml, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Existing_asset_is_served_as_itself()
    {
        using var response = await _client.GetAsync("/assets/app.js", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(AssetContent, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Theory]
    [InlineData("/api")]
    [InlineData("/api/")]
    [InlineData("/api/unknown")]
    [InlineData("/api/tickets/unknown")]
    [InlineData("/API/unknown")]
    [InlineData("/health/unknown")]
    [InlineData("/HEALTH/unknown")]
    [InlineData("/assets/missing.js")]
    public async Task Unknown_api_routes_and_missing_files_are_not_found_problems(string path)
    {
        using var response = await _client.GetAsync(path, TestContext.Current.CancellationToken);

        await AssertNotFoundProblemAsync(response);
    }

    [Theory]
    [InlineData("POST", "/api/unknown")]
    [InlineData("PUT", "/api/unknown")]
    [InlineData("DELETE", "/api/unknown")]
    [InlineData("POST", "/api/ticket")]
    [InlineData("POST", "/api/tickets/unknown")]
    [InlineData("DELETE", "/api")]
    [InlineData("POST", "/health/unknown")]
    [InlineData("POST", "/some/client/path")]
    [InlineData("DELETE", "/")]
    public async Task Other_methods_on_unknown_routes_are_not_found_problems(string method, string path)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), path);
        using var response = await _client.SendAsync(request, TestContext.Current.CancellationToken);

        await AssertNotFoundProblemAsync(response);
    }

    [Theory]
    [InlineData("GET", "/api/tickets")]
    [InlineData("PUT", "/api/tickets")]
    [InlineData("POST", "/health")]
    public async Task Wrong_method_on_a_known_route_is_a_method_not_allowed_problem(string method, string path)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), path);
        using var response = await _client.SendAsync(request, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.MethodNotAllowed, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        Assert.Equal(ErrorCodes.MethodNotAllowed, body.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Head_on_a_client_path_succeeds()
    {
        using var request = new HttpRequestMessage(HttpMethod.Head, "/some/client/path");
        using var response = await _client.SendAsync(request, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task OpenApi_document_is_not_replaced_by_the_spa()
    {
        using var response = await _client.GetAsync(ApiDocumentationExtensions.OpenApiDocumentPath, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Health_still_answers()
    {
        using var response = await _client.GetAsync("/health", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        Assert.Equal("ok", body.RootElement.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Generating_a_ticket_still_works()
    {
        using var response = await _client.PostAsJsonAsync(
            "/api/tickets",
            new { transcript = "The invoice editor crashes when the date is empty." },
            TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        Assert.Equal("Fake", body.RootElement.GetProperty("provider").GetString());
    }

    private static async Task AssertNotFoundProblemAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        Assert.Equal(ErrorCodes.NotFound, body.RootElement.GetProperty("code").GetString());
    }
}
