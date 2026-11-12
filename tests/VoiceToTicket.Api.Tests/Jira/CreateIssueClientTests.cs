using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using VoiceToTicket.Api.Features.Jira;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Tests.Jira;

/// <summary>The create and link calls of <see cref="JiraClient"/> against a stub handler.</summary>
public sealed class CreateIssueClientTests
{
    private static readonly JiraCredentials Credentials = new("dev@example.com", "secret-token");
    private static readonly JsonObject Payload = new() { ["fields"] = new JsonObject { ["summary"] = "S" } };

    [Fact]
    public async Task Create_posts_the_payload_to_the_issue_endpoint_and_reads_id_and_key()
    {
        HttpRequestMessage? seen = null;
        string? body = null;
        var client = CreateClient(request =>
        {
            seen = request;
            body = request.Content!.ReadAsStringAsync().Result;
            return Reply(HttpStatusCode.Created, """{"id": "10050", "key": "SCRUM-124", "self": "https://jira.test/rest/api/2/issue/10050"}""");
        });

        var created = await client.CreateIssueAsync(Credentials, Payload, Ct);

        Assert.Equal(("10050", "SCRUM-124"), (created.Id, created.Key));
        Assert.Equal(HttpMethod.Post, seen!.Method);
        Assert.Equal("https://jira.test/rest/api/2/issue", seen.RequestUri!.ToString());
        Assert.Equal("application/json", seen.Content!.Headers.ContentType!.MediaType);
        Assert.Equal("""{"fields":{"summary":"S"}}""", body);
        Assert.StartsWith("Basic ", seen.Headers.Authorization!.ToString());
    }

    [Fact]
    public async Task A_201_without_a_key_is_jira_unavailable()
    {
        var client = CreateClient(_ => Reply(HttpStatusCode.Created, """{"id": "1"}"""));

        var exception = await Assert.ThrowsAsync<JiraApiException>(() => client.CreateIssueAsync(Credentials, Payload, Ct));

        Assert.Equal(ErrorCodes.JiraUnavailable, exception.Code);
    }

    [Theory]
    [InlineData(HttpStatusCode.InternalServerError)]
    [InlineData(HttpStatusCode.BadGateway)]
    [InlineData(HttpStatusCode.TooManyRequests)]
    public async Task A_failed_create_is_sent_exactly_once(HttpStatusCode status)
    {
        var calls = 0;
        var client = CreateClient(_ =>
        {
            calls++;
            return Reply(status, "{}");
        });

        await Assert.ThrowsAsync<JiraApiException>(() => client.CreateIssueAsync(Credentials, Payload, Ct));

        Assert.Equal(1, calls);
    }

    [Fact]
    public async Task A_create_that_times_out_is_sent_once_and_is_jira_timeout()
    {
        var calls = 0;
        var handler = new LambdaHandler(async (_, token) =>
        {
            calls++;
            await Task.Delay(Timeout.Infinite, token);
            return new HttpResponseMessage();
        });
        var client = CreateClient(handler, timeoutSeconds: 1);

        var exception = await Assert.ThrowsAsync<JiraApiException>(() => client.CreateIssueAsync(Credentials, Payload, Ct));

        Assert.Equal((504, ErrorCodes.JiraTimeout), (exception.StatusCode, exception.Code));
        Assert.Equal(1, calls);
    }

    [Fact]
    public async Task A_400_carries_jiras_field_errors_and_messages()
    {
        var client = CreateClient(_ => Reply(
            HttpStatusCode.BadRequest,
            """{"errorMessages": ["Issue type is required"], "errors": {"priority": "Priority is required.", "customfield_10020": "Number expected"}}"""));

        var exception = await Assert.ThrowsAsync<JiraApiException>(() => client.CreateIssueAsync(Credentials, Payload, Ct));

        Assert.Equal((422, ErrorCodes.JiraRejected), (exception.StatusCode, exception.Code));
        var errors = Assert.IsType<Dictionary<string, string>>(exception.Extensions["errors"]);
        Assert.Equal("Priority is required.", errors["priority"]);
        Assert.Equal(["Issue type is required"], Assert.IsType<List<string>>(exception.Extensions["errorMessages"]));
    }

    [Theory]
    [InlineData(HttpStatusCode.UnprocessableEntity, 422, ErrorCodes.JiraRejected)]
    [InlineData(HttpStatusCode.NotFound, 404, ErrorCodes.JiraNotFound)]
    [InlineData(HttpStatusCode.Unauthorized, 401, ErrorCodes.JiraAuthRequired)]
    [InlineData(HttpStatusCode.Forbidden, 403, ErrorCodes.JiraForbidden)]
    public async Task Other_statuses_map_as_for_the_other_calls(HttpStatusCode status, int expectedStatus, string expectedCode)
    {
        var client = CreateClient(_ => Reply(status, "{}"));

        var exception = await Assert.ThrowsAsync<JiraApiException>(() => client.CreateIssueAsync(Credentials, Payload, Ct));

        Assert.Equal((expectedStatus, expectedCode), (exception.StatusCode, exception.Code));
    }

    [Fact]
    public async Task A_link_posts_the_type_name_and_both_issue_keys_and_accepts_an_empty_201()
    {
        HttpRequestMessage? seen = null;
        string? body = null;
        var client = CreateClient(request =>
        {
            seen = request;
            body = request.Content!.ReadAsStringAsync().Result;
            return new HttpResponseMessage(HttpStatusCode.Created);
        });

        await client.CreateLinkAsync(Credentials, "Blocks", "SCRUM-12", "SCRUM-124", Ct);

        Assert.Equal("https://jira.test/rest/api/2/issueLink", seen!.RequestUri!.ToString());
        using var json = JsonDocument.Parse(body!);
        Assert.Equal("Blocks", json.RootElement.GetProperty("type").GetProperty("name").GetString());
        Assert.Equal("SCRUM-12", json.RootElement.GetProperty("inwardIssue").GetProperty("key").GetString());
        Assert.Equal("SCRUM-124", json.RootElement.GetProperty("outwardIssue").GetProperty("key").GetString());
    }

    [Fact]
    public async Task A_failed_link_throws_a_jira_exception_and_is_not_retried()
    {
        var calls = 0;
        var client = CreateClient(_ =>
        {
            calls++;
            return Reply(HttpStatusCode.NotFound, "{}");
        });

        var exception = await Assert.ThrowsAsync<JiraApiException>(() => client.CreateLinkAsync(Credentials, "Blocks", "SCRUM-1", "SCRUM-2", Ct));

        Assert.Equal(ErrorCodes.JiraNotFound, exception.Code);
        Assert.Equal(1, calls);
    }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static HttpResponseMessage Reply(HttpStatusCode status, string body) =>
        new(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    private static JiraClient CreateClient(Func<HttpRequestMessage, HttpResponseMessage> respond) =>
        CreateClient(new LambdaHandler((request, _) => Task.FromResult(respond(request))));

    private static JiraClient CreateClient(HttpMessageHandler handler, int timeoutSeconds = 30)
    {
        var httpClient = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://jira.test/"),
            Timeout = Timeout.InfiniteTimeSpan,
        };
        var options = Options.Create(new JiraOptions { Enabled = true, BaseUrl = "https://jira.test", TimeoutSeconds = timeoutSeconds });
        return new JiraClient(httpClient, options, TimeProvider.System, new CapturingLogger<JiraClient>());
    }
}
