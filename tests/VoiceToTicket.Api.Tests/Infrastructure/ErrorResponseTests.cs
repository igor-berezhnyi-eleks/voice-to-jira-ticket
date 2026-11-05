using System.Net;
using System.Text.Json;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Tests.Infrastructure;

/// <summary>Plan 4.4: every error response is ProblemDetails with a <c>code</c>, including framework errors.</summary>
public sealed class ErrorResponseTests
{
    [Theory]
    [InlineData("Development")]
    [InlineData("Production")]
    public async Task Unknown_path_returns_not_found_problem(string environment)
    {
        await using var factory = new ApiFactory(environment);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/does-not-exist", TestContext.Current.CancellationToken);

        await AssertProblemAsync(response, HttpStatusCode.NotFound, ErrorCodes.NotFound);
    }

    [Fact]
    public async Task Wrong_method_returns_method_not_allowed_problem()
    {
        await using var factory = new ApiFactory("Production");
        using var client = factory.CreateClient();

        using var response = await client.PostAsync("/health", content: null, TestContext.Current.CancellationToken);

        await AssertProblemAsync(response, HttpStatusCode.MethodNotAllowed, ErrorCodes.MethodNotAllowed);
    }

    private static async Task AssertProblemAsync(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        Assert.Equal((int)status, body.RootElement.GetProperty("status").GetInt32());
        Assert.Equal(code, body.RootElement.GetProperty("code").GetString());
    }
}
