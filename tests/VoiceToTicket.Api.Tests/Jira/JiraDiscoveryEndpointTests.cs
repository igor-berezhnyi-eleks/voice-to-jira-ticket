using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using VoiceToTicket.Api.Features.Jira;
using VoiceToTicket.Api.Features.Jira.Contract;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Tests.Jira;

/// <summary>The discovery endpoints through the whole pipeline, with a fake Jira client and a real session cookie.</summary>
public sealed class JiraDiscoveryEndpointTests
{
    private static readonly DateTimeOffset Start = new(2026, 11, 12, 9, 0, 0, TimeSpan.Zero);
    private static readonly string[] Everything =
    [
        "GET /api/jira/projects",
        "GET /api/jira/projects/SCRUM/issue-types",
        "GET /api/jira/projects/SCRUM/issue-types/10003/fields",
        "GET /api/jira/link-types",
        "POST /api/jira/issues/search",
    ];

    private readonly ManualTimeProvider time = new(Start);

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    public async Task Every_endpoint_needs_a_session(int index)
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake);
        using var client = NewClient(factory);

        var response = await Send(client, Everything[index], cookie: null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(ErrorCodes.JiraAuthRequired, (await ReadJson(response)).GetProperty("code").GetString());
        Assert.Equal(0, fake.Calls);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    public async Task Every_endpoint_is_404_jira_not_configured_when_Jira_is_off(int index)
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake, enabled: false);
        using var client = NewClient(factory);

        var response = await Send(client, Everything[index], cookie: null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(ErrorCodes.JiraNotConfigured, (await ReadJson(response)).GetProperty("code").GetString());
        Assert.Equal(0, fake.Calls);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    public async Task A_Jira_401_gives_jira_auth_required_and_clears_the_cookie(int index)
    {
        using var factory = Create(new FakeJiraClient { Failure = JiraErrors.AuthRequired });
        using var client = NewClient(factory);
        var cookie = await Connect(client);

        var response = await Send(client, Everything[index], cookie);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(ErrorCodes.JiraAuthRequired, (await ReadJson(response)).GetProperty("code").GetString());
        Assert.Contains("expires=thu, 01 jan 1970", string.Join(";", response.Headers.GetValues("Set-Cookie")).ToLowerInvariant());
    }

    [Fact]
    public async Task A_Jira_404_for_an_unknown_project_is_jira_not_found()
    {
        using var factory = Create(new FakeJiraClient { Failure = JiraErrors.NotFound });
        using var client = NewClient(factory);
        var cookie = await Connect(client);

        var response = await Send(client, "GET /api/jira/projects/NOPE/issue-types", cookie);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(ErrorCodes.JiraNotFound, (await ReadJson(response)).GetProperty("code").GetString());
    }

    [Fact]
    public async Task Projects_are_sorted_by_name()
    {
        var fake = new FakeJiraClient { Projects = [new("ZED", "zebra"), new("AAA", "Banana"), new("MID", "apple")] };
        using var factory = Create(fake);
        using var client = NewClient(factory);

        var body = await ReadJson(await Send(client, "GET /api/jira/projects", await Connect(client)));

        Assert.Equal(["MID", "AAA", "ZED"], body.EnumerateArray().Select(project => project.GetProperty("key").GetString()));
        Assert.Equal("apple", body[0].GetProperty("name").GetString());
    }

    [Fact]
    public async Task Issue_types_leave_out_subtasks_and_carry_the_suggestion_per_ticket_type()
    {
        var fake = new FakeJiraClient
        {
            IssueTypes = CreateMetadataParser.ParseIssueTypes(JsonDocument.Parse(JiraFixtures.CompanyIssueTypes).RootElement),
        };
        using var factory = Create(fake);
        using var client = NewClient(factory);

        var body = await ReadJson(await Send(client, "GET /api/jira/projects/SCRUM/issue-types", await Connect(client)));

        Assert.Equal(["Epic", "Story", "Task", "Bug"], body.EnumerateArray().Select(type => type.GetProperty("name").GetString()));
        Assert.Equal(1, body[0].GetProperty("hierarchyLevel").GetInt32());
        Assert.Empty(body[0].GetProperty("suggestedFor").EnumerateArray());
        Assert.Equal(["Feature"], body[1].GetProperty("suggestedFor").EnumerateArray().Select(value => value.GetString())); // Story
        Assert.Equal(["Bug"], body[3].GetProperty("suggestedFor").EnumerateArray().Select(value => value.GetString()));
    }

    [Fact]
    public async Task Configured_preferred_names_replace_the_defaults()
    {
        var fake = new FakeJiraClient
        {
            IssueTypes = CreateMetadataParser.ParseIssueTypes(JsonDocument.Parse(JiraFixtures.CompanyIssueTypes).RootElement),
        };
        using var factory = Create(fake, extra: new()
        {
            ["Jira:PreferredIssueTypes:Bug:0"] = "Task",
            ["Jira:PreferredIssueTypes:Feature:0"] = "Epic",
        });
        using var client = NewClient(factory);

        var body = await ReadJson(await Send(client, "GET /api/jira/projects/SCRUM/issue-types", await Connect(client)));

        Assert.Equal(["Feature"], body[0].GetProperty("suggestedFor").EnumerateArray().Select(value => value.GetString())); // Epic
        Assert.Equal(["Bug"], body[2].GetProperty("suggestedFor").EnumerateArray().Select(value => value.GetString())); // Task
    }

    [Fact]
    public async Task Fields_return_typed_fields_and_the_parent_types()
    {
        var fake = new FakeJiraClient
        {
            IssueTypes = CreateMetadataParser.ParseIssueTypes(JsonDocument.Parse(JiraFixtures.CompanyIssueTypes).RootElement),
            Fields = CreateMetadataParser.ParseFields(JsonDocument.Parse(JiraFixtures.CompanyBugFields).RootElement),
        };
        using var factory = Create(fake);
        using var client = NewClient(factory);

        var body = await ReadJson(await Send(client, "GET /api/jira/projects/SCRUM/issue-types/10003/fields", await Connect(client)));

        Assert.Equal(["10000"], body.GetProperty("parentTypeIds").EnumerateArray().Select(id => id.GetString()));
        var fields = body.GetProperty("fields").EnumerateArray().ToList();
        Assert.Equal(11, fields.Count);
        var severity = fields.Single(field => field.GetProperty("fieldId").GetString() == "customfield_10050");
        Assert.Equal("option", severity.GetProperty("kind").GetString());
        Assert.True(severity.GetProperty("required").GetBoolean());
        Assert.Equal("Major", severity.GetProperty("allowedValues")[1].GetProperty("name").GetString());
        var labels = fields.Single(field => field.GetProperty("fieldId").GetString() == "labels");
        Assert.Equal(JsonValueKind.Null, labels.GetProperty("allowedValues").ValueKind);
        Assert.Equal("unsupported", fields.Single(field => field.GetProperty("fieldId").GetString() == "customfield_10052").GetProperty("kind").GetString());
    }

    [Fact]
    public async Task Fields_of_a_type_the_project_does_not_have_are_jira_not_found()
    {
        var fake = new FakeJiraClient { IssueTypes = [new("10001", "Story", 0, false)] };
        using var factory = Create(fake);
        using var client = NewClient(factory);

        var response = await Send(client, "GET /api/jira/projects/SCRUM/issue-types/99999/fields", await Connect(client));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(ErrorCodes.JiraNotFound, (await ReadJson(response)).GetProperty("code").GetString());
    }

    [Theory]
    [InlineData("GET /api/jira/projects/scrum/issue-types")]
    [InlineData("GET /api/jira/projects/S/issue-types")]
    [InlineData("GET /api/jira/projects/SCRUM/issue-types/abc/fields")]
    [InlineData("GET /api/jira/projects/SCRUM%22%20OR%201=1/issue-types/1/fields")]
    public async Task A_malformed_project_key_or_type_id_is_400_validation_and_Jira_is_not_called(string route)
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake);
        using var client = NewClient(factory);
        var cookie = await Connect(client);
        var callsBefore = fake.Calls; // connecting calls Jira once

        var response = await Send(client, route, cookie);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(ErrorCodes.Validation, (await ReadJson(response)).GetProperty("code").GetString());
        Assert.Equal(callsBefore, fake.Calls);
    }

    [Fact]
    public async Task A_malformed_key_without_a_session_is_still_jira_auth_required_and_with_Jira_off_jira_not_configured()
    {
        using var factory = Create(new FakeJiraClient());
        using var client = NewClient(factory);
        var unauthorized = await Send(client, "GET /api/jira/projects/scrum/issue-types", cookie: null);
        Assert.Equal(ErrorCodes.JiraAuthRequired, (await ReadJson(unauthorized)).GetProperty("code").GetString());

        using var offFactory = Create(new FakeJiraClient(), enabled: false);
        using var offClient = NewClient(offFactory);
        var off = await Send(offClient, "GET /api/jira/projects/SCRUM/issue-types/abc/fields", cookie: null);
        Assert.Equal(ErrorCodes.JiraNotConfigured, (await ReadJson(off)).GetProperty("code").GetString());
    }

    [Fact]
    public async Task Link_types_mark_the_configured_default_only_when_the_site_has_it()
    {
        var fake = new FakeJiraClient { LinkTypes = [new("Blocks", "is blocked by", "blocks", false), new("Relates", "relates to", "relates to", false)] };
        using var factory = Create(fake);
        using var client = NewClient(factory);
        var cookie = await Connect(client);

        var body = await ReadJson(await Send(client, "GET /api/jira/link-types", cookie));

        Assert.Equal([false, true], body.EnumerateArray().Select(type => type.GetProperty("isDefault").GetBoolean()));
        Assert.Equal("is blocked by", body[0].GetProperty("inward").GetString());

        fake.LinkTypes = [new("Blocks", "is blocked by", "blocks", false)];
        var without = await ReadJson(await Send(client, "GET /api/jira/link-types", cookie));
        Assert.Equal([false], without.EnumerateArray().Select(type => type.GetProperty("isDefault").GetBoolean()));
    }

    [Fact]
    public async Task Search_sends_the_built_jql_and_returns_the_hits()
    {
        var fake = new FakeJiraClient { SearchHits = [new("SCRUM-1", "Login fails", "Bug", "To Do")] };
        using var factory = Create(fake);
        using var client = NewClient(factory);

        var response = await Send(client, "POST /api/jira/issues/search", await Connect(client), """{"projectKey": "SCRUM", "issueTypeIds": ["10000"], "query": "login"}""");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("""project = "SCRUM" AND issuetype in (10000) AND summary ~ "login*" ORDER BY updated DESC""", Assert.Single(fake.SearchedJql));
        var hit = (await ReadJson(response))[0];
        Assert.Equal(("SCRUM-1", "Login fails", "Bug", "To Do"), (hit.GetProperty("key").GetString(), hit.GetProperty("summary").GetString(), hit.GetProperty("issueType").GetString(), hit.GetProperty("status").GetString()));
        Assert.Empty(fake.LookedUpKeys);
    }

    [Fact]
    public async Task A_key_shaped_query_looks_the_key_up_separately_and_puts_it_first()
    {
        var fake = new FakeJiraClient { SearchHits = [new("SCRUM-3", "About SCRUM-12", "Task", "Done")] };
        fake.Issues["SCRUM-12"] = new JiraIssueDetail(new("SCRUM-12", "Epic one", "Epic", "To Do"), "10000");
        using var factory = Create(fake);
        using var client = NewClient(factory);

        var body = await ReadJson(await Send(client, "POST /api/jira/issues/search", await Connect(client), """{"query": "scrum-12"}"""));

        Assert.Equal(["SCRUM-12", "SCRUM-3"], body.EnumerateArray().Select(hit => hit.GetProperty("key").GetString()));
        Assert.Equal(["SCRUM-12"], fake.LookedUpKeys);
        Assert.DoesNotContain("key =", Assert.Single(fake.SearchedJql));
    }

    [Fact]
    public async Task An_unknown_key_returns_the_text_matches_not_an_error()
    {
        var fake = new FakeJiraClient { SearchHits = [new("SCRUM-3", "Mentions SCRUM-99", "Task", "Done")] };
        using var factory = Create(fake);
        using var client = NewClient(factory);

        var response = await Send(client, "POST /api/jira/issues/search", await Connect(client), """{"query": "SCRUM-99"}""");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(["SCRUM-3"], (await ReadJson(response)).EnumerateArray().Select(hit => hit.GetProperty("key").GetString()));
    }

    [Fact]
    public async Task A_key_Jira_will_not_show_is_no_hit()
    {
        var fake = new FakeJiraClient { IssueFailure = () => JiraErrors.NotFound() };
        using var factory = Create(fake);
        using var client = NewClient(factory);

        var response = await Send(client, "POST /api/jira/issues/search", await Connect(client), """{"query": "SCRUM-99"}""");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty((await ReadJson(response)).EnumerateArray());
    }

    [Fact]
    public async Task A_key_lookup_that_fails_for_another_reason_fails_the_search()
    {
        var fake = new FakeJiraClient { IssueFailure = () => JiraErrors.Unavailable() };
        using var factory = Create(fake);
        using var client = NewClient(factory);

        var response = await Send(client, "POST /api/jira/issues/search", await Connect(client), """{"query": "SCRUM-99"}""");

        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
    }

    [Theory]
    [InlineData("""{"projectKey": "OTHER", "query": "SCRUM-12"}""")]
    [InlineData("""{"projectKey": "SCRUM", "issueTypeIds": ["10001"], "query": "SCRUM-12"}""")]
    public async Task The_key_hit_obeys_the_project_and_type_filters(string request)
    {
        var fake = new FakeJiraClient();
        fake.Issues["SCRUM-12"] = new JiraIssueDetail(new("SCRUM-12", "Epic one", "Epic", "To Do"), "10000");
        using var factory = Create(fake);
        using var client = NewClient(factory);

        var body = await ReadJson(await Send(client, "POST /api/jira/issues/search", await Connect(client), request));

        Assert.Empty(body.EnumerateArray());
    }

    [Fact]
    public async Task The_same_issue_found_by_key_and_by_text_appears_once()
    {
        var fake = new FakeJiraClient { SearchHits = [new("SCRUM-12", "Epic one", "Epic", "To Do")] };
        fake.Issues["SCRUM-12"] = new JiraIssueDetail(new("SCRUM-12", "Epic one", "Epic", "To Do"), "10000");
        using var factory = Create(fake);
        using var client = NewClient(factory);

        var body = await ReadJson(await Send(client, "POST /api/jira/issues/search", await Connect(client), """{"query": "SCRUM-12"}"""));

        Assert.Single(body.EnumerateArray());
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("""{"query": ""}""")]
    [InlineData("""{"query": "***"}""")]
    [InlineData("""{"issueTypeIds": ["10000"]}""")]
    [InlineData("""{"projectKey": "bad key", "query": "x"}""")]
    [InlineData("""{"projectKey": "SCRUM", "issueTypeIds": ["x"], "query": "x"}""")]
    public async Task A_search_with_nothing_to_search_by_or_a_bad_value_is_400_validation(string request)
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake);
        using var client = NewClient(factory);

        var response = await Send(client, "POST /api/jira/issues/search", await Connect(client), request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(ErrorCodes.Validation, (await ReadJson(response)).GetProperty("code").GetString());
        Assert.Empty(fake.SearchedJql);
    }

    [Fact]
    public async Task A_search_with_a_project_and_no_text_is_allowed()
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake);
        using var client = NewClient(factory);

        var response = await Send(client, "POST /api/jira/issues/search", await Connect(client), """{"projectKey": "SCRUM"}""");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("""project = "SCRUM" ORDER BY updated DESC""", Assert.Single(fake.SearchedJql));
    }

    [Fact]
    public async Task A_form_body_on_search_is_415()
    {
        using var factory = Create(new FakeJiraClient());
        using var client = NewClient(factory);
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/jira/issues/search")
        {
            Content = new StringContent("query=login", Encoding.UTF8, "application/x-www-form-urlencoded"),
        };
        request.Headers.Add("Cookie", $"vtt_jira={await Connect(client)}");

        var response = await client.SendAsync(request, Ct);

        Assert.Equal(HttpStatusCode.UnsupportedMediaType, response.StatusCode);
    }

    private WebApplicationFactory<Program> Create(IJiraClient fake, bool enabled = true, Dictionary<string, string?>? extra = null) =>
        new ApiFactory().WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, configuration) =>
            {
                var settings = new Dictionary<string, string?>
                {
                    ["Jira:Enabled"] = enabled ? "true" : "false",
                    ["Jira:BaseUrl"] = "https://jira.test",
                };
                foreach (var (key, value) in extra ?? [])
                {
                    settings[key] = value;
                }

                configuration.AddInMemoryCollection(settings);
            });
            builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<TimeProvider>(time);
                services.AddSingleton(fake);
            });
        });

    private static HttpClient NewClient(WebApplicationFactory<Program> factory) =>
        factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    // The fake client accepts any login, so connecting only serves to get a real session cookie.
    private static async Task<string> Connect(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/jira/session", new JiraSessionRequest("dev@example.com", "secret-token"), Ct);
        var header = Assert.Single(response.Headers.GetValues("Set-Cookie"));
        return header["vtt_jira=".Length..header.IndexOf(';')];
    }

    private static async Task<HttpResponseMessage> Send(HttpClient client, string route, string? cookie, string? json = null)
    {
        var parts = route.Split(' ', 2);
        using var request = new HttpRequestMessage(new HttpMethod(parts[0]), parts[1]);
        if (cookie is not null)
        {
            request.Headers.Add("Cookie", $"vtt_jira={cookie}");
        }

        if (parts[0] == "POST")
        {
            request.Content = new StringContent(json ?? """{"query": "x"}""", Encoding.UTF8, "application/json");
        }

        return await client.SendAsync(request, Ct);
    }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement.Clone();
}
