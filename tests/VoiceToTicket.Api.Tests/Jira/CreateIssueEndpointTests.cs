using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;
using VoiceToTicket.Api.Features.Jira;
using VoiceToTicket.Api.Features.Jira.Contract;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Tests.Jira;

/// <summary><c>POST /api/jira/issues</c> through the whole pipeline, with a fake Jira client and a real session cookie.</summary>
public sealed class CreateIssueEndpointTests
{
    private const string Minimal =
        """{"projectKey":"SCRUM","issueTypeId":"10004","summary":"Login fails","description":"It breaks.","fields":{},"links":[]}""";

    private readonly ManualTimeProvider time = new(new DateTimeOffset(2026, 11, 12, 9, 0, 0, TimeSpan.Zero));

    [Fact]
    public async Task A_minimal_request_creates_one_issue_and_returns_200_with_key_and_url()
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake);
        using var client = NewClient(factory);

        var response = await Post(client, Minimal, await Connect(client));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await ReadJson(response);
        Assert.Equal("SCRUM-124", body.GetProperty("key").GetString());
        Assert.Equal("https://jira.test/browse/SCRUM-124", body.GetProperty("url").GetString());
        Assert.Equal(0, body.GetProperty("warnings").GetArrayLength());
        Assert.Single(fake.Created);
        Assert.Empty(fake.Links);
        Assert.Equal("Login fails", fake.Created[0]["fields"]!["summary"]!.GetValue<string>());
    }

    [Fact]
    public async Task Extra_fields_and_the_parent_reach_the_payload()
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake);
        using var client = NewClient(factory);
        var request = """
            {"projectKey":"SCRUM","issueTypeId":"10004","summary":"S","description":"D","parentKey":"SCRUM-12",
             "fields":{"priority":{"kind":"option","id":"2"},"labels":{"kind":"labels","values":["voice"]},"customfield_10020":{"kind":"number","value":3.5}},
             "links":[]}
            """;

        var response = await Post(client, request, await Connect(client));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var fields = fake.Created[0]["fields"]!;
        Assert.Equal("SCRUM-12", fields["parent"]!["key"]!.GetValue<string>());
        Assert.Equal("2", fields["priority"]!["id"]!.GetValue<string>());
        Assert.Equal("voice", fields["labels"]![0]!.GetValue<string>());
        Assert.Equal(3.5, fields["customfield_10020"]!.GetValue<double>());
    }

    [Fact]
    public async Task An_outward_link_makes_the_new_issue_the_outward_end_and_an_inward_link_the_inward_end()
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake);
        using var client = NewClient(factory);
        var request = """
            {"projectKey":"SCRUM","issueTypeId":"10004","summary":"S","description":"D","fields":{},
             "links":[{"typeName":"Blocks","direction":"outward","issueKey":"SCRUM-1"},{"typeName":"Relates","direction":"inward","issueKey":"SCRUM-2"}]}
            """;

        var response = await Post(client, request, await Connect(client));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(
            [("Blocks", "SCRUM-1", "SCRUM-124"), ("Relates", "SCRUM-124", "SCRUM-2")],
            fake.Links);
    }

    [Fact]
    public async Task A_failed_link_is_a_warning_the_rest_are_still_tried_and_the_status_is_200()
    {
        var fake = new FakeJiraClient
        {
            OnLink = other =>
            {
                if (other == "SCRUM-1")
                {
                    throw JiraErrors.NotFound();
                }
            },
        };
        var logs = new LogCollector();
        using var factory = Create(fake, logs);
        using var client = NewClient(factory);
        var request = """
            {"projectKey":"SCRUM","issueTypeId":"10004","summary":"S","description":"D","fields":{},
             "links":[{"typeName":"Blocks","direction":"outward","issueKey":"SCRUM-1"},{"typeName":"Relates","direction":"outward","issueKey":"SCRUM-2"}]}
            """;

        var response = await Post(client, request, await Connect(client));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await ReadJson(response);
        Assert.Equal("SCRUM-124", body.GetProperty("key").GetString());
        var warning = Assert.Single(body.GetProperty("warnings").EnumerateArray());
        Assert.Equal(("jira_link_failed", "SCRUM-1"), (warning.GetProperty("code").GetString(), warning.GetProperty("issueKey").GetString()));
        Assert.Equal(2, fake.Links.Count);
        Assert.Contains(logs.Entries, entry => entry.Contains("[Warning]") && entry.Contains("SCRUM-1"));
    }

    [Fact]
    public async Task A_Jira_rejection_is_422_jira_rejected_with_the_field_errors()
    {
        var fake = new FakeJiraClient();
        fake.CreateFailure = () => new JiraApiException(
            422,
            ErrorCodes.JiraRejected,
            "Jira rejected the request.",
            extensions: new Dictionary<string, object?>
            {
                ["errors"] = new Dictionary<string, string> { ["priority"] = "Priority is required." },
                ["errorMessages"] = new List<string> { "Something else" },
            });
        using var factory = Create(fake);
        using var client = NewClient(factory);

        var response = await Post(client, Minimal, await Connect(client));

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        var body = await ReadJson(response);
        Assert.Equal(ErrorCodes.JiraRejected, body.GetProperty("code").GetString());
        Assert.Equal("Priority is required.", body.GetProperty("errors").GetProperty("priority").GetString());
        Assert.Equal("Something else", body.GetProperty("errorMessages")[0].GetString());
    }

    [Fact]
    public async Task A_Jira_404_on_create_is_jira_not_found()
    {
        using var factory = Create(new FakeJiraClient { CreateFailure = JiraErrors.NotFound });
        using var client = NewClient(factory);

        var response = await Post(client, Minimal, await Connect(client));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(ErrorCodes.JiraNotFound, (await ReadJson(response)).GetProperty("code").GetString());
    }

    [Fact]
    public async Task A_Jira_401_on_create_clears_the_cookie()
    {
        using var factory = Create(new FakeJiraClient { CreateFailure = JiraErrors.AuthRequired });
        using var client = NewClient(factory);

        var response = await Post(client, Minimal, await Connect(client));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(ErrorCodes.JiraAuthRequired, (await ReadJson(response)).GetProperty("code").GetString());
        Assert.Contains("expires=thu, 01 jan 1970", string.Join(";", response.Headers.GetValues("Set-Cookie")).ToLowerInvariant());
    }

    [Fact]
    public async Task A_create_with_no_session_is_401_and_Jira_is_not_called()
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake);
        using var client = NewClient(factory);

        var response = await Post(client, Minimal, cookie: null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(0, fake.Calls);
    }

    [Fact]
    public async Task With_Jira_off_the_endpoint_is_404_jira_not_configured()
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake, enabled: false);
        using var client = NewClient(factory);

        var response = await Post(client, Minimal, cookie: null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(ErrorCodes.JiraNotConfigured, (await ReadJson(response)).GetProperty("code").GetString());
        Assert.Equal(0, fake.Calls);
    }

    [Fact]
    public async Task A_form_body_is_415()
    {
        using var factory = Create(new FakeJiraClient());
        using var client = NewClient(factory);
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/jira/issues")
        {
            Content = new StringContent("summary=x", Encoding.UTF8, "application/x-www-form-urlencoded"),
        };
        request.Headers.Add("Cookie", $"vtt_jira={await Connect(client)}");

        Assert.Equal(HttpStatusCode.UnsupportedMediaType, (await client.SendAsync(request, Ct)).StatusCode);
    }

    public static TheoryData<string, string> Invalid => new()
    {
        { "summary empty", Replace(Minimal, "\"summary\":\"Login fails\"", "\"summary\":\"\"") },
        { "summary blank", Replace(Minimal, "\"summary\":\"Login fails\"", "\"summary\":\"   \"") },
        { "summary 256", Replace(Minimal, "\"summary\":\"Login fails\"", $"\"summary\":\"{new string('a', 256)}\"") },
        { "description too long", Replace(Minimal, "\"description\":\"It breaks.\"", $"\"description\":\"{new string('a', 32_001)}\"") },
        { "description missing", Minimal.Replace("\"description\":\"It breaks.\",", "") },
        { "bad project key", Replace(Minimal, "\"projectKey\":\"SCRUM\"", "\"projectKey\":\"scrum\"") },
        { "project key with quote", Replace(Minimal, "\"projectKey\":\"SCRUM\"", "\"projectKey\":\"SC\\\" OR 1=1\"") },
        { "bad type id", Replace(Minimal, "\"issueTypeId\":\"10004\"", "\"issueTypeId\":\"abc\"") },
        { "bad parent key", Replace(Minimal, "\"fields\":{}", "\"parentKey\":\"scrum-1\",\"fields\":{}") },
        { "parent without number", Replace(Minimal, "\"fields\":{}", "\"parentKey\":\"SCRUM\",\"fields\":{}") },
        { "fields missing", Minimal.Replace("\"fields\":{},", "") },
        { "links missing", Minimal.Replace(",\"links\":[]", "") },
        { "31 fields", WithFields(Enumerable.Range(1, 31).Select(number => $"\"customfield_{number}\":{{\"kind\":\"text\",\"value\":\"x\"}}")) },
        { "6 links", WithLinks(Enumerable.Range(1, 6).Select(number => $"{{\"typeName\":\"Relates\",\"direction\":\"outward\",\"issueKey\":\"SCRUM-{number}\"}}")) },
        { "reserved field summary", WithFields(["\"summary\":{\"kind\":\"text\",\"value\":\"x\"}"]) },
        { "reserved field parent", WithFields(["\"parent\":{\"kind\":\"text\",\"value\":\"x\"}"]) },
        { "reserved field issuelinks", WithFields(["\"issuelinks\":{\"kind\":\"text\",\"value\":\"x\"}"]) },
        { "reserved field project", WithFields(["\"project\":{\"kind\":\"option\",\"id\":\"1\"}"]) },
        { "malformed field id upper", WithFields(["\"Priority\":{\"kind\":\"option\",\"id\":\"1\"}"]) },
        { "malformed field id custom", WithFields(["\"customfield_abc\":{\"kind\":\"text\",\"value\":\"x\"}"]) },
        { "malformed field id punctuation", WithFields(["\"a.b\":{\"kind\":\"text\",\"value\":\"x\"}"]) },
        { "label with space", WithFields(["\"labels\":{\"kind\":\"labels\",\"values\":[\"two words\"]}"]) },
        { "empty label", WithFields(["\"labels\":{\"kind\":\"labels\",\"values\":[\"\"]}"]) },
        { "text too long", WithFields([$"\"customfield_1\":{{\"kind\":\"text\",\"value\":\"{new string('a', 32_001)}\"}}"]) },
        { "bad date", WithFields(["\"duedate\":{\"kind\":\"date\",\"value\":\"12/11/2026\"}"]) },
        { "impossible date", WithFields(["\"duedate\":{\"kind\":\"date\",\"value\":\"2026-02-30\"}"]) },
        { "empty option id", WithFields(["\"priority\":{\"kind\":\"option\",\"id\":\"\"}"]) },
        { "empty option id in list", WithFields(["\"components\":{\"kind\":\"options\",\"ids\":[\"1\",\" \"]}"]) },
        { "null field value", WithFields(["\"priority\":null"]) },
        { "unknown field kind", WithFields(["\"assignee\":{\"kind\":\"user\",\"id\":\"1\"}"]) },
        { "unknown link direction", WithLinks(["{\"typeName\":\"Relates\",\"direction\":\"sideways\",\"issueKey\":\"SCRUM-1\"}"]) },
        { "link without direction value", WithLinks(["{\"typeName\":\"Relates\",\"direction\":7,\"issueKey\":\"SCRUM-1\"}"]) },
        { "bad link key", WithLinks(["{\"typeName\":\"Relates\",\"direction\":\"outward\",\"issueKey\":\"nope\"}"]) },
        { "link type missing", WithLinks(["{\"direction\":\"outward\",\"issueKey\":\"SCRUM-1\"}"]) },
        { "null link", WithLinks(["null"]) },
    };

    [Theory]
    [MemberData(nameof(Invalid))]
    public async Task Each_limit_is_400_validation_and_Jira_is_not_called(string name, string json)
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake);
        using var client = NewClient(factory);
        var cookie = await Connect(client);
        var callsAfterConnect = fake.Calls;

        var response = await Post(client, json, cookie);

        Assert.True(response.StatusCode == HttpStatusCode.BadRequest, $"{name}: {response.StatusCode} {await response.Content.ReadAsStringAsync(Ct)}");
        Assert.Equal(ErrorCodes.Validation, (await ReadJson(response)).GetProperty("code").GetString());
        Assert.Equal(callsAfterConnect, fake.Calls);
        Assert.Empty(fake.Created);
    }

    [Fact]
    public async Task Limits_at_the_edge_are_accepted()
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake);
        using var client = NewClient(factory);
        var fields = string.Join(",", Enumerable.Range(1, 30).Select(number => $"\"customfield_{number}\":{{\"kind\":\"text\",\"value\":\"x\"}}"));
        var links = string.Join(",", Enumerable.Range(1, 5).Select(number => $"{{\"typeName\":\"Relates\",\"direction\":\"outward\",\"issueKey\":\"SCRUM-{number}\"}}"));
        var json = $$"""
            {"projectKey":"SC","issueTypeId":"1","summary":"{{new string('a', 255)}}","description":"{{new string('b', 32_000)}}","fields":{ {{fields}} },"links":[{{links}}]}
            """;

        var response = await Post(client, json, await Connect(client));

        Assert.True(response.StatusCode == HttpStatusCode.OK, await response.Content.ReadAsStringAsync(Ct));
        Assert.Equal(5, fake.Links.Count);
    }

    [Fact]
    public async Task An_empty_description_is_accepted()
    {
        var fake = new FakeJiraClient();
        using var factory = Create(fake);
        using var client = NewClient(factory);

        var response = await Post(client, Replace(Minimal, "\"description\":\"It breaks.\"", "\"description\":\"\""), await Connect(client));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(fake.Created[0]["fields"]!.AsObject().ContainsKey("description"));
    }

    [Fact]
    public async Task One_Information_line_per_issue_and_no_ticket_text_in_any_log()
    {
        var fake = new FakeJiraClient();
        fake.OnLink = _ => throw JiraErrors.Unavailable();
        var logs = new LogCollector();
        using var factory = Create(fake, logs);
        using var client = NewClient(factory);
        var request = """
            {"projectKey":"SCRUM","issueTypeId":"10004","summary":"SUMMARY-SECRET","description":"DESCRIPTION-SECRET","parentKey":"SCRUM-12",
             "fields":{"customfield_1":{"kind":"text","value":"FIELD-SECRET"},"labels":{"kind":"labels","values":["LABEL-SECRET"]}},
             "links":[{"typeName":"Relates","direction":"outward","issueKey":"SCRUM-3"}]}
            """;

        var response = await Post(client, request, await Connect(client));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var created = logs.Entries.Where(entry => entry.Contains("[Information]") && entry.Contains("Created Jira issue")).ToList();
        var line = Assert.Single(created);
        Assert.Contains("SCRUM-124", line);
        Assert.Contains("10004", line);
        Assert.Contains("FieldCount=2", line);
        Assert.Contains("LinkCount=1", line);
        Assert.Contains("ParentSet=True", line);
        Assert.Contains("FailedLinks=1", line);
        foreach (var entry in logs.Entries)
        {
            Assert.DoesNotContain("SUMMARY-SECRET", entry);
            Assert.DoesNotContain("DESCRIPTION-SECRET", entry);
            Assert.DoesNotContain("FIELD-SECRET", entry);
            Assert.DoesNotContain("LABEL-SECRET", entry);
            Assert.DoesNotContain("secret-token", entry);
        }
    }

    private static string Replace(string source, string from, string to)
    {
        Assert.Contains(from, source);
        return source.Replace(from, to);
    }

    private static string WithFields(IEnumerable<string> fields) =>
        Replace(Minimal, "\"fields\":{}", $"\"fields\":{{{string.Join(",", fields)}}}");

    private static string WithLinks(IEnumerable<string> links) =>
        Replace(Minimal, "\"links\":[]", $"\"links\":[{string.Join(",", links)}]");

    private WebApplicationFactory<Program> Create(IJiraClient fake, LogCollector? logs = null, bool enabled = true) =>
        new ApiFactory().WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jira:Enabled"] = enabled ? "true" : "false",
                ["Jira:BaseUrl"] = "https://jira.test",
            }));
            if (logs is not null)
            {
                builder.ConfigureLogging(logging =>
                {
                    logging.SetMinimumLevel(LogLevel.Trace);
                    logging.AddProvider(logs);
                });
            }

            builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<TimeProvider>(time);
                services.AddSingleton(fake);
            });
        });

    private WebApplicationFactory<Program> Create(IJiraClient fake, bool enabled) => Create(fake, null, enabled);

    private static HttpClient NewClient(WebApplicationFactory<Program> factory) =>
        factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    private static async Task<string> Connect(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/jira/session", new JiraSessionRequest("dev@example.com", "secret-token"), Ct);
        var header = Assert.Single(response.Headers.GetValues("Set-Cookie"));
        return header["vtt_jira=".Length..header.IndexOf(';')];
    }

    private static async Task<HttpResponseMessage> Post(HttpClient client, string json, string? cookie)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/jira/issues")
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json"),
        };
        if (cookie is not null)
        {
            request.Headers.Add("Cookie", $"vtt_jira={cookie}");
        }

        return await client.SendAsync(request, Ct);
    }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static async Task<JsonElement> ReadJson(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement.Clone();
}
