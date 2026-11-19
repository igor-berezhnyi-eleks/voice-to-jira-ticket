using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using VoiceToTicket.Api.Features.Jira;
using VoiceToTicket.Api.Features.Jira.Contract;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Tests.Jira;

/// <summary>
/// Jira Server 7.8 mode (jira-plan section 14). The create-metadata answers are written from the 7.8.0 REST reference
/// (<c>GET /rest/api/2/issue/createmeta</c>: <c>projects[].issuetypes[].fields</c> keyed by field id), not from a real site.
/// </summary>
public sealed class JiraServerTests
{
    // J10: the type and sign-in live in the session. Client tests configure the opposite type, so only the session decides.
    private static readonly JiraCredentials Credentials = new("", "secret-token", "https://jira.test", null, JiraDeployment.Server, JiraServerAuthScheme.Bearer);

    private static readonly JiraCredentials CloudCredentials = new("dev", "secret-token", "https://jira.test");

    private const string ProjectsMeta = """
        {"expand":"projects","projects":[
          {"self":"https://jira.test/rest/api/2/project/10000","id":"10000","key":"DEMO","name":"Demo","issuetypes":[]},
          {"id":"10001","key":"OPS","name":"Operations","issuetypes":[]}
        ]}
        """;

    private const string TypesMeta = """
        {"expand":"projects","projects":[{"id":"10000","key":"DEMO","name":"Demo","issuetypes":[
          {"id":"10000","name":"Epic","subtask":false},
          {"id":"10001","name":"Story","subtask":false},
          {"id":"10004","name":"Bug","subtask":false},
          {"id":"10005","name":"Sub-task","subtask":true}
        ]}]}
        """;

    private const string StoryFieldsMeta = """
        {"expand":"projects","projects":[{"id":"10000","key":"DEMO","name":"Demo","issuetypes":[
          {"id":"10001","name":"Story","subtask":false,"fields":{
            "summary":{"required":true,"schema":{"type":"string","system":"summary"},"name":"Summary","hasDefaultValue":false,"operations":["set"]},
            "issuetype":{"required":true,"schema":{"type":"issuetype","system":"issuetype"},"name":"Issue Type","hasDefaultValue":false,"operations":[]},
            "priority":{"required":false,"schema":{"type":"priority","system":"priority"},"name":"Priority","hasDefaultValue":true,"operations":["set"],
              "allowedValues":[{"self":"https://jira.test/rest/api/2/priority/1","name":"Blocker","id":"1"},{"self":"https://jira.test/rest/api/2/priority/3","name":"Major","id":"3"}]},
            "labels":{"required":false,"schema":{"type":"array","items":"string","system":"labels"},"name":"Labels","hasDefaultValue":false,"operations":["add","set","remove"],"autoCompleteUrl":"https://jira.test/rest/api/1.0/labels/suggest?query="},
            "customfield_10008":{"required":false,"schema":{"type":"array","items":"string","custom":"com.pyxis.greenhopper.jira:gh-epic-link","customId":10008},"name":"Epic Link","hasDefaultValue":false,"operations":["set"]},
            "customfield_10100":{"required":true,"schema":{"type":"option","custom":"com.atlassian.jira.plugin.system.customfieldtypes:select","customId":10100},"name":"Severity","hasDefaultValue":false,"operations":["set"],
              "allowedValues":[{"self":"https://jira.test/rest/api/2/customFieldOption/10200","value":"Minor","id":"10200"},{"self":"https://jira.test/rest/api/2/customFieldOption/10201","value":"Major","id":"10201"}]}
          }}
        ]}]}
        """;

    private const string AllTypesWithFieldsMeta = """
        {"expand":"projects","projects":[{"id":"10000","key":"DEMO","name":"Demo","issuetypes":[
          {"id":"10000","name":"Epic","subtask":false,"fields":{
            "summary":{"required":true,"schema":{"type":"string","system":"summary"},"name":"Summary","hasDefaultValue":false},
            "customfield_10009":{"required":true,"schema":{"type":"string","custom":"com.pyxis.greenhopper.jira:gh-epic-label","customId":10009},"name":"Epic Name","hasDefaultValue":false}
          }},
          {"id":"10001","name":"Story","subtask":false,"fields":{
            "customfield_10008":{"required":false,"schema":{"type":"array","items":"string","custom":"com.pyxis.greenhopper.jira:gh-epic-link","customId":10008},"name":"Epic Link","hasDefaultValue":false}
          }},
          {"id":"10005","name":"Sub-task","subtask":true,"fields":{
            "customfield_10009":{"required":true,"schema":{"type":"string","custom":"com.pyxis.greenhopper.jira:gh-epic-label","customId":10009},"name":"Epic Name","hasDefaultValue":false}
          }}
        ]}]}
        """;

