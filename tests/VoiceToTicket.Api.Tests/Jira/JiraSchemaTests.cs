using System.Text.Json;
using System.Text.Json.Nodes;
using VoiceToTicket.Api.Features.Jira.Contract;

namespace VoiceToTicket.Api.Tests.Jira;

/// <summary>The Jira contract is exported from the C# records and committed, like the ticket schema.</summary>
public sealed class JiraSchemaTests
{
    private const string SnapshotRelativePath = "contract/jira.schema.json";
    private const string UpdateFlag = "UPDATE_SNAPSHOTS";

    [Fact]
    public void Exported_schema_matches_the_committed_snapshot()
    {
        var snapshotPath = Path.Combine(FindRepositoryRoot(), SnapshotRelativePath);
        var exported = Normalize(JiraJson.ExportSchemaText());

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

    [Fact]
    public void Field_value_is_a_union_with_a_kind_discriminator_for_each_case()
    {
        var kinds = KindsOf(JiraJson.ExportSchema()["properties"]!["fieldValue"]!);

        Assert.Equal(["date", "labels", "number", "option", "options", "text", "textarea"], kinds.Order(StringComparer.Ordinal));
    }

    [Fact]
    public void Field_values_round_trip_through_the_discriminator()
    {
        var json = JsonSerializer.Serialize<FieldValue>(new OptionsFieldValue(["1", "2"]), JiraJson.Options);

        Assert.Equal("""{"kind":"options","ids":["1","2"]}""", json);
        var back = JsonSerializer.Deserialize<FieldValue>("""{"kind":"labels","values":["a"]}""", JiraJson.Options);
        Assert.Equal(["a"], Assert.IsType<LabelsFieldValue>(back).Values);
    }

    [Fact]
    public void An_unknown_kind_is_rejected()
    {
        Assert.ThrowsAny<JsonException>(() =>
            JsonSerializer.Deserialize<FieldValue>("""{"kind":"user","id":"1"}""", JiraJson.Options));
    }

    private static IEnumerable<string> KindsOf(JsonNode union)
    {
        var cases = union["anyOf"]!.AsArray();
        return cases.Select(node => node!["properties"]!["kind"]!["const"]!.GetValue<string>());
    }

    private static string Normalize(string text) => text.ReplaceLineEndings("\n").TrimEnd('\n') + "\n";

    private static string FindRepositoryRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, "VoiceToJira.slnx")))
            {
                return directory.FullName;
            }
        }

        throw new InvalidOperationException($"VoiceToJira.slnx not found above {AppContext.BaseDirectory}.");
    }
}
