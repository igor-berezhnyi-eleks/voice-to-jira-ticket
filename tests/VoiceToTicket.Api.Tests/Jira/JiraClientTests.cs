using System.Net;
using System.Net.Http.Headers;
using System.Text;
using Microsoft.Extensions.Options;
using VoiceToTicket.Api.Features.Jira;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Tests.Jira;

/// <summary><see cref="JiraClient"/> against a stub handler.</summary>
public sealed class JiraClientTests
{
    private static readonly JiraCredentials Credentials = new("dev@example.com", "secret-token");

    [Fact]
    public async Task Sends_basic_auth_and_accept_json_to_the_myself_endpoint()
    {
        HttpRequestMessage? seen = null;
        var client = CreateClient(new StubHandler((request, _) =>
        {
            seen = request;
            return Task.FromResult(Json("""{"displayName": "Ada Lovelace", "accountId": "abc"}"""));
        }));

        var user = await client.GetMyselfAsync(Credentials, CancellationToken.None);

        Assert.Equal("Ada Lovelace", user.DisplayName);
        Assert.Equal(HttpMethod.Get, seen!.Method);
        Assert.Equal("https://jira.test/rest/api/2/myself", seen.RequestUri!.ToString());
        Assert.Equal("Basic", seen.Headers.Authorization!.Scheme);
        Assert.Equal("dev@example.com:secret-token", Encoding.UTF8.GetString(Convert.FromBase64String(seen.Headers.Authorization.Parameter!)));
        Assert.Contains(seen.Headers.Accept, accept => accept.MediaType == "application/json");
    }

    [Fact]
    public async Task A_401_on_the_login_check_is_jira_auth_denied()
    {
        var exception = await Fail(HttpStatusCode.Unauthorized);

        Assert.Equal((401, ErrorCodes.JiraAuthDenied), (exception.StatusCode, exception.Code));
    }

    [Theory]
    [InlineData(HttpStatusCode.Forbidden, 403, ErrorCodes.JiraForbidden)]
    [InlineData(HttpStatusCode.NotFound, 404, ErrorCodes.JiraNotFound)]
    [InlineData(HttpStatusCode.InternalServerError, 502, ErrorCodes.JiraUnavailable)]
    [InlineData(HttpStatusCode.BadGateway, 502, ErrorCodes.JiraUnavailable)]
    [InlineData(HttpStatusCode.ServiceUnavailable, 502, ErrorCodes.JiraUnavailable)]
    [InlineData(HttpStatusCode.Conflict, 502, ErrorCodes.JiraUnavailable)]
    public async Task Statuses_map_to_codes(HttpStatusCode jira, int status, string code)
    {
        var exception = await Fail(jira);

        Assert.Equal((status, code), (exception.StatusCode, exception.Code));
    }

    [Theory]
    [InlineData(HttpStatusCode.BadRequest)]
    [InlineData(HttpStatusCode.UnprocessableEntity)]
    public async Task A_400_or_422_is_jira_rejected_with_the_field_errors_and_messages(HttpStatusCode jira)
    {
        var body = """{"errorMessages": ["Issue type is wrong"], "errors": {"summary": "Summary is required", "priority": 5}}""";
        var client = CreateClient(new StubHandler((_, _) => Task.FromResult(Json(body, jira))));

        var exception = await Assert.ThrowsAsync<JiraApiException>(() => client.GetMyselfAsync(Credentials, CancellationToken.None));

        Assert.Equal((422, ErrorCodes.JiraRejected), (exception.StatusCode, exception.Code));
        Assert.Equal(new Dictionary<string, string> { ["summary"] = "Summary is required" }, exception.Extensions["errors"]);
        Assert.Equal(new List<string> { "Issue type is wrong" }, exception.Extensions["errorMessages"]);
    }

    [Fact]
    public async Task A_400_with_an_unreadable_body_is_still_jira_rejected()
    {
        var client = CreateClient(new StubHandler((_, _) => Task.FromResult(Json("<html>no</html>", HttpStatusCode.BadRequest))));

        var exception = await Assert.ThrowsAsync<JiraApiException>(() => client.GetMyselfAsync(Credentials, CancellationToken.None));

        Assert.Equal(ErrorCodes.JiraRejected, exception.Code);
        Assert.Empty((Dictionary<string, string>)exception.Extensions["errors"]!);
    }