    // ---------- options

    [Theory]
    [InlineData("Banana", "Jira:Deployment")]
    [InlineData("7", "Jira:Deployment")]
    [InlineData("Banana", "Jira:ServerAuthScheme")]
    [InlineData("9", "Jira:ServerAuthScheme")]
    public void An_unknown_deployment_or_scheme_fails_start(string value, string key)
    {
        using var provider = Provider(new() { ["Jira:Enabled"] = "true", ["Jira:BaseUrl"] = "https://jira.test", [key] = value });

        Assert.ThrowsAny<Exception>(() => provider.GetRequiredService<IOptions<JiraOptions>>().Value);
    }

    [Fact]
    public void Defaults_are_cloud_and_bearer_and_server_values_bind()
    {
        using var defaults = Provider(new() { ["Jira:Enabled"] = "true", ["Jira:BaseUrl"] = "https://jira.test" });
        var options = defaults.GetRequiredService<IOptions<JiraOptions>>().Value;
        Assert.Equal((JiraDeployment.Cloud, JiraServerAuthScheme.Bearer), (options.Deployment, options.ServerAuthScheme));
        Assert.Equal(JiraServerAuthScheme.Basic, options.DefaultAuthScheme(JiraDeployment.Cloud)); // Bearer only applies to Server.
        Assert.Equal(JiraServerAuthScheme.Bearer, options.DefaultAuthScheme(JiraDeployment.Server));

        using var server = Provider(new()
        {
            ["Jira:Enabled"] = "true", ["Jira:BaseUrl"] = "https://jira.test", ["Jira:Deployment"] = "server", ["Jira:ServerAuthScheme"] = "basic",
        });
        var serverOptions = server.GetRequiredService<IOptions<JiraOptions>>().Value;
        Assert.Equal((JiraDeployment.Server, JiraServerAuthScheme.Basic), (serverOptions.Deployment, serverOptions.ServerAuthScheme));
    }

    // ---------- auth header

    [Theory]
    [InlineData(JiraDeployment.Server, JiraServerAuthScheme.Bearer, "Bearer", "secret-token")]
    [InlineData(JiraDeployment.Server, JiraServerAuthScheme.Basic, "Basic", "dev:secret-token")]
    [InlineData(JiraDeployment.Cloud, JiraServerAuthScheme.Bearer, "Basic", "dev:secret-token")] // the scheme is ignored on Cloud
    public async Task The_authorization_header_follows_the_session(JiraDeployment deployment, JiraServerAuthScheme scheme, string expectedScheme, string expectedValue)
    {
        HttpRequestMessage? seen = null;
        var client = CreateClient(Opposite(deployment), (request, _) =>
        {
            seen = request;
            return Task.FromResult(Json("""{"displayName": "Ada Lovelace"}"""));
        });

        await client.GetMyselfAsync(new JiraCredentials("dev", "secret-token", "https://jira.test", null, deployment, scheme), CancellationToken.None);

        Assert.Equal(expectedScheme, seen!.Headers.Authorization!.Scheme);
        var parameter = seen.Headers.Authorization.Parameter!;
        Assert.Equal(expectedValue, expectedScheme == "Basic" ? Encoding.UTF8.GetString(Convert.FromBase64String(parameter)) : parameter);
    }

    // ---------- login errors

    [Fact]
    public async Task A_server_401_on_login_says_username_and_password_or_token()
    {
        var exception = await FailLogin(HttpStatusCode.Unauthorized, JiraDeployment.Server);

        Assert.Equal((401, ErrorCodes.JiraAuthDenied), (exception.StatusCode, exception.Code));
        Assert.Contains("username and password or token", exception.Message);
    }

