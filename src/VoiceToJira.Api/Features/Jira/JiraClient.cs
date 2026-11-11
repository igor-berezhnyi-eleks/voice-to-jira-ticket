using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;

namespace VoiceToJira.Api.Features.Jira;

// Jira Cloud REST v2 + Agile 1.0. No retries: GETs fail fast and the create POST is not idempotent.
public sealed class JiraClient(HttpClient http, IOptions<JiraOptions> options)
{
    private readonly JiraOptions options = options.Value;

    public async Task<string> GetDisplayNameAsync(JiraCredentials credentials, CancellationToken cancellationToken)
    {
        var me = await SendAsync(HttpMethod.Get, "rest/api/2/myself", credentials, null, cancellationToken);
        return me?["displayName"]?.GetValue<string>() ?? credentials.Email;
    }

    public async Task<IReadOnlyList<JiraBoard>> GetBoardsAsync(JiraCredentials credentials, string? name, CancellationToken cancellationToken)
    {
        var path = "rest/agile/1.0/board?maxResults=50" + (string.IsNullOrWhiteSpace(name) ? "" : $"&name={Uri.EscapeDataString(name)}");
        var result = await SendAsync(HttpMethod.Get, path, credentials, null, cancellationToken);

        var boards = new List<JiraBoard>();
        foreach (var board in result?["values"]?.AsArray() ?? [])
        {
            var id = board!["id"]!.GetValue<int>();
            var projectKey = board["location"]?["projectKey"]?.GetValue<string>()
                ?? await GetFirstProjectKeyAsync(credentials, id, cancellationToken);
            boards.Add(new JiraBoard(id, board["name"]?.GetValue<string>() ?? $"Board {id}", projectKey));
        }

        return boards;
    }

    // Parent candidates in a project: Epics for a Feature, Stories for a Bug.
    public async Task<IReadOnlyList<JiraIssueRef>> SearchParentsAsync(
        JiraCredentials credentials, string projectKey, string parentIssueType, string? text, CancellationToken cancellationToken)
    {
        var jql = $"project = {Quote(projectKey)} AND issuetype = {Quote(parentIssueType)} AND statusCategory != Done";
        if (!string.IsNullOrWhiteSpace(text))
        {
            jql += $" AND summary ~ {Quote(text.Trim())}";
        }

        jql += " ORDER BY updated DESC";
        var result = await SendAsync(
            HttpMethod.Get, $"rest/api/2/search/jql?maxResults=20&fields=summary&jql={Uri.EscapeDataString(jql)}", credentials, null, cancellationToken);

        return (result?["issues"]?.AsArray() ?? [])
            .Select(issue => new JiraIssueRef(issue!["key"]!.GetValue<string>(), issue["fields"]?["summary"]?.GetValue<string>() ?? ""))
            .ToList();
    }

    // Creates the issue. A Story gets its Epic as `parent`; a Bug is linked to its Story afterwards (warning if that fails).
    public async Task<CreatedIssue> CreateIssueAsync(JiraCredentials credentials, NewIssue issue, CancellationToken cancellationToken)
    {
        issue = issue with { IssueType = await ResolveIssueTypeAsync(credentials, issue.ProjectKey, issue.IssueType, cancellationToken) };
        var created = await SendAsync(HttpMethod.Post, "rest/api/2/issue", credentials, JiraPayloadBuilder.BuildIssue(issue), cancellationToken);
        var key = created?["key"]?.GetValue<string>() ?? throw new JiraException(502, "Jira did not return an issue key.");

        string? warning = null;
        if (issue.LinkToKey is not null)
        {
            try
            {
                await SendAsync(HttpMethod.Post, "rest/api/2/issueLink", credentials,
                    JiraPayloadBuilder.BuildLink(options.LinkTypeName, key, issue.LinkToKey), cancellationToken);
            }
            catch (JiraException ex)
            {
                warning = $"The issue was created, but linking it to {issue.LinkToKey} failed: {ex.Message}";
            }
        }

        return new CreatedIssue(key, $"{credentials.BaseUrl}/browse/{key}", warning);
    }

    // Names of the project's issue types that can be created directly (no sub-tasks).
    public async Task<IReadOnlyList<string>> GetIssueTypesAsync(JiraCredentials credentials, string projectKey, CancellationToken cancellationToken)
    {
        var project = await SendAsync(HttpMethod.Get, $"rest/api/2/project/{Uri.EscapeDataString(projectKey)}", credentials, null, cancellationToken);
        return (project?["issueTypes"]?.AsArray() ?? [])
            .Where(type => type?["subtask"]?.GetValue<bool>() != true)
            .Select(type => type?["name"]?.GetValue<string>())
            .OfType<string>()
            .ToList();
    }

    // The project may not have the configured type (for example no "Bug" in a Kanban project): say which ones exist.
    private async Task<string> ResolveIssueTypeAsync(JiraCredentials credentials, string projectKey, string wanted, CancellationToken cancellationToken)
    {
        var names = await GetIssueTypesAsync(credentials, projectKey, cancellationToken);
        var match = names.FirstOrDefault(name => name.Equals(wanted, StringComparison.OrdinalIgnoreCase));
        if (match is not null || names.Count == 0)
        {
            return match ?? wanted;
        }

        var message = $"Project {projectKey} has no issue type \"{wanted}\". Available: {string.Join(", ", names)}. Pick one of them.";
        throw new JiraException(400, message, new Dictionary<string, string> { ["issuetype"] = message });
    }

    private async Task<string?> GetFirstProjectKeyAsync(JiraCredentials credentials, int boardId, CancellationToken cancellationToken)
    {
        try
        {
            var projects = await SendAsync(HttpMethod.Get, $"rest/agile/1.0/board/{boardId}/project", credentials, null, cancellationToken);
            return projects?["values"]?.AsArray().FirstOrDefault()?["key"]?.GetValue<string>();
        }
        catch (JiraException)
        {
            return null;
        }
    }

    private async Task<JsonNode?> SendAsync(
        HttpMethod method, string path, JiraCredentials credentials, JsonNode? body, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(method, new Uri($"{credentials.BaseUrl}/{path}"));
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{credentials.Email}:{credentials.ApiToken}")));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        if (body is not null)
        {
            request.Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");
        }

        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(request, cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            throw new JiraException(502, $"Jira is unreachable: {ex.Message}");
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new JiraException(504, "Jira did not answer in time.");
        }

        using (response)
        {
            var text = await response.Content.ReadAsStringAsync(cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                return string.IsNullOrWhiteSpace(text) ? null : JsonNode.Parse(text);
            }

            throw Describe(response.StatusCode, text);
        }
    }

    private static JiraException Describe(HttpStatusCode status, string body)
    {
        var errors = new Dictionary<string, string>();
        var messages = new List<string>();
        try
        {
            if (JsonNode.Parse(body) is JsonObject json)
            {
                foreach (var message in json["errorMessages"]?.AsArray() ?? [])
                {
                    messages.Add(message!.GetValue<string>());
                }

                foreach (var (field, message) in json["errors"]?.AsObject() ?? [])
                {
                    errors[field] = message!.GetValue<string>();
                }
            }
        }
        catch (JsonException)
        {
            // Not a Jira error document; fall back to the status code below.
        }

        var text = string.Join(" ", messages.Concat(errors.Values));
        return new JiraException((int)status, text.Length > 0 ? text : $"Jira answered {(int)status}.", errors);
    }

    private static string Quote(string value) => "\"" + value.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";
}
