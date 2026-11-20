using VoiceToTicket.Api.Features.Transcriptions;

namespace VoiceToTicket.Evaluation;

/// <summary>
/// A frozen scenario set (language plan section 8): the English <c>v1</c> set and the Ukrainian <c>uk</c> set. Chosen with
/// <c>VTT_EVAL_SET</c>; the default is <c>v1</c>, so a run without the variable is the run that was committed before.
/// </summary>
public sealed class EvaluationSet
{
    public static readonly EvaluationSet V1 = new("v1", "eval-scenarios-v1", "en", Path.Combine(RepoPaths.Root, "eval", "scenarios"), RepoPaths.Audio, "");

    public static readonly EvaluationSet Ukrainian = new("uk", "eval-scenarios-uk-v1", "uk", Path.Combine(RepoPaths.Root, "eval", "scenarios-uk"), Path.Combine(RepoPaths.Audio, "uk"), "-uk");

    private readonly string _directorySuffix;

    private EvaluationSet(string name, string version, string language, string scenarioDirectory, string audioDirectory, string directorySuffix)
    {
        Name = name;
        Version = version;
        Language = language;
        ScenarioDirectory = scenarioDirectory;
        AudioDirectory = audioDirectory;
        _directorySuffix = directorySuffix;
    }

    public string Name { get; }

    /// <summary>The git tag the set was frozen under; it goes into the run info.</summary>
    public string Version { get; }

    /// <summary>The spoken language of the scripts and recordings (a key of <c>Stt:Languages</c>).</summary>
    public string Language { get; }

    public string ScenarioDirectory { get; }

    /// <summary>Recordings are <c>&lt;id&gt;.webm</c>. The ids repeat across sets, so each set has its own folder.</summary>
    public string AudioDirectory { get; }

    public static EvaluationSet Resolve(string? name) => (name ?? "").Trim().ToLowerInvariant() switch
    {
        "" or "v1" => V1,
        "uk" => Ukrainian,
        _ => throw new InvalidDataException($"Unknown scenario set '{name}' in VTT_EVAL_SET. Use v1 (the default) or uk."),
    };

    /// <summary>The model for this set's language, from the same <c>Stt:Languages</c> settings the API uses.</summary>
    public string SttModel(SttOptions options) =>
        options.Resolve(Language)?.Model
        ?? throw new InvalidDataException($"Stt:Languages has no '{Language}' entry, so the audio path cannot run for the set '{Name}'.");

    public string RunDirectoryName(DateTimeOffset localNow) => ResultWriter.RunDirectoryName(localNow) + _directorySuffix;
}
