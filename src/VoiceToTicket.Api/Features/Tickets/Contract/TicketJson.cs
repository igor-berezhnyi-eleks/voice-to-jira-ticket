using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Schema;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;

namespace VoiceToTicket.Api.Features.Tickets.Contract;

/// <summary>The JSON form of the ticket: serializer options and the schema exported from the records (decision D8).</summary>
public static class TicketJson
{
    /// <summary>
    /// Camel case, enums as strings, and strict reading: a missing or unknown property, or null in a non-nullable
    /// property, is a <see cref="JsonException"/>. Some things the schema forbids still parse: null inside a list
    /// (<see cref="TicketValidator"/> reports it); enum values that differ in case, have surrounding spaces or are
    /// comma-separated ("bug", " Bug", "Bug, Feature"); and a top-level JSON null, which deserializes to a null
    /// ticket that callers must treat as invalid before validating.
    /// </summary>
    public static JsonSerializerOptions Options { get; } = CreateOptions();

    private static readonly JsonSchemaExporterOptions ExporterOptions = new()
    {
        TreatNullObliviousAsNonNullable = true,
        TransformSchemaNode = RequireExactProperties,
    };

    public static JsonNode ExportSchema() => Options.GetJsonSchemaAsNode(typeof(Ticket), ExporterOptions);

    public static string ExportSchemaText() => ExportSchema().ToJsonString(new JsonSerializerOptions { WriteIndented = true });

    private static JsonSerializerOptions CreateOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            PropertyNameCaseInsensitive = false,
            RespectNullableAnnotations = true,
            RespectRequiredConstructorParameters = true,
            UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
            TypeInfoResolver = new DefaultJsonTypeInfoResolver(),
        };
        options.Converters.Add(new JsonStringEnumConverter<TicketType>(allowIntegerValues: false));
        options.MakeReadOnly();
        return options;
    }

    // Claude structured outputs need additionalProperties: false on every object. All properties are
    // required: a nullable one must be sent as null, never left out.
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
