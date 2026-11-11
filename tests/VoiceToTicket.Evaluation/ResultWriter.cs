using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using VoiceToTicket.Api.Features.Tickets.Contract;

namespace VoiceToTicket.Evaluation;

/// <summary>Writes <c>&lt;model&gt;.json</c> per model and one <c>scoring-sheet.md</c> into a run directory (plan 7.3).</summary>
public static class ResultWriter
{
    public const string ScoringSheetFileName = "scoring-sheet.md";
    public const string SttFileName = "stt.json";

    private static readonly JsonSerializerOptions JsonOptions = CreateOptions();

    public static string RunDirectoryName(DateTimeOffset localNow) => localNow.ToString("yyyyMMdd-HHmm");

    public static void Write(string directory, IReadOnlyList<ModelResult> results, IReadOnlyList<Scenario> scenarios, SttResult? stt = null)
    {
        Directory.CreateDirectory(directory);
        if (stt is not null)
        {
            File.WriteAllText(Path.Combine(directory, SttFileName), JsonSerializer.Serialize(new SttFile(stt), JsonOptions));
        }

        foreach (var result in results)
        {
            File.WriteAllText(Path.Combine(directory, FileNameFor(result.Model) + ".json"), JsonSerializer.Serialize(result, JsonOptions));
        }

        File.WriteAllText(Path.Combine(directory, ScoringSheetFileName), ScoringSheet(results, scenarios, stt));
    }

    /// <summary>A model id as a safe file name (letters, digits, dot, dash, underscore).</summary>
    public static string FileNameFor(string model)
    {
        var name = new string(model.Select(c => char.IsAsciiLetterOrDigit(c) || c is '.' or '-' or '_' ? c : '_').ToArray());
        return name.Length == 0 ? "model" : name;
    }

    public static string ScoringSheet(IReadOnlyList<ModelResult> results, IReadOnlyList<Scenario> scenarios, SttResult? stt = null)
    {
        var text = new StringBuilder();
        text.AppendLine("# Scoring sheet");
        text.AppendLine();
        text.AppendLine("Fill in the empty fields for every ticket (plan 7.3). Invention: `none`, `minor` or `critical` (critical = changes the meaning or adds a wrong concrete detail). Usability: `usable`, `minor edit` or `rewrite`.");
        text.AppendLine("A trap hit that is only inside a missing-information question may merely mention the term: judge it, do not count it automatically.");
        if (stt is not null)
        {
            var pooled = stt.PooledWer is { } rate ? $"{rate:P1}" : "not available";
            text.AppendLine($"Audio path: transcripts from `{stt.Model}` (language `{stt.Language}`). Pooled word error rate against the scripts: {pooled}. Tickets made from the transcripts are in the blocks \"from audio\" below; score them like the others.");
        }

        foreach (var result in results)
        {
            text.AppendLine();
            text.AppendLine($"## {result.Model}");
            text.AppendLine();
            var dirty = result.Info.GitDirty ? " (uncommitted changes)" : "";
            text.AppendLine($"Provider `{result.Provider}` · scenarios `{result.Info.ScenarioVersion}` (hash `{Short(result.Info.ScenarioHash)}`) · prompt hash `{Short(result.Info.PromptHash)}` · commit `{result.Info.GitCommit}`{dirty} · started {result.Info.StartedAt:yyyy-MM-dd HH:mm zzz}");

            text.AppendLine();
            text.AppendLine($"Valid on the first attempt: {result.Totals.FirstAttemptValid} of {result.Totals.Runs} · valid after the retry: {result.Totals.Valid} of {result.Totals.Runs} (the Go thresholds use the first number).");

            foreach (var scenario in scenarios)
            {
                var records = result.Records.Where(record => record.ScenarioId == scenario.Id).ToList();
                if (records.Count == 0)
                {
                    continue;
                }

                AppendScenario(text, scenario, records);
                if (stt?.Records.FirstOrDefault(item => item.ScenarioId == scenario.Id) is { Recorded: true } sttRecord)
                {
                    AppendAudio(text, scenario, sttRecord, result.AudioRecords?.FirstOrDefault(item => item.ScenarioId == scenario.Id), records[0]);
                }
            }
        }

        return text.ToString();
    }

    private static void AppendScenario(StringBuilder text, Scenario scenario, List<RunRecord> records)
    {
        text.AppendLine();
        text.AppendLine($"### {scenario.Id} (expected {scenario.ExpectedType})");
        text.AppendLine();
        text.AppendLine($"> {scenario.Script}");
        text.AppendLine();
        text.AppendLine("Facts that must appear:");
        foreach (var fact in scenario.Facts)
        {
            text.AppendLine($"- {fact}");
        }

        text.AppendLine();
        text.AppendLine("Missing information expected: " + (scenario.ExpectedMissing.Count == 0 ? "none" : string.Join("; ", scenario.ExpectedMissing)));
        text.AppendLine("Traps: " + (scenario.Traps.Count == 0 ? "none" : string.Join("; ", scenario.Traps.Select(trap => $"`{trap.Text}` ({trap.Reason})"))));

        foreach (var record in records)
        {
            AppendRecord(text, scenario, record, $"#### {scenario.Id} · run {record.Run}");
        }
    }