    [Theory]
    [InlineData("X-Seraph-LoginReason", "AUTHENTICATION_DENIED")]
    [InlineData("X-Seraph-LoginReason", "AUTHENTICATED_FAILED")]
    [InlineData("X-Authentication-Denied-Reason", "CAPTCHA_CHALLENGE; login-url=https://jira.test/login.jsp")]
    public async Task A_server_403_with_a_login_denied_header_is_auth_denied_with_the_captcha_hint(string header, string value)
    {
        var exception = await FailLogin(HttpStatusCode.Forbidden, JiraDeployment.Server, (header, value));

        Assert.Equal((401, ErrorCodes.JiraAuthDenied), (exception.StatusCode, exception.Code));
        var detail = (await ProblemDetailOf(exception));
        Assert.Contains("Log in to Jira in the browser once", detail);
    }

    [Fact]
    public async Task A_server_403_without_the_header_stays_forbidden_and_Cloud_ignores_the_header()
    {
        var plain = await FailLogin(HttpStatusCode.Forbidden, JiraDeployment.Server);
        var cloud = await FailLogin(HttpStatusCode.Forbidden, JiraDeployment.Cloud, ("X-Seraph-LoginReason", "AUTHENTICATION_DENIED"));

        Assert.Equal(ErrorCodes.JiraForbidden, plain.Code);
        Assert.Equal(ErrorCodes.JiraForbidden, cloud.Code);
    }

    // ---------- discovery

    [Fact]
    public async Task Server_projects_come_from_createmeta_without_expand()
    {
        HttpRequestMessage? seen = null;
        var client = CreateClient(JiraDeployment.Cloud, (request, _) =>
        {
            seen = request;
            return Task.FromResult(Json(ProjectsMeta));
        });

        var projects = await client.GetProjectsAsync(Credentials, CancellationToken.None);

        Assert.Equal("https://jira.test/rest/api/2/issue/createmeta", seen!.RequestUri!.ToString());
        Assert.Equal(["DEMO:Demo", "OPS:Operations"], projects.Select(project => $"{project.Key}:{project.Name}"));
    }

    [Fact]
    public async Task Server_issue_types_come_from_createmeta_by_project_key_with_the_subtask_flag()
    {
        HttpRequestMessage? seen = null;
        var client = CreateClient(JiraDeployment.Cloud, (request, _) =>
        {
            seen = request;
            return Task.FromResult(Json(TypesMeta));
        });

        var types = await client.GetIssueTypesAsync(Credentials, "DEMO", CancellationToken.None);

        Assert.Equal("https://jira.test/rest/api/2/issue/createmeta?projectKeys=DEMO", seen!.RequestUri!.ToString());
        Assert.Equal(["10000", "10001", "10004", "10005"], types.Select(type => type.Id));
        Assert.Equal([false, false, false, true], types.Select(type => type.Subtask));
        Assert.Equal(["10000", "10001", "10004"], CreateMetadataMapper.CreatableTypes(types).Select(type => type.Id)); // subtasks left out
    }

    [Fact]
    public async Task Server_issue_types_of_a_project_the_user_cannot_create_in_are_not_found()
    {
        var client = CreateClient(JiraDeployment.Cloud, (_, _) =>
            Task.FromResult(Json("""{"expand":"projects","projects":[]}""")));

        var exception = await Assert.ThrowsAsync<JiraApiException>(() => client.GetIssueTypesAsync(Credentials, "DEMO", CancellationToken.None));

        Assert.Equal(ErrorCodes.JiraNotFound, exception.Code);
    }

    [Fact]
    public async Task Server_fields_come_from_the_fields_object_keyed_by_id()
    {
        HttpRequestMessage? seen = null;
        var client = CreateClient(JiraDeployment.Cloud, (request, _) =>
        {
            seen = request;
            return Task.FromResult(Json(StoryFieldsMeta));
        });

        var fields = await client.GetCreateFieldsAsync(Credentials, "DEMO", "10001", CancellationToken.None);

        Assert.Equal(
            "https://jira.test/rest/api/2/issue/createmeta?projectKeys=DEMO&issuetypeIds=10001&expand=projects.issuetypes.fields",
            seen!.RequestUri!.ToString());
        Assert.Equal(["summary", "issuetype", "priority", "labels", "customfield_10008", "customfield_10100"], fields.Select(field => field.FieldId));
        var severity = fields.Single(field => field.FieldId == "customfield_10100");
        Assert.True(severity.Required);
        Assert.Equal(["10200:Minor", "10201:Major"], severity.AllowedValues!.Select(value => $"{value.Id}:{value.Name}"));
        Assert.Equal("Blocker", fields.Single(field => field.FieldId == "priority").AllowedValues![0].Name);
    }

