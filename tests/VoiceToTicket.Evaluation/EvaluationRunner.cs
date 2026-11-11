using VoiceToTicket.Api.Features.Tickets;
using VoiceToTicket.Api.Features.Tickets.Claude;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Evaluation;

/// <summary>
/// Runs every scenario against one generator, one request at a time (the generator itself retries an unusable ticket once, decision D15), and applies the
/// automatic checks of plan 7.2. A failed call is recorded with its error code and the run continues.
/// </summary>
public sealed class EvaluationRunner(TimeProvider timeProvider)
{
    /// <summary>Scenarios whose stability is measured (plan section 6, T5.2).</summary>
    public static readonly IReadOnlySet<string> RepeatedScenarios = new HashSet<string> { "AMBIGUOUS-01", "NOISY-01", "MIXED-01" };

    public const int Repeats = 3;

    public async Task<ModelResult> RunAsync(
        string model,
        string provider,
        ITicketGenerator generator,
        IReadOnlyList<Scenario> scenarios,
        RunInfo info,
        CancellationToken cancellationToken)
    {
        var records = new List<RunRecord>();
        foreach (var scenario in scenarios)
        {
            var runs = 1 + (RepeatedScenarios.Contains(scenario.Id) ? Repeats : 0);
            for (var run = 1; run <= runs; run++)
            {
                records.Add(await RunOnceAsync(generator, scenario, run, cancellationToken));
            }
        }

        var summaries = scenarios.Select(scenario => Summarize(scenario.Id, records)).ToList();
        return new ModelResult(model, provider, info, records, summaries, RunTotals.From(records));
    }

    private async Task<RunRecord> RunOnceAsync(ITicketGenerator generator, Scenario scenario, int run, CancellationToken cancellationToken)
    {
        var start = timeProvider.GetTimestamp();
        try
        {
            var result = await generator.GenerateAsync(scenario.Script, cancellationToken);
            return new RunRecord(
                scenario.Id,
                run,
                ErrorCode: null,
                ErrorDetail: null,
                result.Ticket,
                TicketChecks.TypeMatches(scenario, result.Ticket.Type),
                TicketValidator.Validate(result.Ticket),
                TicketChecks.FindTrapHits(result.Ticket, scenario.Traps),
                result.DurationMs,
                result.Usage?.InputTokens,
                result.Usage?.OutputTokens,
                result.Attempts,
                result.FirstAttemptValid);
        }
        catch (ApiException exception)
        {
            // The detail names broken rules only; it never holds model text (see ApiException).
            return new RunRecord(
                scenario.Id,
                run,
                exception.Code,
                exception.Detail,
                Ticket: null,
                TypeMatches: null,
                ValidationErrors: [],
                TrapHits: [],
                (long)timeProvider.GetElapsedTime(start).TotalMilliseconds,
                InputTokens: null,
                OutputTokens: null,
                // A failed ticket never counts as a valid first attempt. The generator tags how many calls it made;
                // without a tag (another generator) one call is assumed.
                Attempts: exception.Data[ClaudeTicketGenerator.AttemptsDataKey] is int attempts ? attempts : 1,
                FirstAttemptValid: false);
        }
    }

    private static ScenarioSummary Summarize(string scenarioId, List<RunRecord> records)
    {
        var own = records.Where(record => record.ScenarioId == scenarioId).ToList();
        var succeeded = own.Where(record => record.Succeeded).ToList();
        bool? stable = succeeded.Count == 0 ? null : succeeded.Select(record => record.Ticket!.Type).Distinct().Count() == 1;
        return new ScenarioSummary(
            scenarioId,
            own.Count,
            own.Count - succeeded.Count,
            stable,
            succeeded.Any(record => record.TrapHits.Count > 0));
    }
}
