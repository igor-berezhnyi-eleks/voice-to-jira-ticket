using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using VoiceToTicket.Api.Features.Jira.Contract;

namespace VoiceToTicket.Api.Tests.Jira;

/// <summary>
/// A real Jira Cloud project through the whole API (J6, jira-plan 8). Writes two issues and one link to the real Jira;
/// the human deletes them afterwards. Never part of the default run.
/// Run (PowerShell):
/// <code>
/// $env:VTT_RUN_LIVE="1"; $env:VTT_JIRA_LIVE="1"; $env:VTT_JIRA_EMAIL="you@example.com"; $env:VTT_JIRA_PROJECT="SCRUM"
/// $env:VTT_JIRA_API_TOKEN = Read-Host "Token"   # VTT_JIRA_SITE_URL for another site
/// dotnet test --filter "Category=Live&amp;FullyQualifiedName~JiraLiveTests" --logger "console;verbosity=detailed"
/// </code>
/// It depends on no project setup: types, required fields and the parent come from discovery, and a case the app
/// cannot fill is skipped with the field named. The output names keys, ids and counts, never the email or the token.
/// </summary>
[Trait("Category", "Live")]
public sealed class JiraLiveTests
{
    private const string DefaultSiteUrl = "https://olehhupalo.atlassian.net";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Discovers_the_project_and_suggests_a_type_for_each_ticket_type()
    {
        var settings = LiveSettings.Read();
        await using var factory = Create(settings);
        using var client = factory.CreateClient();
        await ConnectAsync(client, settings);

        var projects = await Send<JiraProject[]>(client, HttpMethod.Get, "/api/jira/projects");
        Write($"Projects the user can create issues in: {string.Join(", ", projects.Select(project => project.Key))}.");
        Assert.Contains(projects, project => project.Key == settings.Project);

        var types = await Send<JiraIssueType[]>(client, HttpMethod.Get, $"/api/jira/projects/{settings.Project}/issue-types");
        Write($"Issue types in {settings.Project}: {string.Join(", ", types.Select(type => $"{type.Name} ({type.Id}, level {type.HierarchyLevel}, suggested for [{string.Join(",", type.SuggestedFor)}])"))}.");
        Assert.NotEmpty(types);

        var linkTypes = await Send<JiraLinkType[]>(client, HttpMethod.Get, "/api/jira/link-types");
        Write($"Link types: {string.Join(", ", linkTypes.Select(type => type.Name + (type.IsDefault ? " (default)" : "")))}.");
        Assert.NotEmpty(linkTypes);

        foreach (var type in types)
        {
            var fields = await Send<JiraFieldsResponse>(client, HttpMethod.Get, $"/api/jira/projects/{settings.Project}/issue-types/{type.Id}/fields");
            Write($"{type.Name}: {fields.Fields.Length} fields, {fields.Fields.Count(field => field.Required)} required, "
                + $"kinds [{string.Join(",", fields.Fields.Select(field => field.Kind.ToString().ToLowerInvariant()).Distinct())}], parent types [{string.Join(",", fields.ParentTypeIds)}].");
        }
    }

    [Fact]
    public async Task Creates_one_issue_per_ticket_type_with_a_link_between_them()
    {
        var settings = LiveSettings.Read();
        await using var factory = Create(settings);
        using var client = factory.CreateClient();
        await ConnectAsync(client, settings);

        var types = await Send<JiraIssueType[]>(client, HttpMethod.Get, $"/api/jira/projects/{settings.Project}/issue-types");
        var featureType = types.FirstOrDefault(type => type.SuggestedFor.Contains("Feature"));
        var bugType = types.FirstOrDefault(type => type.SuggestedFor.Contains("Bug"));
        Assert.SkipWhen(featureType is null, $"{settings.Project} has no issue type suggested for a Feature.");
        Assert.SkipWhen(bugType is null, $"{settings.Project} has no issue type suggested for a Bug.");

        var linkTypes = await Send<JiraLinkType[]>(client, HttpMethod.Get, "/api/jira/link-types");
        Assert.NotEmpty(linkTypes);
        var linkType = linkTypes.FirstOrDefault(type => type.IsDefault) ?? linkTypes[0];
        Write($"Link type '{linkType.Name}' (outward: '{linkType.Outward}').");

        // Prepare both cases before writing anything, so a field the app cannot fill skips the test and leaves Jira untouched.
        var featureCase = await PrepareAsync(client, settings.Project, featureType!);
        var bugCase = await PrepareAsync(client, settings.Project, bugType!);

        // The Feature first, so the Bug can link to it.
        var feature = await CreateAsync(client, settings.Project, featureType!, featureCase, links: []);
        var bug = await CreateAsync(client, settings.Project, bugType!, bugCase,
            links: [new JiraIssueLinkRequest(linkType.Name, JiraLinkDirection.Outward, feature.Key)]);

        Write($"Created {feature.Key} ({featureType!.Name}): {feature.Url}");
        Write($"Created {bug.Key} ({bugType!.Name}), {bug.Key} {linkType.Outward} {feature.Key}: {bug.Url}");
        Write("Delete both issues in Jira when the check is done.");
    }

    private sealed record Prepared(Dictionary<string, FieldValue> Values, string? ParentKey);

