using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;

namespace VoiceToJira.Tests.Features.Jira;

public sealed class JiraEndpointTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task Calls_without_a_login_cookie_are_unauthorized()
    {
        var response = await factory.CreateClient().GetAsync("/api/jira/boards", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Login_requires_email_and_token()
    {
        var response = await factory.CreateClient()
            .PostAsJsonAsync("/api/jira/login", new { baseUrl = "https://example.com", email = " ", apiToken = (string?)null }, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("baseUrl").And.Contain("email").And.Contain("apiToken");
    }

    [Fact]
    public async Task Create_issue_validates_the_request_before_calling_jira()
    {
        var response = await factory.CreateClient()
            .PostAsJsonAsync("/api/jira/issues", new { type = "Bug", title = "", description = "D" }, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("title").And.Contain("projectKey");
    }
}
