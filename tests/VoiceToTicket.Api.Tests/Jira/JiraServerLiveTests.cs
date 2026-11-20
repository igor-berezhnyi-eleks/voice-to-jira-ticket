using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using VoiceToTicket.Api.Features.Jira.Contract;

namespace VoiceToTicket.Api.Tests.Jira;

/// <summary>
/// The company Jira Server through the whole API (J8, jira-plan 14). Writes two issues and one link to the real Jira;
/// the human deletes them afterwards. Never part of the default run.
/// Run (PowerShell, on the VPN):
/// <code>
/// $env:VTT_RUN_LIVE="1"; $env:VTT_JIRA_SERVER_LIVE="1"; $env:VTT_JIRA_SERVER_URL="https://jira.example.com"; $env:VTT_JIRA_PROJECT="KEY"
/// $env:VTT_JIRA_SECRET = Read-Host "Token"   # VTT_JIRA_AUTH_SCHEME=Basic and VTT_JIRA_LOGIN for username + password
/// dotnet test --filter "Category=Live&amp;FullyQualifiedName~JiraServer" --logger "console;verbosity=detailed"
/// </code>
/// The type comes from the session request (<c>deployment=Server</c>), not from configuration: <c>Jira:Deployment</c>
/// stays <c>Cloud</c> as <see cref="ApiFactory"/> pins it. The output names keys, ids and versions, never the secret or the login.
/// </summary>
[Trait("Category", "Live")]
public sealed class JiraServerLiveTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Server_info_reports_the_version()
    {
        var settings = LiveSettings.Read();
        await using var factory = Create(settings);
        var http = factory.Services.GetRequiredService<IHttpClientFactory>().CreateClient();

        // serverInfo answers without credentials on Server, so none are sent on this direct call.
        using var response = await http.GetAsync(new Uri(settings.SiteUrl, "rest/api/2/serverInfo"), Ct);
        var body = await response.Content.ReadAsStringAsync(Ct);
        Assert.True(response.StatusCode == HttpStatusCode.OK, $"serverInfo: {(int)response.StatusCode}");

        using var document = JsonDocument.Parse(body);
        var root = document.RootElement;
        Write($"serverInfo: version={Read(root, "version")}, buildNumber={Read(root, "buildNumber")}, deploymentType={Read(root, "deploymentType")}");
        Assert.False(string.IsNullOrWhiteSpace(Read(root, "version")));
    }

    [Fact]
    public async Task Creates_one_issue_per_ticket_type_with_a_link_in_a_Server_session()
    {
        var settings = LiveSettings.Read();
        await using var factory = Create(settings);
        using var client = factory.CreateClient();

        // Connect as Server by the request only.
        var session = await Send<JiraSessionResponse>(client, HttpMethod.Post, "/api/jira/session",
            new JiraSessionRequest(settings.Login, settings.Secret, settings.SiteUrl.ToString().TrimEnd('/'), "Server", settings.AuthScheme));
        Assert.False(string.IsNullOrWhiteSpace(session.DisplayName));
        var status = await Send<JiraStatus>(client, HttpMethod.Get, "/api/jira/status");
        Assert.Equal("Server", status.Deployment);
        Assert.Equal(settings.AuthScheme, status.AuthScheme);
        Write($"Connected as Server with {status.AuthScheme} sign-in to {status.SiteUrl}.");

        // Discovery.
        var projects = await Send<JiraProject[]>(client, HttpMethod.Get, "/api/jira/projects");
        Write($"Projects the user can create issues in: {projects.Length}.");
        Assert.Contains(projects, project => project.Key == settings.Project);

        var types = await Send<JiraIssueType[]>(client, HttpMethod.Get, $"/api/jira/projects/{settings.Project}/issue-types");
        Write($"Issue types in {settings.Project}: {string.Join(", ", types.Select(type => $"{type.Name} ({type.Id}, suggested for [{string.Join(",", type.SuggestedFor)}])"))}.");
        var featureType = Assert.Single(types, type => type.SuggestedFor.Contains("Feature"));
        var bugType = Assert.Single(types, type => type.SuggestedFor.Contains("Bug"));

        var linkTypes = await Send<JiraLinkType[]>(client, HttpMethod.Get, "/api/jira/link-types");
        Assert.NotEmpty(linkTypes);
        var linkType = linkTypes.FirstOrDefault(type => type.IsDefault) ?? linkTypes[0];
        Write($"Link types: {linkTypes.Length}; using '{linkType.Name}' (outward: '{linkType.Outward}').");

        // Feature first, so the Bug can link to it.
        var feature = await CreateAsync(client, settings.Project, featureType, links: []);
        var bug = await CreateAsync(client, settings.Project, bugType,
            links: [new JiraIssueLinkRequest(linkType.Name, JiraLinkDirection.Outward, feature.Key)]);

        Write($"Created {feature.Key} ({featureType.Name}): {feature.Url}");
        Write($"Created {bug.Key} ({bugType.Name}), {bug.Key} {linkType.Outward} {feature.Key}: {bug.Url}");
        Write("Delete both issues in Jira when the check is done.");
    }

    private static async Task<CreateIssueResponse> CreateAsync(HttpClient client, string project, JiraIssueType type, JiraIssueLinkRequest[] links)
    {
        var fields = await Send<JiraFieldsResponse>(client, HttpMethod.Get, $"/api/jira/projects/{project}/issue-types/{type.Id}/fields");
        Write($"{type.Name}: {fields.Fields.Length} fields, {fields.Fields.Count(field => field.Required)} required, parent types [{string.Join(",", fields.ParentTypeIds)}].");

        // A non-empty list means the type has an Epic Link field and the project has an Epic type (Epic Name): jira-plan 14.4.
        string? parentKey = null;
        if (fields.ParentTypeIds.Length > 0)
        {
            var epics = await Send<JiraIssueHit[]>(client, HttpMethod.Post, "/api/jira/issues/search",
                new JiraIssueSearchRequest(project, fields.ParentTypeIds, null));
            parentKey = epics.FirstOrDefault()?.Key;
            Write(parentKey is null ? $"{type.Name}: no Epic found in {project}, so no parent." : $"{type.Name}: Epic Link parent {parentKey}.");
        }

        var values = new Dictionary<string, FieldValue>();
        foreach (var field in fields.Fields.Where(field => field.Required && !field.HasDefaultValue))
        {
            values[field.FieldId] = TestValue(field);
        }

        var request = new CreateIssueRequest(
            project,
            type.Id,
            $"[VTT live check] {type.Name} created by JiraServerLiveTests",
            "Created by the Voice-to-Ticket live check (J8). Safe to delete.",
            parentKey,
            values,
            links);
        var created = await Send<CreateIssueResponse>(client, HttpMethod.Post, "/api/jira/issues", request);
        Assert.Matches(CreateIssueRequest.IssueKeyPattern, created.Key);
        Assert.Empty(created.Warnings);
        return created;
    }

    /// <summary>A value Jira accepts for a required field the user would otherwise have to fill.</summary>
    private static FieldValue TestValue(JiraField field) => field.Kind switch
    {
        JiraFieldKind.Text => new TextFieldValue("VTT live check"),
        JiraFieldKind.Textarea => new TextareaFieldValue("VTT live check"),
        JiraFieldKind.Number => new NumberFieldValue(1),
        JiraFieldKind.Date => new DateFieldValue(DateOnly.FromDateTime(TimeProvider.System.GetLocalNow().DateTime).ToString("yyyy-MM-dd")),
        JiraFieldKind.Labels => new LabelsFieldValue(["vtt-live-check"]),
        JiraFieldKind.Option when field.AllowedValues is [var first, ..] => new OptionFieldValue(first.Id),
        JiraFieldKind.Options when field.AllowedValues is [var first, ..] => new OptionsFieldValue([first.Id]),
        _ => throw new InvalidOperationException(
            $"The required field '{field.Name}' ({field.FieldId}, {field.Kind}) cannot be filled by this app; the user would see the blocking notice."),
    };

    // Only the server host is allowed, and Jira:Deployment stays Cloud (pinned by ApiFactory): Server must come from the session.
    private static WebApplicationFactory<Program> Create(LiveSettings settings) =>
        new ApiFactory("Development").WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration(configuration =>
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Jira:Enabled"] = "true",
                    ["Jira:BaseUrl"] = "",
                    ["Jira:AllowedHosts:0"] = settings.SiteUrl.Host,
                    ["Jira:TimeoutSeconds"] = "30",
                })));

    private static async Task<T> Send<T>(HttpClient client, HttpMethod method, string path, object? body = null)
    {
        using var request = new HttpRequestMessage(method, path);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body, body.GetType(), options: JiraJson.Options);
        }

        using var response = await client.SendAsync(request, Ct);
        var text = await response.Content.ReadAsStringAsync(Ct);
        // The app's error bodies carry codes and Jira's messages, never the secret.
        Assert.True(response.IsSuccessStatusCode, $"{method} {path}: {(int)response.StatusCode} {text}");
        return JsonSerializer.Deserialize<T>(text, JiraJson.Options) ?? throw new InvalidOperationException($"{path}: empty body");
    }

    private static string? Read(JsonElement root, string name) =>
        root.TryGetProperty(name, out var value) ? value.ToString() : null;

    private static void Write(string line) => TestContext.Current.TestOutputHelper?.WriteLine(line);

    private sealed record LiveSettings(Uri SiteUrl, string? Login, string Secret, string AuthScheme, string Project)
    {
        public static LiveSettings Read()
        {
            Assert.SkipUnless(
                Environment.GetEnvironmentVariable("VTT_RUN_LIVE") == "1" && Environment.GetEnvironmentVariable("VTT_JIRA_SERVER_LIVE") == "1",
                "Set VTT_RUN_LIVE=1 and VTT_JIRA_SERVER_LIVE=1 (and the VTT_JIRA_* values) to run the Jira Server live tests.");

            var url = Required("VTT_JIRA_SERVER_URL");
            var scheme = Environment.GetEnvironmentVariable("VTT_JIRA_AUTH_SCHEME") is { Length: > 0 } value ? value : "Bearer";
            Assert.True(scheme is "Bearer" or "Basic", "VTT_JIRA_AUTH_SCHEME must be Bearer or Basic.");
            var login = scheme == "Basic" ? Required("VTT_JIRA_LOGIN") : null;
            var siteUrl = new Uri(url.EndsWith('/') ? url : url + "/", UriKind.Absolute);
            return new LiveSettings(siteUrl, login, Required("VTT_JIRA_SECRET"), scheme, Required("VTT_JIRA_PROJECT"));
        }

        private static string Required(string name) =>
            Environment.GetEnvironmentVariable(name) is { Length: > 0 } value ? value : throw new InvalidOperationException($"Set {name}.");

        // The secret and the login must never reach test output, even through an assertion message.
        public override string ToString() => $"{SiteUrl} ({AuthScheme}), project {Project}";
    }
}