    private static async Task<Prepared> PrepareAsync(HttpClient client, string project, JiraIssueType type)
    {
        var fields = await Send<JiraFieldsResponse>(client, HttpMethod.Get, $"/api/jira/projects/{project}/issue-types/{type.Id}/fields");
        Write($"{type.Name}: {fields.Fields.Length} fields, {fields.Fields.Count(field => field.Required)} required, parent types [{string.Join(",", fields.ParentTypeIds)}].");

        var values = new Dictionary<string, FieldValue>();
        foreach (var field in fields.Fields.Where(field => field.Required && !field.HasDefaultValue))
        {
            var value = TestValue(field);
            Assert.SkipWhen(value is null,
                $"The required field '{field.Name}' ({field.FieldId}, {field.Kind}) of {type.Name} cannot be filled by this app; a user would see the blocking notice.");
            values[field.FieldId] = value!;
        }

        string? parentKey = null;
        if (fields.ParentTypeIds.Length > 0)
        {
            var parents = await Send<JiraIssueHit[]>(client, HttpMethod.Post, "/api/jira/issues/search",
                new JiraIssueSearchRequest(project, fields.ParentTypeIds, null));
            parentKey = parents.FirstOrDefault()?.Key;
            Write(parentKey is null ? $"{type.Name}: no existing parent in {project}, so none is set." : $"{type.Name}: parent {parentKey}.");
        }

        return new Prepared(values, parentKey);
    }

    private static async Task<CreateIssueResponse> CreateAsync(
        HttpClient client, string project, JiraIssueType type, Prepared prepared, JiraIssueLinkRequest[] links)
    {
        var request = new CreateIssueRequest(
            project,
            type.Id,
            $"[VTT live check] {type.Name} created by JiraLiveTests",
            "Created by the Voice-to-Ticket live check (J6). Safe to delete.",
            prepared.ParentKey,
            prepared.Values,
            links);
        var created = await Send<CreateIssueResponse>(client, HttpMethod.Post, "/api/jira/issues", request);
        Assert.Matches(CreateIssueRequest.IssueKeyPattern, created.Key);
        Assert.Empty(created.Warnings);
        return created;
    }

    /// <summary>A value Jira accepts for a required field, or null when the app cannot fill the field.</summary>
    private static FieldValue? TestValue(JiraField field) => field.Kind switch
    {
        JiraFieldKind.Text => new TextFieldValue("VTT live check"),
        JiraFieldKind.Textarea => new TextareaFieldValue("VTT live check"),
        JiraFieldKind.Number => new NumberFieldValue(1),
        JiraFieldKind.Date => new DateFieldValue(DateOnly.FromDateTime(TimeProvider.System.GetLocalNow().DateTime).ToString("yyyy-MM-dd")),
        JiraFieldKind.Labels => new LabelsFieldValue(["vtt-live-check"]),
        JiraFieldKind.Option when field.AllowedValues is [var first, ..] => new OptionFieldValue(first.Id),
        JiraFieldKind.Options when field.AllowedValues is [var first, ..] => new OptionsFieldValue([first.Id]),
        _ => null,
    };

    private static async Task ConnectAsync(HttpClient client, LiveSettings settings)
    {
        var session = await Send<JiraSessionResponse>(client, HttpMethod.Post, "/api/jira/session",
            new JiraSessionRequest(settings.Email, settings.Token, settings.SiteUrl.ToString().TrimEnd('/'), "Cloud", "Basic"));
        Assert.False(string.IsNullOrWhiteSpace(session.DisplayName));
        var status = await Send<JiraStatus>(client, HttpMethod.Get, "/api/jira/status");
        Assert.True(status.Connected);
        Assert.Equal("Cloud", status.Deployment);
        Write($"Connected to {status.SiteUrl} as Cloud with Basic sign-in.");
    }

    // Only the site's host is allowed; the type and sign-in come from the session request, not configuration.
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
        // The app's error bodies carry codes and Jira's messages, never the email or the token.
        Assert.True(response.IsSuccessStatusCode, $"{method} {path}: {(int)response.StatusCode} {text}");
        return JsonSerializer.Deserialize<T>(text, JiraJson.Options) ?? throw new InvalidOperationException($"{path}: empty body");
    }

    private static void Write(string line) => TestContext.Current.TestOutputHelper?.WriteLine(line);

    private sealed record LiveSettings(Uri SiteUrl, string Email, string Token, string Project)
    {
        public static LiveSettings Read()
        {
            Assert.SkipUnless(
                Environment.GetEnvironmentVariable("VTT_RUN_LIVE") == "1" && Environment.GetEnvironmentVariable("VTT_JIRA_LIVE") == "1",
                "Set VTT_RUN_LIVE=1 and VTT_JIRA_LIVE=1 (and the VTT_JIRA_* values) to run the Jira Cloud live tests.");

            var url = Optional("VTT_JIRA_SITE_URL", DefaultSiteUrl);
            var siteUrl = new Uri(url.EndsWith('/') ? url : url + "/", UriKind.Absolute);
            return new LiveSettings(siteUrl, Required("VTT_JIRA_EMAIL"), Required("VTT_JIRA_API_TOKEN"), Optional("VTT_JIRA_PROJECT", "SCRUM"));
        }

        private static string Optional(string name, string fallback) =>
            Environment.GetEnvironmentVariable(name) is { Length: > 0 } value ? value : fallback;

        private static string Required(string name) =>
            Environment.GetEnvironmentVariable(name) is { Length: > 0 } value ? value : throw new InvalidOperationException($"Set {name}.");

        // The email and the token must never reach test output, even through an assertion message.
        public override string ToString() => $"{SiteUrl}, project {Project}";
    }
}
