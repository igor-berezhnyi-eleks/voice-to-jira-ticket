using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace VoiceToTicket.Evaluation;

public sealed record ScenarioSet(IReadOnlyList<Scenario> Scenarios, string Hash);

/// <summary>Reads the scenario files. A bad file stops the run with a message that names it (nothing is skipped silently).</summary>
public static class ScenarioLoader
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow,
        RespectNullableAnnotations = true,
        RespectRequiredConstructorParameters = true,
    };

    public static ScenarioSet Load(string directory)
    {
        if (!Directory.Exists(directory))
        {
            throw new InvalidDataException($"Scenario directory not found: {directory}");
        }

        var files = Directory.GetFiles(directory, "*.json").OrderBy(file => file, StringComparer.Ordinal).ToArray();
        if (files.Length == 0)
        {
            throw new InvalidDataException($"No scenario files in {directory}");
        }

        var scenarios = new List<Scenario>();
        var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        foreach (var file in files)
        {
            var name = Path.GetFileName(file);
            var bytes = File.ReadAllBytes(file);
            hash.AppendData(Encoding.UTF8.GetBytes(name));
            hash.AppendData(bytes);

            Scenario? scenario;
            try
            {
                scenario = JsonSerializer.Deserialize<Scenario>(bytes, Options);
            }
            catch (JsonException exception)
            {
                throw new InvalidDataException($"Scenario file {name} is not valid: {exception.Message}", exception);
            }

            if (scenario is null)
            {
                throw new InvalidDataException($"Scenario file {name} is empty.");
            }

            if (!string.Equals(scenario.Id + ".json", name, StringComparison.Ordinal))
            {
                throw new InvalidDataException($"Scenario file {name} has id '{scenario.Id}', which does not match the file name.");
            }

            if (scenario.ExpectedType is not ("Bug" or "Feature"))
            {
                throw new InvalidDataException($"Scenario file {name} has expectedType '{scenario.ExpectedType}'; use Bug or Feature.");
            }

            if (string.IsNullOrWhiteSpace(scenario.Script))
            {
                throw new InvalidDataException($"Scenario file {name} has an empty script.");
            }

            scenarios.Add(scenario);
        }

        return new ScenarioSet(scenarios, Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant());
    }
}