    [Fact]
    public async Task Server_fields_of_a_type_that_is_not_in_the_answer_are_not_found()
    {
        var client = CreateClient(JiraDeployment.Cloud, (_, _) => Task.FromResult(Json(StoryFieldsMeta)));

        var exception = await Assert.ThrowsAsync<JiraApiException>(() => client.GetCreateFieldsAsync(Credentials, "DEMO", "99999", CancellationToken.None));

        Assert.Equal(ErrorCodes.JiraNotFound, exception.Code);
    }

    [Fact]
    public void The_server_fields_map_like_the_cloud_ones_and_hide_the_epic_link()
    {
        var parsed = CreateMetadataParser.ParseServerFields(JsonDocument.Parse(StoryFieldsMeta).RootElement, "DEMO", "10001")!;

        var mapped = CreateMetadataMapper.MapFields(parsed);

        Assert.Equal(["priority", "labels", "customfield_10100"], mapped.Select(field => field.FieldId)); // no summary, issuetype, Epic Link
        Assert.Equal(JiraFieldKind.Option, mapped.Single(field => field.FieldId == "priority").Kind);
        Assert.Equal(JiraFieldKind.Unsupported, mapped.Single(field => field.FieldId == "labels").Kind); // autocomplete: not fillable
        Assert.Equal(JiraFieldKind.Option, mapped.Single(field => field.FieldId == "customfield_10100").Kind);
    }

    [Fact]
    public async Task Epic_types_are_the_types_with_an_Epic_Name_field_and_not_subtasks()
    {
        HttpRequestMessage? seen = null;
        var client = CreateClient(JiraDeployment.Cloud, (request, _) =>
        {
            seen = request;
            return Task.FromResult(Json(AllTypesWithFieldsMeta));
        });

        var ids = await client.GetEpicTypeIdsAsync(Credentials, "DEMO", CancellationToken.None);

        Assert.Equal(["10000"], ids);
        Assert.Equal("https://jira.test/rest/api/2/issue/createmeta?projectKeys=DEMO&expand=projects.issuetypes.fields", seen!.RequestUri!.ToString());
    }

    [Fact]
    public async Task Cloud_has_no_epic_types_and_makes_no_call()
    {
        var client = CreateClient(JiraDeployment.Server, (_, _) => throw new InvalidOperationException("no call expected"));

        Assert.Empty(await client.GetEpicTypeIdsAsync(CloudCredentials, "DEMO", CancellationToken.None));
    }

    // ---------- search

    [Fact]
    public async Task Server_search_posts_jql_start_at_max_results_and_fields_to_search()
    {
        HttpRequestMessage? seen = null;
        string? body = null;
        var client = CreateClient(JiraDeployment.Cloud, async (request, token) =>
        {
            seen = request;
            body = await request.Content!.ReadAsStringAsync(token);
            return Json("""{"startAt":0,"maxResults":20,"total":1,"issues":[{"key":"DEMO-5","fields":{"summary":"Login fails","issuetype":{"id":"10004","name":"Bug"},"status":{"name":"Open"}}}]}""");
        });

        var hits = await client.SearchIssuesAsync(Credentials, "project = DEMO", CancellationToken.None);

        Assert.Equal(HttpMethod.Post, seen!.Method);
        Assert.Equal("https://jira.test/rest/api/2/search", seen.RequestUri!.ToString());
        Assert.DoesNotContain("project", seen.RequestUri.Query);
        var json = JsonNode.Parse(body!)!;
        Assert.Equal("project = DEMO", json["jql"]!.GetValue<string>());
        Assert.Equal(0, json["startAt"]!.GetValue<int>());
        Assert.Equal(20, json["maxResults"]!.GetValue<int>());
        Assert.Equal(["summary", "issuetype", "status"], json["fields"]!.AsArray().Select(field => field!.GetValue<string>()));
        Assert.Equal("DEMO-5", Assert.Single(hits).Key);
    }

