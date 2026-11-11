using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using FluentAssertions;
using Microsoft.Extensions.Options;
using VoiceToJira.Api.Features.Jira;

namespace VoiceToJira.Tests.Features.Jira;

public sealed class JiraClientTests
{
    private static readonly JiraCredentials Credentials = new("https://site.atlassian.net", "me@example.com", "token-123");

    private readonly StubHandler handler = new();

    [Fact]
    public async Task Requests_use_basic_auth_with_email_and_token()
    {
        handler.Respond(HttpStatusCode.OK, """{"displayName":"Igor"}""");

        var name = await CreateClient().GetDisplayNameAsync(Credentials, TestContext.Current.CancellationToken);

        name.Should().Be("Igor");
        handler.Requests.Single().Authorization.Should().Be("Basic " + Convert.ToBase64String(Encoding.UTF8.GetBytes("me@example.com:token-123")));
        handler.Requests.Single().Url.Should().Be("https://site.atlassian.net/rest/api/2/myself");
    }

    [Fact]
    public async Task Boards_take_the_project_key_from_the_board_location_or_ask_for_it()
    {
        handler.Respond(HttpStatusCode.OK, """{"values":[{"id":1,"name":"Alpha","location":{"projectKey":"ALP"}},{"id":2,"name":"Beta"}]}""");
        handler.Respond(HttpStatusCode.OK, """{"values":[{"key":"BET"}]}""");

        var boards = await CreateClient().GetBoardsAsync(Credentials, null, TestContext.Current.CancellationToken);

        boards.Should().Equal(new JiraBoard(1, "Alpha", "ALP"), new JiraBoard(2, "Beta", "BET"));
        handler.Requests[1].Url.Should().EndWith("/rest/agile/1.0/board/2/project");
    }

    [Fact]
    public async Task Parent_search_uses_search_jql_with_an_escaped_query()
    {
        handler.Respond(HttpStatusCode.OK, """{"issues":[{"key":"ALP-1","fields":{"summary":"Login epic"}}]}""");

        var parents = await CreateClient().SearchParentsAsync(Credentials, "ALP", "Epic", "say \"hi\"", TestContext.Current.CancellationToken);

        parents.Should().Equal(new JiraIssueRef("ALP-1", "Login epic"));
        var url = Uri.UnescapeDataString(handler.Requests.Single().Url);
        url.Should().Contain("/rest/api/2/search/jql?").And.Contain("issuetype = \"Epic\"").And.Contain("summary ~ \"say \\\"hi\\\"\"");
    }

    private const string ProjectJson = """{"issueTypes":[{"name":"Task","subtask":false},{"name":"Bug","subtask":false},{"name":"Story","subtask":false},{"name":"Sub-task","subtask":true}]}""";

    [Fact]
    public async Task Missing_issue_type_lists_the_available_ones_and_creates_nothing()
    {
        handler.Respond(HttpStatusCode.OK, ProjectJson);

        var act = () => CreateClient().CreateIssueAsync(
            Credentials, new NewIssue("ALP", "Release", "T", "D", null, null), TestContext.Current.CancellationToken);

        var error = (await act.Should().ThrowAsync<JiraException>()).Which;
        error.Message.Should().Contain("\"Release\"").And.Contain("Task, Bug, Story").And.NotContain("Sub-task");
        error.Errors.Should().ContainKey("issuetype");
        handler.Requests.Should().ContainSingle();
    }

    [Fact]
    public async Task Issue_types_exclude_sub_tasks()
    {
        handler.Respond(HttpStatusCode.OK, ProjectJson);

        var types = await CreateClient().GetIssueTypesAsync(Credentials, "ALP", TestContext.Current.CancellationToken);

        types.Should().Equal("Task", "Bug", "Story");
    }

    [Fact]
    public async Task Story_is_created_under_its_epic_without_a_link()
    {
        handler.Respond(HttpStatusCode.OK, ProjectJson);
        handler.Respond(HttpStatusCode.Created, """{"key":"ALP-7"}""");

        var created = await CreateClient().CreateIssueAsync(
            Credentials, new NewIssue("ALP", "Story", "T", "h1. D", "ALP-1", null), TestContext.Current.CancellationToken);

        created.Should().Be(new CreatedIssue("ALP-7", "https://site.atlassian.net/browse/ALP-7", null));
        handler.Requests.Should().HaveCount(2);
        var fields = JsonNode.Parse(handler.Requests[1].Body)!["fields"]!;
        fields["parent"]!["key"]!.GetValue<string>().Should().Be("ALP-1");
        fields["issuetype"]!["name"]!.GetValue<string>().Should().Be("Story");
        fields["description"]!.GetValue<string>().Should().Be("h1. D");
    }