    private static void AppendAudio(StringBuilder text, Scenario scenario, SttRecord stt, RunRecord? record, RunRecord scriptRecord)
    {
        text.AppendLine();
        text.AppendLine($"#### {scenario.Id} · from audio");
        text.AppendLine();
        if (stt.Transcript is null)
        {
            var detail = stt.ErrorDetail is null ? "" : " — " + stt.ErrorDetail;
            text.AppendLine($"**Transcription failed:** `{stt.ErrorCode}`{detail}");
            return;
        }

        text.AppendLine($"STT transcript ({stt.DurationMs} ms):");
        text.AppendLine();
        text.AppendLine($"> {stt.Transcript}");
        text.AppendLine();
        text.AppendLine(WerLine(stt.Wer));
        var scriptType = scriptRecord.Ticket is { } ticket ? ticket.Type.ToString() : "failed";
        text.AppendLine($"Script path type (run 1): {scriptType}");
        if (record is not null)
        {
            AppendRecord(text, scenario, record, heading: null);
        }
    }

    private static string WerLine(WerResult? wer) => wer is null
        ? "Word error rate: not available"
        : $"Word error rate: {(wer.Rate is { } rate ? $"{rate:P1}" : "not defined")} ({wer.Substitutions} substituted, {wer.Deletions} missing, {wer.Insertions} extra, of {wer.ReferenceWords} words in the script)";

    private static void AppendRecord(StringBuilder text, Scenario scenario, RunRecord record, string? heading)
    {
        text.AppendLine();
        if (heading is not null)
        {
            text.AppendLine(heading);
            text.AppendLine();
        }

        if (record.Attempts > 1)
        {
            text.AppendLine($"**Attempts: {record.Attempts}** (the first attempt was not usable).");
            text.AppendLine();
        }

        if (record.Ticket is null)
        {
            var detail = record.ErrorDetail is null ? "" : " — " + record.ErrorDetail;
            text.AppendLine($"**Failed:** `{record.ErrorCode}`{detail}");
        }
        else
        {
            AppendTicket(text, record.Ticket);
            text.AppendLine();
            var typeCheck = record.TypeMatches is { } match ? (match ? "match" : "MISMATCH") : "not counted";
            text.AppendLine($"Type check: {typeCheck} · latency {record.DurationMs} ms · tokens {record.InputTokens?.ToString() ?? "-"} in / {record.OutputTokens?.ToString() ?? "-"} out");
            foreach (var hit in record.TrapHits)
            {
                var onlyQuestions = hit.OnlyInQuestions ? " (only in questions)" : "";
                text.AppendLine($"- **Trap hit:** `{hit.Text}` in {string.Join(", ", hit.Fields)}{onlyQuestions}");
            }
        }

        text.AppendLine();
        text.AppendLine($"- Facts present: __ of {scenario.Facts.Count}");
        text.AppendLine($"- Expected missing flagged: __ of {scenario.ExpectedMissing.Count} · spurious missing items: __");
        text.AppendLine("- Invention (none / minor / critical, with text): ");
        text.AppendLine("- Usability (usable / minor edit / rewrite): ");
    }

    private static void AppendTicket(StringBuilder text, Ticket ticket)
    {
        text.AppendLine($"**{ticket.Type}: {ticket.Title}**");
        text.AppendLine();
        text.AppendLine(ticket.Description);
        if (ticket.Bug is { } bug)
        {
            text.AppendLine();
            text.AppendLine("- Steps to reproduce: " + ListText(bug.StepsToReproduce));
            text.AppendLine("- Actual result: " + bug.ActualResult);
            text.AppendLine("- Expected result: " + bug.ExpectedResult);
            text.AppendLine("- Environment: " + bug.Environment);
        }

        if (ticket.Feature is { } feature)
        {
            text.AppendLine();
            text.AppendLine("- User need: " + feature.UserNeed);
            text.AppendLine("- Proposed behavior: " + feature.ProposedBehavior);
            text.AppendLine("- Acceptance criteria: " + ListText(feature.AcceptanceCriteria));
        }

        text.AppendLine();
        text.AppendLine("Missing information: " + (ticket.MissingInformation.Count == 0
            ? "none"
            : string.Join("; ", ticket.MissingInformation.Select(item => $"[{item.Field ?? "general"}] {item.Question}"))));
    }

    private static string ListText(IReadOnlyList<string> items) => items.Count == 0 ? "none" : string.Join(" | ", items);

    private sealed record SttFile(string Model, string Language, string BaseUrl, double? PooledWer, IReadOnlyList<SttRecord> Records)
    {
        public SttFile(SttResult result) : this(result.Model, result.Language, result.BaseUrl, result.PooledWer, result.Records)
        {
        }
    }

    private static string Short(string hash) => hash.Length <= 12 ? hash : hash[..12];

    private static JsonSerializerOptions CreateOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = true };
        options.Converters.Add(new JsonStringEnumConverter<TicketType>());
        return options;
    }
}
