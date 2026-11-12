using System.Text.Json.Nodes;
using VoiceToTicket.Api.Features.Jira.Contract;

namespace VoiceToTicket.Api.Features.Jira;

/// <summary>Turns a validated create request into the JSON body of <c>POST /rest/api/2/issue</c> (jira-plan 4.3). Pure.</summary>
public static class IssuePayloadBuilder
{
    public static JsonObject Build(CreateIssueRequest request)
    {
        var fields = new JsonObject
        {
            ["project"] = new JsonObject { ["key"] = request.ProjectKey },
            ["issuetype"] = new JsonObject { ["id"] = request.IssueTypeId },
            ["summary"] = request.Summary,
        };

        // An empty description is left out: Jira's default is empty too.
        if (!string.IsNullOrEmpty(request.Description))
        {
            fields["description"] = request.Description;
        }

        if (!string.IsNullOrEmpty(request.ParentKey))
        {
            fields["parent"] = new JsonObject { ["key"] = request.ParentKey };
        }

        foreach (var (fieldId, value) in request.Fields)
        {
            fields[fieldId] = ToJira(value);
        }

        return new JsonObject { ["fields"] = fields };
    }

    public static JsonNode ToJira(FieldValue value) => value switch
    {
        TextFieldValue text => JsonValue.Create(text.Value)!,
        TextareaFieldValue text => JsonValue.Create(text.Value)!,
        NumberFieldValue number => JsonValue.Create(number.Value)!,
        DateFieldValue date => JsonValue.Create(date.Value)!,
        OptionFieldValue option => new JsonObject { ["id"] = option.Id },
        OptionsFieldValue options => new JsonArray(options.Ids.Select(id => (JsonNode)new JsonObject { ["id"] = id }).ToArray()),
        LabelsFieldValue labels => new JsonArray(labels.Values.Select(label => (JsonNode)JsonValue.Create(label)!).ToArray()),
        _ => throw new ArgumentOutOfRangeException(nameof(value), value.GetType().Name, "Unknown field value kind."),
    };
}