    [Fact]
    public async Task Cloud_search_still_uses_search_jql_without_start_at()
    {
        HttpRequestMessage? seen = null;
        string? body = null;
        var client = CreateClient(JiraDeployment.Server, async (request, token) =>
        {
            seen = request;
            body = await request.Content!.ReadAsStringAsync(token);
            return Json("""{"issues":[]}""");
        });

        await client.SearchIssuesAsync(CloudCredentials, "project = DEMO", CancellationToken.None);

        Assert.Equal("https://jira.test/rest/api/2/search/jql", seen!.RequestUri!.ToString());
        Assert.Null(JsonNode.Parse(body!)!["startAt"]);
    }

    // ---------- payload

    [Fact]
    public void The_server_parent_is_the_epic_link_field_not_parent()
    {
        var request = new CreateIssueRequest("DEMO", "10001", "S", "D", "DEMO-12", new Dictionary<string, FieldValue>(), []);

        var payload = IssuePayloadBuilder.Build(request, "customfield_10008");
        var fields = payload["fields"]!.AsObject();

        Assert.Equal("DEMO-12", fields["customfield_10008"]!.GetValue<string>());
        Assert.False(fields.ContainsKey("parent"));
    }

    [Fact]
    public void Without_an_epic_link_field_id_the_cloud_parent_is_unchanged()
    {
        var request = new CreateIssueRequest("DEMO", "10001", "S", "D", "DEMO-12", new Dictionary<string, FieldValue>(), []);

        var fields = IssuePayloadBuilder.Build(request)["fields"]!.AsObject();

        Assert.Equal("DEMO-12", fields["parent"]!["key"]!.GetValue<string>());
    }

    // ---------- endpoints

    [Fact]
    public async Task Status_reports_the_deployment_and_scheme()
    {
        using var server = Create(new FakeJiraClient(), JiraDeployment.Server, JiraServerAuthScheme.Bearer);
        using var cloud = Create(new FakeJiraClient(), JiraDeployment.Cloud, JiraServerAuthScheme.Bearer);
        using var basic = Create(new FakeJiraClient(), JiraDeployment.Server, JiraServerAuthScheme.Basic);

        var serverStatus = await GetStatus(server);
        var cloudStatus = await GetStatus(cloud);
        var basicStatus = await GetStatus(basic);

        Assert.Equal(("Server", "Bearer"), (serverStatus.GetProperty("deployment").GetString(), serverStatus.GetProperty("authScheme").GetString()));
        Assert.Equal(("Cloud", "Basic"), (cloudStatus.GetProperty("deployment").GetString(), cloudStatus.GetProperty("authScheme").GetString()));
        Assert.Equal(("Server", "Basic"), (basicStatus.GetProperty("deployment").GetString(), basicStatus.GetProperty("authScheme").GetString()));
        Assert.Equal("Bearer", cloudStatus.GetProperty("defaultServerAuthScheme").GetString()); // the panel's start when the user picks Server
        Assert.Equal("Basic", basicStatus.GetProperty("defaultServerAuthScheme").GetString());
    }

    [Fact]
    public async Task A_bearer_login_needs_only_the_secret_and_a_basic_login_needs_both()
    {
        var bearerFake = new FakeJiraClient();
        using var bearer = Create(bearerFake, JiraDeployment.Server, JiraServerAuthScheme.Bearer);
        using var basic = Create(new FakeJiraClient(), JiraDeployment.Server, JiraServerAuthScheme.Basic);

        var ok = await bearer.CreateClient().PostAsJsonAsync("/api/jira/session", new { secret = "tok" }, Ct);
        var refused = await basic.CreateClient().PostAsJsonAsync("/api/jira/session", new { secret = "tok" }, Ct);

        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal(new JiraCredentials("", "tok", "https://jira.test", null, JiraDeployment.Server, JiraServerAuthScheme.Bearer), bearerFake.LastCredentials);
        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
    }

    [Fact]
    public async Task A_bearer_login_ignores_a_login_in_the_body()
    {
        var fake = new FakeJiraClient();
        using var bearer = Create(fake, JiraDeployment.Server, JiraServerAuthScheme.Bearer);

        await bearer.CreateClient().PostAsJsonAsync("/api/jira/session", new { login = "someone", secret = "tok" }, Ct);

        Assert.Equal("", fake.LastCredentials!.Login);
    }

