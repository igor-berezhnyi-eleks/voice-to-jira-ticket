using System.Text.Json.Serialization;
using VoiceToTicket.Api.Features.Tickets.Contract;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Evaluation;

/// <summary>What identifies a run, so the report can state exactly what was measured (plan section 6, prompt tuning rule).</summary>
public sealed record RunInfo(
    string ScenarioVersion,
    string ScenarioHash,
    string PromptHash,
    string GitCommit,
    bool GitDirty,
    DateTimeOffset StartedAt);

/// <summary>One generator call. <see cref="Ticket"/> is null when the call failed; <see cref="ErrorCode"/> is then set.</summary>
public sealed record RunRecord(
    string ScenarioId,
    int Run,
    string? ErrorCode,
    string? ErrorDetail,
    Ticket? Ticket,
    bool? TypeMatches,
    IReadOnlyList<string> ValidationErrors,
    IReadOnlyList<TrapHit> TrapHits,
    long DurationMs,
    long? InputTokens,
    long? OutputTokens,
    int Attempts,
    bool FirstAttemptValid)
{
    public bool Succeeded => ErrorCode is null;
}

/// <summary>
/// Counts per model for the two compliance rates (decision D15): <see cref="FirstAttemptValid"/> is what the Go thresholds
/// use, <see cref="Valid"/> includes tickets that needed the retry.
/// </summary>
public sealed record RunTotals(int Runs, int FirstAttemptValid, int Valid)
{
    public static RunTotals From(IReadOnlyList<RunRecord> records) =>
        new(records.Count, records.Count(record => record.FirstAttemptValid), records.Count(record => record.Succeeded));
}

/// <param name="StableType">Same type in every successful run; null when there was no successful run.</param>
public sealed record ScenarioSummary(
    string ScenarioId,
    int Runs,
    int Failures,
    bool? StableType,
    bool AnyTrapHit);

/// <param name="AudioRecords">
/// One generation per recording, made from the STT transcript (T5.3). Null when the audio path was not run, and then left
/// out of the JSON, so the shape equals a run without audio.
/// </param>
public sealed record ModelResult(
    string Model,
    string Provider,
    RunInfo Info,
    IReadOnlyList<RunRecord> Records,
    IReadOnlyList<ScenarioSummary> Summaries,
    RunTotals Totals)
{
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<RunRecord>? AudioRecords { get; init; }
}

/// <summary>
/// The transcription of one recording. <see cref="Recorded"/> is false when <c>eval/audio/&lt;id&gt;.webm</c> does not exist.
/// A failed transcription has <see cref="ErrorCode"/> and no transcript; an empty one gets <c>empty_transcript</c>.
/// </summary>
public sealed record SttRecord(
    string ScenarioId,
    bool Recorded,
    string? ErrorCode,
    string? ErrorDetail,
    string? Transcript,
    WerResult? Wer,
    long DurationMs)
{
    public bool Transcribed => Transcript is not null;
}

/// <summary>What <c>stt.json</c> holds: the STT settings, every scenario's outcome and the pooled WER.</summary>
public sealed record SttResult(string Model, string Language, string BaseUrl, IReadOnlyList<SttRecord> Records)
{
    public double? PooledWer => Wer.Pooled(Records.Where(record => record.Wer is not null).Select(record => record.Wer!));

    /// <summary>True when something was attempted and every attempt got <c>stt_unavailable</c>: the server is not there.</summary>
    public bool Unreachable
    {
        get
        {
            var attempted = Records.Where(record => record.Recorded).ToList();
            return attempted.Count > 0 && attempted.All(record => record.ErrorCode == ErrorCodes.SttUnavailable);
        }
    }
}