    [Fact]
    public async Task A_429_with_retry_after_reports_the_seconds()
    {
        var client = CreateClient(new StubHandler((_, _) =>
        {
            var response = new HttpResponseMessage(HttpStatusCode.TooManyRequests);
            response.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(30));
            return Task.FromResult(response);
        }));

        var exception = await Assert.ThrowsAsync<JiraApiException>(() => client.GetMyselfAsync(Credentials, CancellationToken.None));

        Assert.Equal((503, ErrorCodes.JiraRateLimited), (exception.StatusCode, exception.Code));
        Assert.Equal(30, exception.Extensions["retryAfterSeconds"]);
    }

    [Fact]
    public async Task A_429_without_retry_after_has_no_hint()
    {
        var exception = await Fail(HttpStatusCode.TooManyRequests);

        Assert.Equal(ErrorCodes.JiraRateLimited, exception.Code);
        Assert.False(exception.Extensions.ContainsKey("retryAfterSeconds"));
    }

    [Fact]
    public async Task A_network_failure_is_jira_unavailable()
    {
        var client = CreateClient(new StubHandler((_, _) => throw new HttpRequestException("connection refused")));

        var exception = await Assert.ThrowsAsync<JiraApiException>(() => client.GetMyselfAsync(Credentials, CancellationToken.None));

        Assert.Equal((502, ErrorCodes.JiraUnavailable), (exception.StatusCode, exception.Code));
    }

    [Theory]
    [InlineData("not json")]
    [InlineData("[]")]
    [InlineData("{}")]
    [InlineData("""{"displayName": ""}""")]
    [InlineData("""{"displayName": 5}""")]
    public async Task An_unusable_success_body_is_jira_unavailable(string body)
    {
        var client = CreateClient(new StubHandler((_, _) => Task.FromResult(Json(body))));

        var exception = await Assert.ThrowsAsync<JiraApiException>(() => client.GetMyselfAsync(Credentials, CancellationToken.None));

        Assert.Equal(ErrorCodes.JiraUnavailable, exception.Code);
    }

    [Fact]
    public async Task No_answer_within_the_timeout_is_jira_timeout()
    {
        var client = CreateClient(
            new StubHandler(async (_, token) =>
            {
                await Task.Delay(Timeout.Infinite, token);
                return Json("{}");
            }),
            timeoutSeconds: 1);

        var exception = await Assert.ThrowsAsync<JiraApiException>(() => client.GetMyselfAsync(Credentials, CancellationToken.None));

        Assert.Equal((504, ErrorCodes.JiraTimeout), (exception.StatusCode, exception.Code));
    }

    [Fact]
    public async Task The_callers_cancellation_is_not_reported_as_a_timeout()
    {
        using var cancellation = new CancellationTokenSource();
        var client = CreateClient(new StubHandler(async (_, token) =>
        {
            await cancellation.CancelAsync();
            await Task.Delay(Timeout.Infinite, token);
            return Json("{}");
        }));

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => client.GetMyselfAsync(Credentials, cancellation.Token));
    }

    [Fact]
    public async Task Makes_exactly_one_request_even_when_it_fails()
    {
        var calls = 0;
        var client = CreateClient(new StubHandler((_, _) =>
        {
            calls++;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
        }));

        await Assert.ThrowsAsync<JiraApiException>(() => client.GetMyselfAsync(Credentials, CancellationToken.None));

        Assert.Equal(1, calls);
    }

    private static async Task<JiraApiException> Fail(HttpStatusCode status)
    {
        var client = CreateClient(new StubHandler((_, _) => Task.FromResult(new HttpResponseMessage(status))));
        return await Assert.ThrowsAsync<JiraApiException>(() => client.GetMyselfAsync(Credentials, CancellationToken.None));
    }

    private static HttpResponseMessage Json(string body, HttpStatusCode status = HttpStatusCode.OK) =>
        new(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    private static JiraClient CreateClient(StubHandler handler, int timeoutSeconds = 30)
    {
        var httpClient = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://jira.test/"),
            Timeout = Timeout.InfiniteTimeSpan,
        };
        var options = Options.Create(new JiraOptions { Enabled = true, BaseUrl = "https://jira.test", TimeoutSeconds = timeoutSeconds });
        return new JiraClient(httpClient, options, TimeProvider.System, new CapturingLogger<JiraClient>());
    }

    private sealed class StubHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> respond)
        : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            respond(request, cancellationToken);
    }
}
