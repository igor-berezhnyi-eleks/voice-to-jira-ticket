using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using VoiceToTicket.Api.Features.Jira;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Tests.Jira;

/// <summary>The discovery calls of <see cref="JiraClient"/> against a stub handler.</summary>
public sealed class JiraDiscoveryClientTests
{
    private static readonly JiraCredentials Credentials = new("dev@example.com", "secret-token");

    [Fact]
    public async Task Projects_use_the_create_action_and_the_first_page_of_50()
    {
        var seen = new List<HttpRequestMessage>();
        var client = CreateClient(request =>
        {
            seen.Add(request);
            return Json("""{"values": [{"key": "SCRUM", "name": "Scrum"}, {"key": "", "name": "No key"}, {"name": "x"}], "isLast": true}""");
        });

        var projects = await client.GetProjectsAsync(Credentials, Ct);

        var request = Assert.Single(seen);
        Assert.Equal(HttpMethod.Get, request.Method);
        Assert.Equal("https://jira.test/rest/api/2/project/search?action=create&maxResults=50", request.RequestUri!.ToString());
        Assert.Equal("SCRUM", Assert.Single(projects).Key);
    }

    [Fact]
    public async Task Issue_types_come_from_the_createmeta_issuetypes_endpoint()
    {
        Uri? uri = null;
        var client = CreateClient(request =>
        {
            uri = request.RequestUri;
            return Json(JiraFixtures.CompanyIssueTypes);
        });

        var types = await client.GetIssueTypesAsync(Credentials, "SCRUM", Ct);

        Assert.Equal("https://jira.test/rest/api/2/issue/createmeta/SCRUM/issuetypes", uri!.ToString());
        Assert.Equal(5, types.Count);
        Assert.True(types.Single(type => type.Name == "Sub-task").Subtask);
    }

    [Fact]
    public async Task Fields_are_read_page_by_page_so_a_required_field_on_the_second_page_is_found()
    {
        var uris = new List<string>();
        var client = CreateClient(request =>
        {
            uris.Add(request.RequestUri!.PathAndQuery);
            return request.RequestUri.Query.Contains("startAt=0")
                ? Json(Page(total: 3, "customfield_1", "customfield_2"))
                : Json(Page(total: 3, "customfield_3"));
        });

        var fields = await client.GetCreateFieldsAsync(Credentials, "SCRUM", "10003", Ct);

        Assert.Equal(["customfield_1", "customfield_2", "customfield_3"], fields.Select(field => field.FieldId));
        Assert.Equal(
            [
                "/rest/api/2/issue/createmeta/SCRUM/issuetypes/10003?startAt=0&maxResults=200",
                "/rest/api/2/issue/createmeta/SCRUM/issuetypes/10003?startAt=2&maxResults=200",
            ],
            uris);
    }

    [Fact]
    public async Task Without_a_total_a_short_page_is_the_last_and_an_empty_page_stops_the_loop()
    {
        var calls = 0;
        var client = CreateClient(_ =>
        {
            calls++;
            return Json("""{"fields": [{"fieldId": "labels", "schema": {"type": "array"}}]}""");
        });

        var fields = await client.GetCreateFieldsAsync(Credentials, "SCRUM", "1", Ct);

        Assert.Equal((1, 1), (fields.Count, calls));

        var emptyCalls = 0;
        var stuck = CreateClient(_ =>
        {
            emptyCalls++;
            return Json("""{"total": 5, "fields": []}""");
        });
        Assert.Empty(await stuck.GetCreateFieldsAsync(Credentials, "SCRUM", "1", Ct));
        Assert.Equal(1, emptyCalls);
    }

    [Fact]
    public async Task More_than_500_fields_is_jira_unavailable()
    {
        var client = CreateClient(request =>
        {
            var start = int.Parse(System.Web.HttpUtility.ParseQueryString(request.RequestUri!.Query)["startAt"]!);
            return Json(Page(total: 900, Enumerable.Range(start, 200).Select(number => $"customfield_{number}").ToArray()));
        });

        var exception = await Assert.ThrowsAsync<JiraApiException>(() => client.GetCreateFieldsAsync(Credentials, "SCRUM", "1", Ct));

        Assert.Equal((502, ErrorCodes.JiraUnavailable), (exception.StatusCode, exception.Code));
    }

    [Fact]
    public async Task Exactly_500_fields_is_accepted()
    {
        var client = CreateClient(request =>
        {
            var start = int.Parse(System.Web.HttpUtility.ParseQueryString(request.RequestUri!.Query)["startAt"]!);
            var count = Math.Min(200, 500 - start);
            return Json(Page(total: 500, Enumerable.Range(start, count).Select(number => $"customfield_{number}").ToArray()));
        });

        Assert.Equal(500, (await client.GetCreateFieldsAsync(Credentials, "SCRUM", "1", Ct)).Count);
    }

    [Fact]
    public async Task Link_types_are_read_from_the_issue_link_type_endpoint()
    {
        Uri? uri = null;
        var client = CreateClient(request =>
        {
            uri = request.RequestUri;
            return Json("""{"issueLinkTypes": [{"id": "1", "name": "Blocks", "inward": "is blocked by", "outward": "blocks"}, {"name": ""}]}""");
        });

        var types = await client.GetLinkTypesAsync(Credentials, Ct);

        Assert.Equal("https://jira.test/rest/api/2/issueLinkType", uri!.ToString());
        var blocks = Assert.Single(types);
        Assert.Equal(("Blocks", "is blocked by", "blocks", false), (blocks.Name, blocks.Inward, blocks.Outward, blocks.IsDefault));
    }