    [Fact]
    public async Task Server_fields_offer_epics_as_parents_only_for_a_type_with_an_epic_link()
    {
        var fake = new FakeJiraClient
        {
            IssueTypes = [new("10000", "Epic", 0, false), new("10001", "Story", 0, false), new("10004", "Bug", 0, false)],
            Fields = CreateMetadataParser.ParseServerFields(JsonDocument.Parse(StoryFieldsMeta).RootElement, "DEMO", "10001")!,
            EpicTypeIds = ["10000"],
        };
        using var factory = Create(fake, JiraDeployment.Server, JiraServerAuthScheme.Bearer);
        using var client = NewClient(factory);
        var cookie = await Connect(client);

        var story = await ReadJson(await Send(client, "/api/jira/projects/DEMO/issue-types/10001/fields", cookie));
        fake.Fields = [.. fake.Fields.Where(field => !CreateMetadataMapper.IsEpicLink(field))];
        var bug = await ReadJson(await Send(client, "/api/jira/projects/DEMO/issue-types/10004/fields", cookie));

        Assert.Equal(["10000"], story.GetProperty("parentTypeIds").EnumerateArray().Select(id => id.GetString()));
        Assert.DoesNotContain(story.GetProperty("fields").EnumerateArray(), field => field.GetProperty("fieldId").GetString() == "customfield_10008");
        Assert.Empty(bug.GetProperty("parentTypeIds").EnumerateArray());
    }

    [Fact]
    public async Task Creating_under_an_epic_sets_the_epic_link_field_found_at_create_time()
    {
        var fake = new FakeJiraClient
        {
            Fields = CreateMetadataParser.ParseServerFields(JsonDocument.Parse(StoryFieldsMeta).RootElement, "DEMO", "10001")!,
            NextKey = "DEMO-30",
        };
        using var factory = Create(fake, JiraDeployment.Server, JiraServerAuthScheme.Bearer);
        using var client = NewClient(factory);

        var response = await Send(
            client,
            "/api/jira/issues",
            await Connect(client),
            """{"projectKey":"DEMO","issueTypeId":"10001","summary":"S","description":"D","parentKey":"DEMO-12","fields":{},"links":[]}""");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var fields = Assert.Single(fake.Created)["fields"]!.AsObject();
        Assert.Equal("DEMO-12", fields["customfield_10008"]!.GetValue<string>());
        Assert.False(fields.ContainsKey("parent"));
    }

    [Fact]
    public async Task Creating_with_a_parent_for_a_type_without_an_epic_link_is_rejected_and_creates_nothing()
    {
        var fake = new FakeJiraClient
        {
            Fields = CreateMetadataParser.ParseServerFields(JsonDocument.Parse(StoryFieldsMeta).RootElement, "DEMO", "10001")!
                .Where(field => !CreateMetadataMapper.IsEpicLink(field)).ToList(),
        };
        using var factory = Create(fake, JiraDeployment.Server, JiraServerAuthScheme.Bearer);
        using var client = NewClient(factory);

        var response = await Send(
            client,
            "/api/jira/issues",
            await Connect(client),
            """{"projectKey":"DEMO","issueTypeId":"10001","summary":"S","description":"D","parentKey":"DEMO-12","fields":{},"links":[]}""");

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Equal(ErrorCodes.JiraRejected, (await ReadJson(response)).GetProperty("code").GetString());
        Assert.Empty(fake.Created);
    }

