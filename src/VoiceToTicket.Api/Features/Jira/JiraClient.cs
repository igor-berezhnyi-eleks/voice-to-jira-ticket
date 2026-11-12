using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using VoiceToTicket.Api.Features.Jira.Contract;

namespace VoiceToTicket.Api.Features.Jira;

/// <summary>
/// Jira Cloud REST v2 over HTTP Basic (email + API token). No retry: a create is not idempotent and decision D2
/// excludes Polly. The timeout is enforced here, not by <see cref="HttpClient.Timeout"/>, so a timeout can be told
/// apart from the caller cancelling.
/// </summary>
public sealed class JiraClient(
    HttpClient httpClient,
    IOptions<JiraOptions> options,
    TimeProvider timeProvider,
    ILogger<JiraClient> logger) : IJiraClient
{
    public async Task<JiraUser> GetMyselfAsync(JiraCredentials credentials, CancellationToken cancellationToken)
    {
        using var document = await SendAsync(HttpMethod.Get, "rest/api/2/myself", credentials, loginCheck: true, cancellationToken);
        if (document.RootElement.ValueKind == JsonValueKind.Object
            && document.RootElement.TryGetProperty("displayName", out var name)
            && name.ValueKind == JsonValueKind.String
            && !string.IsNullOrWhiteSpace(name.GetString()))
        {
            return new JiraUser(name.GetString()!);
        }

        logger.LogWarning("Jira's answer to myself had no displayName");
        throw JiraErrors.Unavailable();
    }

    public async Task<IReadOnlyList<JiraProject>> GetProjectsAsync(JiraCredentials credentials, CancellationToken cancellationToken)
    {
        using var document = await SendAsync(HttpMethod.Get, "rest/api/2/project/search?action=create&maxResults=50", credentials, false, cancellationToken);
        var projects = new List<JiraProject>();
        if (document.RootElement.ValueKind == JsonValueKind.Object
            && document.RootElement.TryGetProperty("values", out var values)
            && values.ValueKind == JsonValueKind.Array)
        {
            foreach (var value in values.EnumerateArray())
            {
                var key = ReadString(value, "key");
                var name = ReadString(value, "name");
                if (!string.IsNullOrWhiteSpace(key) && !string.IsNullOrWhiteSpace(name))
                {
                    projects.Add(new JiraProject(key, name));
                }
            }
        }

        return projects;
    }

    public async Task<IReadOnlyList<JiraIssueTypeInfo>> GetIssueTypesAsync(
        JiraCredentials credentials,
        string projectKey,
        CancellationToken cancellationToken)
    {
        var path = $"rest/api/2/issue/createmeta/{Uri.EscapeDataString(projectKey)}/issuetypes";
        using var document = await SendAsync(HttpMethod.Get, path, credentials, false, cancellationToken);
        return CreateMetadataParser.ParseIssueTypes(document.RootElement);
    }

    public async Task<IReadOnlyList<CreateMetaField>> GetCreateFieldsAsync(
        JiraCredentials credentials,
        string projectKey,
        string issueTypeId,
        CancellationToken cancellationToken)
    {
        var basePath = $"rest/api/2/issue/createmeta/{Uri.EscapeDataString(projectKey)}/issuetypes/{Uri.EscapeDataString(issueTypeId)}";
        var fields = new List<CreateMetaField>();
        while (true)
        {
            using var document = await SendAsync(
                HttpMethod.Get,
                $"{basePath}?startAt={fields.Count}&maxResults={FieldsPageSize}",
                credentials,
                false,
                cancellationToken);
            var page = CreateMetadataParser.ParseFields(document.RootElement);
            fields.AddRange(page);

            var total = CreateMetadataParser.ParseTotal(document.RootElement);
            if (fields.Count > MaxFields)
            {
                logger.LogWarning("Jira reported more than {MaxFields} create fields", MaxFields);
                throw JiraErrors.Unavailable();
            }

            // A page with nothing new, or one that reaches the total (or is short when no total is given), is the last.
            if (page.Count == 0 || (total is { } count ? fields.Count >= count : page.Count < FieldsPageSize))
            {
                return fields;
            }
        }
    }

    public async Task<IReadOnlyList<JiraLinkType>> GetLinkTypesAsync(JiraCredentials credentials, CancellationToken cancellationToken)
    {
        using var document = await SendAsync(HttpMethod.Get, "rest/api/2/issueLinkType", credentials, false, cancellationToken);
        var types = new List<JiraLinkType>();
        if (document.RootElement.ValueKind == JsonValueKind.Object
            && document.RootElement.TryGetProperty("issueLinkTypes", out var values)
            && values.ValueKind == JsonValueKind.Array)
        {
            foreach (var value in values.EnumerateArray())
            {
                var name = ReadString(value, "name");
                if (!string.IsNullOrWhiteSpace(name))
                {
                    types.Add(new JiraLinkType(name, ReadString(value, "inward") ?? name, ReadString(value, "outward") ?? name, false));
                }
            }
        }

        return types;
    }

    public async Task<IReadOnlyList<JiraIssueHit>> SearchIssuesAsync(JiraCredentials credentials, string jql, CancellationToken cancellationToken)
    {
        var body = JsonSerializer.Serialize(new { jql, fields = new[] { "summary", "issuetype", "status" }, maxResults = SearchMaxResults });
        using var content = new StringContent(body, Encoding.UTF8, "application/json");
        using var document = await SendAsync(HttpMethod.Post, "rest/api/2/search/jql", credentials, false, cancellationToken, content);

        var hits = new List<JiraIssueHit>();
        if (document.RootElement.ValueKind == JsonValueKind.Object
            && document.RootElement.TryGetProperty("issues", out var issues)
            && issues.ValueKind == JsonValueKind.Array)
        {
            foreach (var issue in issues.EnumerateArray())
            {
                if (ReadIssue(issue) is { } detail)
                {
                    hits.Add(detail.Hit);
                }
            }
        }

        return hits;
    }

    public async Task<JiraIssueDetail?> GetIssueAsync(JiraCredentials credentials, string issueKey, CancellationToken cancellationToken)
    {
        try
        {
            using var document = await SendAsync(
                HttpMethod.Get,
                $"rest/api/2/issue/{Uri.EscapeDataString(issueKey)}?fields=summary,issuetype,status",
                credentials,
                false,
                cancellationToken);
            return ReadIssue(document.RootElement);
        }
        catch (JiraApiException exception) when (exception.Code == Infrastructure.ErrorCodes.JiraNotFound)
        {
            return null;
        }
    }

    private const int FieldsPageSize = 200;
    private const int MaxFields = 500;
    private const int SearchMaxResults = 20;

    private static JiraIssueDetail? ReadIssue(JsonElement issue)
    {
        if (issue.ValueKind != JsonValueKind.Object || ReadString(issue, "key") is not { Length: > 0 } key
            || !issue.TryGetProperty("fields", out var fields) || fields.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        var type = fields.TryGetProperty("issuetype", out var typeElement) && typeElement.ValueKind == JsonValueKind.Object ? typeElement : default;
        var status = fields.TryGetProperty("status", out var statusElement) && statusElement.ValueKind == JsonValueKind.Object ? statusElement : default;
        var typeId = type.ValueKind == JsonValueKind.Object ? ReadString(type, "id") : null;
        return new JiraIssueDetail(
            new JiraIssueHit(
                key,
                ReadString(fields, "summary") ?? "",
                type.ValueKind == JsonValueKind.Object ? ReadString(type, "name") ?? "" : "",
                status.ValueKind == JsonValueKind.Object ? ReadString(status, "name") ?? "" : ""),
            typeId ?? "");
    }

    private static string? ReadString(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    public async Task<JiraCreatedIssue> CreateIssueAsync(JiraCredentials credentials, JsonObject payload, CancellationToken cancellationToken)
    {
        using var content = new StringContent(payload.ToJsonString(), Encoding.UTF8, "application/json");
        using var document = await SendAsync(HttpMethod.Post, "rest/api/2/issue", credentials, false, cancellationToken, content);
        if (ReadString(document.RootElement, "key") is { Length: > 0 } key)
        {
            return new JiraCreatedIssue(ReadString(document.RootElement, "id") ?? "", key);
        }

        // Jira said 201 but sent no key: the issue may exist, so the user must look in Jira.
        logger.LogWarning("Jira's answer to create had no key");
        throw JiraErrors.Unavailable();
    }

    public async Task CreateLinkAsync(JiraCredentials credentials, string typeName, string inwardKey, string outwardKey, CancellationToken cancellationToken)
    {
        var body = new JsonObject
        {
            ["type"] = new JsonObject { ["name"] = typeName },
            ["inwardIssue"] = new JsonObject { ["key"] = inwardKey },
            ["outwardIssue"] = new JsonObject { ["key"] = outwardKey },
        };
        using var content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");

        // The answer is 201 with no body.
        await SendAsync<bool>(HttpMethod.Post, "rest/api/2/issueLink", credentials, false, cancellationToken, content, (_, _) => Task.FromResult(true));
    }

    // One Jira call that expects a JSON body in the answer.
    private Task<JsonDocument> SendAsync(
        HttpMethod method,
        string path,
        JiraCredentials credentials,
        bool loginCheck,
        CancellationToken cancellationToken,
        HttpContent? content = null) =>
        SendAsync(method, path, credentials, loginCheck, cancellationToken, content, async (body, token) =>
            await JsonDocument.ParseAsync(body, cancellationToken: token));

    private async Task<T> SendAsync<T>(
        HttpMethod method,
        string path,
        JiraCredentials credentials,
        bool loginCheck,
        CancellationToken cancellationToken,
        HttpContent? content,
        Func<Stream, CancellationToken, Task<T>> read)
    {
        var settings = options.Value;
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(settings.TimeoutSeconds), timeProvider);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);

        using var request = new HttpRequestMessage(method, path) { Content = content };
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Basic",
            Convert.ToBase64String(Encoding.UTF8.GetBytes($"{credentials.Email}:{credentials.ApiToken}")));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        try
        {
            using var response = await httpClient.SendAsync(request, linked.Token);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Jira answered {StatusCode} to {Method} {Path}", (int)response.StatusCode, method, path);
                throw await JiraErrors.FromResponseAsync(response, loginCheck, linked.Token);
            }

            await using var body = await response.Content.ReadAsStreamAsync(linked.Token);
            return await read(body, linked.Token);
        }
        catch (OperationCanceledException) when (timeout.IsCancellationRequested && !cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning("Jira did not answer within {TimeoutSeconds} s", settings.TimeoutSeconds);
            throw JiraErrors.Timeout();
        }
        catch (HttpRequestException exception)
        {
            logger.LogWarning(exception, "Jira could not be reached");
            throw JiraErrors.Unavailable(exception);
        }
        catch (JsonException exception)
        {
            // A JsonException message can quote the body: log the type only.
            logger.LogWarning("Jira sent an invalid response ({ExceptionType})", exception.GetType().Name);
            throw JiraErrors.Unavailable(exception);
        }
    }
}