    [Fact]
    public async Task Search_posts_the_jql_and_the_fields_in_the_body_and_never_in_the_url()
    {
        HttpRequestMessage? seen = null;
        string? body = null;
        var client = CreateClient(request =>
        {
            seen = request;
            body = request.Content!.ReadAsStringAsync().Result;
            return Json("""
                {"isLast": true, "issues": [
                  {"id": "1", "key": "SCRUM-1", "fields": {"summary": "Login fails", "issuetype": {"id": "10003", "name": "Bug"}, "status": {"name": "To Do"}}},
                  {"key": "SCRUM-2"}
                ]}
                """);
        });

        var hits = await client.SearchIssuesAsync(Credentials, """summary ~ "secret login*" ORDER BY updated DESC""", Ct);

        Assert.Equal(HttpMethod.Post, seen!.Method);
        Assert.Equal("https://jira.test/rest/api/2/search/jql", seen.RequestUri!.ToString());
        Assert.DoesNotContain("secret", seen.RequestUri.ToString());
        Assert.Equal("application/json", seen.Content!.Headers.ContentType!.MediaType);

        using var json = JsonDocument.Parse(body!);
        Assert.Equal("""summary ~ "secret login*" ORDER BY updated DESC""", json.RootElement.GetProperty("jql").GetString());
        Assert.Equal(["summary", "issuetype", "status"], json.RootElement.GetProperty("fields").EnumerateArray().Select(field => field.GetString()));
        Assert.Equal(20, json.RootElement.GetProperty("maxResults").GetInt32());

        var hit = Assert.Single(hits);
        Assert.Equal(("SCRUM-1", "Login fails", "Bug", "To Do"), (hit.Key, hit.Summary, hit.IssueType, hit.Status));
    }

    [Fact]
    public async Task An_issue_is_fetched_by_key_with_only_the_needed_fields()
    {
        Uri? uri = null;
        var client = CreateClient(request =>
        {
            uri = request.RequestUri;
            return Json("""{"key": "SCRUM-12", "fields": {"summary": "S", "issuetype": {"id": "10001", "name": "Story"}, "status": {"name": "Done"}}}""");
        });

        var detail = await client.GetIssueAsync(Credentials, "SCRUM-12", Ct);

        Assert.Equal("https://jira.test/rest/api/2/issue/SCRUM-12?fields=summary,issuetype,status", uri!.ToString());
        Assert.Equal(("SCRUM-12", "10001"), (detail!.Hit.Key, detail.IssueTypeId));
    }

    [Fact]
    public async Task A_missing_issue_is_null_not_an_error_but_other_failures_are()
    {
        var missing = CreateClient(_ => new HttpResponseMessage(HttpStatusCode.NotFound));
        Assert.Null(await missing.GetIssueAsync(Credentials, "SCRUM-99", Ct));

        var broken = CreateClient(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError));
        var exception = await Assert.ThrowsAsync<JiraApiException>(() => broken.GetIssueAsync(Credentials, "SCRUM-99", Ct));
        Assert.Equal(ErrorCodes.JiraUnavailable, exception.Code);
    }

    [Fact]
    public async Task A_404_on_the_create_fields_is_jira_not_found_and_each_call_is_made_once()
    {
        var calls = 0;
        var client = CreateClient(_ =>
        {
            calls++;
            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var exception = await Assert.ThrowsAsync<JiraApiException>(() => client.GetCreateFieldsAsync(Credentials, "NOPE", "1", Ct));

        Assert.Equal((404, ErrorCodes.JiraNotFound), (exception.StatusCode, exception.Code));
        Assert.Equal(1, calls);
    }

    [Fact]
    public async Task Every_discovery_call_sends_basic_auth()
    {
        var headers = new List<string?>();
        var client = CreateClient(request =>
        {
            headers.Add(request.Headers.Authorization?.ToString());
            return Json("""{"values": [], "issueLinkTypes": [], "issues": [], "issueTypes": [], "fields": []}""");
        });

        await client.GetProjectsAsync(Credentials, Ct);
        await client.GetIssueTypesAsync(Credentials, "SCRUM", Ct);
        await client.GetCreateFieldsAsync(Credentials, "SCRUM", "1", Ct);
        await client.GetLinkTypesAsync(Credentials, Ct);
        await client.SearchIssuesAsync(Credentials, "project = \"SCRUM\"", Ct);

        var expected = "Basic " + Convert.ToBase64String(Encoding.UTF8.GetBytes("dev@example.com:secret-token"));
        Assert.Equal(5, headers.Count);
        Assert.All(headers, header => Assert.Equal(expected, header));
    }

    private static string Page(int total, params string[] ids)
    {
        var fields = string.Join(",", ids.Select(id => "{\"fieldId\": \"" + id + "\", \"name\": \"" + id + "\", \"schema\": {\"type\": \"string\"}}"));
        return "{\"startAt\": 0, \"maxResults\": 200, \"total\": " + total + ", \"fields\": [" + fields + "]}";
    }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static HttpResponseMessage Json(string body) =>
        new(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    private static JiraClient CreateClient(Func<HttpRequestMessage, HttpResponseMessage> respond)
    {
        var httpClient = new HttpClient(new StubHandler(respond))
        {
            BaseAddress = new Uri("https://jira.test/"),
            Timeout = Timeout.InfiniteTimeSpan,
        };
        var options = Options.Create(new JiraOptions { Enabled = true, BaseUrl = "https://jira.test", TimeoutSeconds = 30 });
        return new JiraClient(httpClient, options, TimeProvider.System, new CapturingLogger<JiraClient>());
    }

    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(respond(request));
    }
}