    [Fact]
    public async Task Bug_is_linked_to_its_story_after_creation()
    {
        handler.Respond(HttpStatusCode.OK, ProjectJson);
        handler.Respond(HttpStatusCode.Created, """{"key":"ALP-8"}""");
        handler.Respond(HttpStatusCode.Created, "");

        var created = await CreateClient().CreateIssueAsync(
            Credentials, new NewIssue("ALP", "Bug", "T", "D", null, "ALP-2"), TestContext.Current.CancellationToken);

        created.Warning.Should().BeNull();
        handler.Requests[2].Url.Should().EndWith("/rest/api/2/issueLink");
        var link = JsonNode.Parse(handler.Requests[2].Body)!;
        link["type"]!["name"]!.GetValue<string>().Should().Be("Relates");
        link["outwardIssue"]!["key"]!.GetValue<string>().Should().Be("ALP-8");
        link["inwardIssue"]!["key"]!.GetValue<string>().Should().Be("ALP-2");
    }

    [Fact]
    public async Task Failed_link_returns_the_key_with_a_warning_and_is_not_retried()
    {
        handler.Respond(HttpStatusCode.OK, ProjectJson);
        handler.Respond(HttpStatusCode.Created, """{"key":"ALP-8"}""");
        handler.Respond(HttpStatusCode.NotFound, """{"errorMessages":["No link type"],"errors":{}}""");

        var created = await CreateClient().CreateIssueAsync(
            Credentials, new NewIssue("ALP", "Bug", "T", "D", null, "ALP-2"), TestContext.Current.CancellationToken);

        created.Key.Should().Be("ALP-8");
        created.Warning.Should().Contain("ALP-2").And.Contain("No link type");
        handler.Requests.Should().HaveCount(3);
    }

    [Fact]
    public async Task Create_failure_is_not_retried_and_carries_the_field_errors()
    {
        handler.Respond(HttpStatusCode.OK, ProjectJson);
        handler.Respond(HttpStatusCode.BadRequest, """{"errorMessages":[],"errors":{"summary":"Summary is required."}}""");

        var act = () => CreateClient().CreateIssueAsync(
            Credentials, new NewIssue("ALP", "Bug", "", "D", null, null), TestContext.Current.CancellationToken);

        var error = (await act.Should().ThrowAsync<JiraException>()).Which;
        error.StatusCode.Should().Be(400);
        error.Errors.Should().ContainKey("summary");
        handler.Requests.Should().HaveCount(2);
    }

    [Fact]
    public async Task Unauthorized_is_reported_with_status_401()
    {
        handler.Respond(HttpStatusCode.Unauthorized, "");

        var act = () => CreateClient().GetDisplayNameAsync(Credentials, TestContext.Current.CancellationToken);

        (await act.Should().ThrowAsync<JiraException>()).Which.StatusCode.Should().Be(401);
    }

    [Theory]
    [InlineData("https://Site.atlassian.net/jira/software", "https://site.atlassian.net")]
    [InlineData("site.atlassian.net", "https://site.atlassian.net")]
    public void Base_url_is_normalised_to_the_site_root(string input, string expected)
    {
        JiraCredentials.TryNormalizeBaseUrl(input, out var baseUrl).Should().BeTrue();
        baseUrl.Should().Be(expected);
    }

    [Theory]
    [InlineData("")]
    [InlineData("http://site.atlassian.net")]
    [InlineData("https://evil.example.com")]
    [InlineData("https://atlassian.net.evil.com")]
    [InlineData("https://.atlassian.net")]
    public void Base_url_must_be_an_https_atlassian_cloud_site(string input)
    {
        JiraCredentials.TryNormalizeBaseUrl(input, out _).Should().BeFalse();
    }

    [Fact]
    public void Payload_builder_adds_parent_only_when_given()
    {
        JiraPayloadBuilder.BuildIssue(new NewIssue("ALP", "Bug", "T", "D", null, null))["fields"]!.AsObject().ContainsKey("parent").Should().BeFalse();
    }

    [Theory]
    [InlineData("Feature", "Story")]
    [InlineData("Bug", "Bug")]
    public void Issue_type_falls_back_to_defaults_when_the_map_is_empty(string ticketType, string expected)
    {
        new JiraOptions().IssueType(ticketType).Should().Be(expected);
    }

    private JiraClient CreateClient() => new(
        new HttpClient(handler),
        Options.Create(new JiraOptions()));

    private sealed record Recorded(string Url, string? Authorization, string Body);

    private sealed class StubHandler : HttpMessageHandler
    {
        private readonly Queue<(HttpStatusCode Status, string Body)> responses = new();

        public List<Recorded> Requests { get; } = [];

        public void Respond(HttpStatusCode status, string body) => responses.Enqueue((status, body));

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add(new Recorded(
                request.RequestUri!.ToString(),
                request.Headers.Authorization?.ToString(),
                request.Content is null ? "" : await request.Content.ReadAsStringAsync(cancellationToken)));
            var (status, body) = responses.Dequeue();
            return new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        }
    }
}
