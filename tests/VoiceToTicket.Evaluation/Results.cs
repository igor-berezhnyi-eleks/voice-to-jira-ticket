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
    long? OutputTokens)
{
    public bool Succeeded => ErrorCode is null;
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
    IReadOnlyList<ScenarioSummary> Summaries);
