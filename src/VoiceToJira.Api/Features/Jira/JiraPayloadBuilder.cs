using System.Text.Json.Nodes;

namespace VoiceToJira.Api.Features.Jira;

// ParentKey: the Epic a Story is created under. LinkToKey: the Story a Bug is linked to after creation.
public sealed record NewIssue(string ProjectKey, string IssueType, string Summary, string Description, string? ParentKey, string? LinkToKey);

public static class JiraPayloadBuilder
{
    // The description is Jira wiki markup; the v2 API accepts it as a plain string.
    public static JsonObject BuildIssue(NewIssue issue)
    {
        var fields = new JsonObject
        {
            ["project"] = new JsonObject { ["key"] = issue.ProjectKey },
            ["issuetype"] = new JsonObject { ["name"] = issue.IssueType },
            ["summary"] = issue.Summary,
            ["description"] = issue.Description,
        };

        if (issue.ParentKey is not null)
        {
            fields["parent"] = new JsonObject { ["key"] = issue.ParentKey };
        }

        return new JsonObject { ["fields"] = fields };
    }

    public static JsonObject BuildLink(string linkType, string newIssueKey, string targetKey) => new()
    {
        ["type"] = new JsonObject { ["name"] = linkType },
        ["outwardIssue"] = new JsonObject { ["key"] = newIssueKey },
        ["inwardIssue"] = new JsonObject { ["key"] = targetKey },
    };
}
