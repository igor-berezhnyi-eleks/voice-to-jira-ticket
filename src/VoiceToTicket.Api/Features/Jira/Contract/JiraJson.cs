using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Schema;
using System.Text.Json.Serialization.Metadata;

namespace VoiceToTicket.Api.Features.Jira.Contract;

/// <summary>Everything the web client needs typed from the Jira API. The exported schema feeds <c>web/src/jiraContract.ts</c>.</summary>
public sealed record JiraApiContract(
    JiraStatus Status,
    JiraSessionRequest SessionRequest,
    JiraSessionResponse SessionResponse,
    FieldValue FieldValue,
    JiraProject Project,
    JiraIssueType IssueType,
    JiraFieldsResponse FieldsResponse,
    JiraLinkType LinkType,
    JiraIssueSearchRequest IssueSearchRequest,
    JiraIssueHit IssueHit,
    CreateIssueRequest CreateIssueRequest,
    CreateIssueResponse CreateIssueResponse);

public static class JiraJson
{
    public static JsonSerializerOptions Options { get; } = CreateOptions();

    private static readonly JsonSchemaExporterOptions ExporterOptions = new()
    {
        TreatNullObliviousAsNonNullable = true,
        TransformSchemaNode = RequireExactProperties,
    };

    public static JsonNode ExportSchema() => Options.GetJsonSchemaAsNode(typeof(JiraApiContract), ExporterOptions);

    public static string ExportSchemaText() => ExportSchema().ToJsonString(new JsonSerializerOptions { WriteIndented = true });

    private static JsonSerializerOptions CreateOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            RespectNullableAnnotations = true,
            NumberHandling = System.Text.Json.Serialization.JsonNumberHandling.Strict,
            TypeInfoResolver = new DefaultJsonTypeInfoResolver(),
        };
        options.MakeReadOnly();
        return options;
    }

    // Every property is always present in a response (null when empty), so the generated type has no optional keys.
    private static JsonNode RequireExactProperties(JsonSchemaExporterContext context, JsonNode schema)
    {
        if (context.TypeInfo.Kind == JsonTypeInfoKind.Object && schema is JsonObject node && node["properties"] is JsonObject properties)
        {
            node["required"] = new JsonArray(properties.Select(property => (JsonNode)property.Key).ToArray());
            node["additionalProperties"] = false;
        }

        return schema;
    }
}