    [Fact]
    public async Task Creating_without_a_parent_on_server_makes_no_extra_metadata_call()
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake, JiraDeployment.Server, JiraServerAuthScheme.Bearer);
        using var client = NewClient(factory);
        var cookie = await Connect(client);
        var before = fake.Calls;

        await Send(
            client,
            "/api/jira/issues",
            cookie,
            """{"projectKey":"DEMO","issueTypeId":"10001","summary":"S","description":"D","fields":{},"links":[]}""");

        Assert.Equal(before + 1, fake.Calls); // the create only
    }

    [Fact]
    public async Task No_log_line_holds_the_secret_the_login_or_a_server_authorization_header()
    {
        var logs = new LogCollector();
        var responses = new Queue<HttpStatusCode>([HttpStatusCode.Unauthorized, HttpStatusCode.OK, HttpStatusCode.InternalServerError]);
        var handler = new LambdaHandler((_, _) => Task.FromResult(new HttpResponseMessage(responses.Dequeue())
        {
            Content = new StringContent("""{"displayName": "Ada Lovelace"}""", Encoding.UTF8, "application/json"),
        }));
        using var factory = new ApiFactory().WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration(configuration => configuration.AddInMemoryCollection(Settings(JiraDeployment.Server, JiraServerAuthScheme.Basic)));
            builder.ConfigureLogging(logging =>
            {
                logging.SetMinimumLevel(LogLevel.Trace);
                logging.AddProvider(logs);
            });
            builder.ConfigureTestServices(services => services.AddHttpClient<IJiraClient, JiraClient>().ConfigurePrimaryHttpMessageHandler(() => handler));
        });
        using var client = NewClient(factory);

        foreach (var _ in Enumerable.Range(0, 3))
        {
            await client.PostAsJsonAsync("/api/jira/session", new { login = "dev-login", secret = "server-secret" }, Ct);
        }

        var basic = Convert.ToBase64String("dev-login:server-secret"u8.ToArray());
        Assert.NotEmpty(logs.Entries);
        foreach (var entry in logs.Entries)
        {
            Assert.DoesNotContain("server-secret", entry);
            Assert.DoesNotContain("dev-login", entry);
            Assert.DoesNotContain(basic, entry);
            Assert.DoesNotContain("Basic ", entry);
            Assert.DoesNotContain("Bearer ", entry);
        }
    }

    // ---------- helpers

    // The configured type is only a default: client tests pass the opposite of the session's type.
    private static JiraClient CreateClient(
        JiraDeployment configured,
        Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> respond)
    {
        var httpClient = new HttpClient(new LambdaHandler(respond))
        {
            Timeout = Timeout.InfiniteTimeSpan,
        };
        var options = Options.Create(new JiraOptions
        {
            Enabled = true,
            BaseUrl = "https://jira.test",
            Deployment = configured,
        });
        return new JiraClient(httpClient, options, TimeProvider.System, new CapturingLogger<JiraClient>());
    }

    private static async Task<JiraApiException> FailLogin(HttpStatusCode status, JiraDeployment deployment, (string Name, string Value)? header = null)
    {
        var client = CreateClient(Opposite(deployment), (_, _) =>
        {
            var response = new HttpResponseMessage(status) { Content = new StringContent("{}", Encoding.UTF8, "application/json") };
            if (header is { } h)
            {
                response.Headers.Add(h.Name, h.Value);
            }

            return Task.FromResult(response);
        });
        var credentials = deployment == JiraDeployment.Server ? Credentials : CloudCredentials;
        return await Assert.ThrowsAsync<JiraApiException>(() => client.GetMyselfAsync(credentials, CancellationToken.None));
    }

    private static JiraDeployment Opposite(JiraDeployment deployment) =>
        deployment == JiraDeployment.Server ? JiraDeployment.Cloud : JiraDeployment.Server;

    // The exception's detail is what the user reads; ApiException keeps it in the ProblemDetails mapping, so read it through the property.
    private static Task<string> ProblemDetailOf(JiraApiException exception) => Task.FromResult(exception.Detail ?? "");

    private static Dictionary<string, string?> Settings(JiraDeployment deployment, JiraServerAuthScheme scheme) => new()
    {
        ["Jira:Enabled"] = "true",
        ["Jira:BaseUrl"] = "https://jira.test",
        ["Jira:Deployment"] = deployment.ToString(),
        ["Jira:ServerAuthScheme"] = scheme.ToString(),
    };

    private static WebApplicationFactory<Program> Create(IJiraClient fake, JiraDeployment deployment, JiraServerAuthScheme scheme) =>
        new ApiFactory().WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration(configuration => configuration.AddInMemoryCollection(Settings(deployment, scheme)));
            builder.ConfigureTestServices(services => services.AddSingleton(fake));
        });

    private static HttpClient NewClient(WebApplicationFactory<Program> factory) =>
        factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    private static async Task<JsonElement> GetStatus(WebApplicationFactory<Program> factory) =>
        await ReadJson(await NewClient(factory).GetAsync("/api/jira/status", Ct));

    private static async Task<string> Connect(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/jira/session", new { login = "dev", secret = "secret-token" }, Ct);
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

    private static async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement.Clone();

    private static HttpResponseMessage Json(string body) =>
        new(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    private static ServiceProvider Provider(Dictionary<string, string?> settings)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
        return new ServiceCollection()
            .AddLogging()
            .AddSingleton(TimeProvider.System)
            .AddSingleton<IConfiguration>(configuration)
            .AddJira(configuration)
            .BuildServiceProvider();
    }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;
}
