namespace VoiceToTicket.Evaluation;

public sealed class ScenarioLoaderTests : IDisposable
{
    private readonly string _directory = Directory.CreateTempSubdirectory("vtt-scenarios-").FullName;

    public void Dispose() => Directory.Delete(_directory, recursive: true);

    [Fact]
    public void The_frozen_scenarios_load_with_the_ten_ids_of_the_plan()
    {
        var set = ScenarioLoader.Load(RepoPaths.Scenarios);

        Assert.Equal(
            ["AMBIGUOUS-01", "BUG-01", "BUG-02", "BUG-03", "BUG-04", "FEATURE-01", "FEATURE-02", "FEATURE-03", "MIXED-01", "NOISY-01"],
            set.Scenarios.Select(scenario => scenario.Id).Order(StringComparer.Ordinal));
        Assert.Equal(7, set.Scenarios.Count(scenario => scenario.CountsForTypeAccuracy));
        Assert.Equal(64, set.Hash.Length);
    }

    [Fact]
    public void The_hash_changes_when_a_scenario_file_changes()
    {
        Write("BUG-01.json", Valid("BUG-01", "one"));
        var before = ScenarioLoader.Load(_directory).Hash;

        Write("BUG-01.json", Valid("BUG-01", "two"));

        Assert.NotEqual(before, ScenarioLoader.Load(_directory).Hash);
    }

    [Fact]
    public void An_id_that_differs_from_the_file_name_is_rejected_with_the_file_name()
    {
        Write("BUG-01.json", Valid("BUG-02", "text"));

        var error = Assert.Throws<InvalidDataException>(() => ScenarioLoader.Load(_directory));

        Assert.Contains("BUG-01.json", error.Message);
    }

    [Fact]
    public void Invalid_json_is_rejected_with_the_file_name()
    {
        Write("BUG-01.json", "{ not json");

        var error = Assert.Throws<InvalidDataException>(() => ScenarioLoader.Load(_directory));

        Assert.Contains("BUG-01.json", error.Message);
    }

    [Fact]
    public void A_file_with_an_unknown_property_is_rejected()
    {
        Write("BUG-01.json", Valid("BUG-01", "text").Replace("\"traps\"", "\"extra\": 1, \"traps\""));

        Assert.Throws<InvalidDataException>(() => ScenarioLoader.Load(_directory));
    }

    [Fact]
    public void A_file_with_a_missing_property_is_rejected()
    {
        Write("BUG-01.json", """{ "id": "BUG-01", "category": "bug", "script": "x", "expectedType": "Bug" }""");

        Assert.Throws<InvalidDataException>(() => ScenarioLoader.Load(_directory));
    }

    [Fact]
    public void An_expected_type_other_than_bug_or_feature_is_rejected()
    {
        Write("BUG-01.json", Valid("BUG-01", "text").Replace("\"Bug\"", "\"Task\""));

        var error = Assert.Throws<InvalidDataException>(() => ScenarioLoader.Load(_directory));

        Assert.Contains("BUG-01.json", error.Message);
    }

    [Fact]
    public void An_empty_directory_is_an_error()
    {
        Assert.Throws<InvalidDataException>(() => ScenarioLoader.Load(_directory));
    }

    private void Write(string name, string content) => File.WriteAllText(Path.Combine(_directory, name), content);

    private static string Valid(string id, string script) => $$"""
        { "id": "{{id}}", "category": "bug", "script": "{{script}}", "expectedType": "Bug",
          "facts": ["a"], "expectedMissing": [], "traps": [ { "text": "Firefox", "reason": "not said" } ] }
        """;
}
