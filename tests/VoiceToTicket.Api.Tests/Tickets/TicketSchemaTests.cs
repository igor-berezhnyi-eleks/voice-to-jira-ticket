using System.Text.Json.Nodes;
using VoiceToTicket.Api.Features.Tickets.Contract;

namespace VoiceToTicket.Api.Tests.Tickets;

public sealed class TicketSchemaTests
{
    private const string SnapshotRelativePath = "contract/ticket.schema.json";
    private const string UpdateFlag = "UPDATE_SNAPSHOTS";

    // The schema keywords we expect from the exporter; all are accepted by Claude structured outputs.
    // Anything else (such as maxLength, which the API rejects) must fail here before it reaches the API.
    private static readonly HashSet<string> AllowedKeywords =
        ["type", "enum", "properties", "required", "additionalProperties", "items"];

    [Fact]
    public void Every_object_has_additional_properties_false_and_all_properties_required()
    {
        var objects = SchemaNodes().Where(node => node.Schema.ContainsKey("properties")).ToList();

        Assert.Equal(4, objects.Count); // Ticket, BugDetails, FeatureDetails, MissingInformation
        foreach (var (path, schema) in objects)
        {
            Assert.False(schema["additionalProperties"]!.GetValue<bool>(), $"{path} allows additional properties");
            var properties = schema["properties"]!.AsObject().Select(property => property.Key);
            var required = schema["required"]!.AsArray().Select(name => name!.GetValue<string>());
            Assert.Equal(properties, required);
        }
    }

    [Fact]
    public void Only_keywords_supported_by_structured_outputs_are_used()
    {
        foreach (var (path, schema) in SchemaNodes())
        {
            foreach (var (keyword, _) in schema)
            {
                Assert.True(AllowedKeywords.Contains(keyword), $"{path} uses keyword '{keyword}'");
            }
        }
    }

    [Fact]
    public void Exactly_the_nullable_fields_of_the_contract_allow_null()
    {
        var allowNull = SchemaNodes()
            .Where(node => TypesOf(node.Schema).Contains("null"))
            .Select(node => node.Path)
            .Order(StringComparer.Ordinal);

        Assert.Equal(["bug", "feature", "missingInformation[].field"], allowNull);
    }

    [Fact]
    public void Ticket_type_is_a_closed_list_of_strings()
    {
        var type = TicketJson.ExportSchema()["properties"]!["type"]!;

        Assert.Equal(["Bug", "Feature"], type["enum"]!.AsArray().Select(value => value!.GetValue<string>()));
    }

    [Fact]
    public void Field_paths_are_exactly_the_fields_the_schema_defines_for_each_type()
    {
        var properties = TicketJson.ExportSchema()["properties"]!.AsObject();
        string[] common = ["title", "description"];

        Assert.Equal(
            common.Concat(PropertyPaths(properties, "bug")).Order(StringComparer.Ordinal),
            TicketFields.For(TicketType.Bug).Order(StringComparer.Ordinal));
        Assert.Equal(
            common.Concat(PropertyPaths(properties, "feature")).Order(StringComparer.Ordinal),
            TicketFields.For(TicketType.Feature).Order(StringComparer.Ordinal));
    }

    [Fact]
    public void Exported_schema_matches_the_committed_snapshot()
    {
        var snapshotPath = Path.Combine(FindRepositoryRoot(), SnapshotRelativePath);
        var exported = Normalize(TicketJson.ExportSchemaText());

        if (Environment.GetEnvironmentVariable(UpdateFlag) == "1")
        {
            Directory.CreateDirectory(Path.GetDirectoryName(snapshotPath)!);
            File.WriteAllText(snapshotPath, exported);
            return;
        }

        var instructions =
            "If the contract change is intended, set UPDATE_SNAPSHOTS=1, run this test, " +
            "review the diff of the file, then run `npm run gen:contract` in web/.";
        Assert.True(File.Exists(snapshotPath), $"{SnapshotRelativePath} does not exist. {instructions}");

        var committed = Normalize(File.ReadAllText(snapshotPath));
        Assert.True(
            committed == exported,
            $"The schema exported from the C# records differs from {SnapshotRelativePath}. {instructions}\n" +
            $"--- committed\n{committed}\n--- exported\n{exported}");
    }

    private static IEnumerable<string> PropertyPaths(JsonObject ticketProperties, string section) =>
        ticketProperties[section]!["properties"]!.AsObject().Select(property => $"{section}.{property.Key}");

    private static string[] TypesOf(JsonObject schema) => schema["type"] switch
    {
        JsonArray types => types.Select(type => type!.GetValue<string>()).ToArray(),
        JsonValue type => [type.GetValue<string>()],
        _ => [],
    };

    // Walks schema positions only, so the ticket's own property called "type" is not read as a keyword.
    private static IEnumerable<(string Path, JsonObject Schema)> SchemaNodes()
    {
        var pending = new Stack<(string Path, JsonObject Schema)>();
        pending.Push(("", TicketJson.ExportSchema().AsObject()));

        while (pending.TryPop(out var node))
        {
            yield return node;

            if (node.Schema["items"] is JsonObject items)
            {
                pending.Push(($"{node.Path}[]", items));
            }

            if (node.Schema["properties"] is JsonObject properties)
            {
                foreach (var (name, property) in properties)
                {
                    pending.Push((node.Path.Length == 0 ? name : $"{node.Path}.{name}", property!.AsObject()));
                }
            }
        }
    }

    private static string Normalize(string text) => text.ReplaceLineEndings("\n").TrimEnd('\n') + "\n";

    private static string FindRepositoryRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, "VoiceToTicket.slnx")))
            {
                return directory.FullName;
            }
        }

        throw new InvalidOperationException($"VoiceToTicket.slnx not found above {AppContext.BaseDirectory}.");
    }
}
