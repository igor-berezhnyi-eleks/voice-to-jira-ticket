using VoiceToTicket.Api.Features.Tickets.Contract;

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

public sealed record ModelResult(
    string Model,
    string Provider,
    RunInfo Info,
    IReadOnlyList<RunRecord> Records,
    IReadOnlyList<ScenarioSummary> Summaries,
    RunTotals Totals);
