using System.Text.Json;
using VoiceToTicket.Api.Features.Tickets;
using VoiceToTicket.Api.Features.Tickets.Contract;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Evaluation;

public sealed class EvaluationRunnerTests : IDisposable
{
    private static readonly DateTimeOffset Started = new(2026, 11, 11, 14, 30, 0, TimeSpan.Zero);

    private readonly string _directory = Directory.CreateTempSubdirectory("vtt-results-").FullName;

    public void Dispose() => Directory.Delete(_directory, recursive: true);

    [Fact]
    public async Task A_run_with_the_fake_covers_every_scenario_and_repeats_the_three_unstable_ones()
    {
        var set = ScenarioLoader.Load(RepoPaths.Scenarios);

        var result = await Run(new FakeTicketGenerator(TimeProvider.System), set);

        Assert.Equal(7 + 3 * (1 + EvaluationRunner.Repeats), result.Records.Count);
        Assert.All(set.Scenarios, scenario =>
        {
            var expected = EvaluationRunner.RepeatedScenarios.Contains(scenario.Id) ? 1 + EvaluationRunner.Repeats : 1;
            Assert.Equal(expected, result.Records.Count(record => record.ScenarioId == scenario.Id));
        });
        Assert.All(result.Records, record =>
        {
            Assert.True(record.Succeeded);
            Assert.Empty(record.ValidationErrors);
            Assert.Null(record.InputTokens);
        });
        Assert.Equal(set.Scenarios.Count, result.Summaries.Count);
        Assert.All(result.Summaries, summary => Assert.Equal(true, summary.StableType));
        Assert.Equal("fake", result.Model);
    }

    [Fact]
    public async Task Type_accuracy_is_recorded_only_for_clear_scenarios()
    {
        var set = ScenarioLoader.Load(RepoPaths.Scenarios);

        var result = await Run(new FakeTicketGenerator(TimeProvider.System), set);

        foreach (var record in result.Records)
        {
            var scenario = set.Scenarios.Single(item => item.Id == record.ScenarioId);
            Assert.Equal(scenario.CountsForTypeAccuracy, record.TypeMatches.HasValue);
        }
    }

    [Fact]
    public async Task A_failed_call_is_recorded_with_its_code_and_the_run_continues()
    {
        var set = ScenarioLoader.Load(RepoPaths.Scenarios);
        var generator = new ScriptedGenerator((transcript, call) =>
            call == 2
                ? throw new ApiException(502, ErrorCodes.LlmInvalidOutput, "Bad ticket", "The ticket breaks these rules: x.")
                : Task.FromResult(Result(TicketChecksTests.Bug())));

        var result = await Run(generator, set);

        var failed = Assert.Single(result.Records, record => !record.Succeeded);
        Assert.Equal(ErrorCodes.LlmInvalidOutput, failed.ErrorCode);
        Assert.Equal("The ticket breaks these rules: x.", failed.ErrorDetail);
        Assert.Null(failed.Ticket);
        Assert.Equal(7 + 3 * (1 + EvaluationRunner.Repeats), result.Records.Count);
        Assert.Equal(1, result.Summaries.Sum(summary => summary.Failures));
    }

    [Fact]
    public async Task Attempts_and_first_attempt_validity_are_recorded_and_totalled()
    {
        var set = ScenarioLoader.Load(RepoPaths.Scenarios);
        var generator = new ScriptedGenerator((_, call) => Task.FromResult(Result(TicketChecksTests.Bug(), call == 3 ? 2 : 1)));

        var result = await Run(generator, set);

        var retried = Assert.Single(result.Records, record => record.Attempts == 2);
        Assert.True(retried.Succeeded);
        Assert.False(retried.FirstAttemptValid);
        var total = 7 + 3 * (1 + EvaluationRunner.Repeats);
        Assert.Equal(new RunTotals(total, total - 1, total), result.Totals);
    }

    [Fact]
    public async Task A_failure_after_the_retry_counts_as_neither_first_attempt_valid_nor_valid()
    {
        var set = ScenarioLoader.Load(RepoPaths.Scenarios);
        var generator = new ScriptedGenerator((_, call) => call == 2
            ? throw Tagged(new ApiException(502, ErrorCodes.LlmInvalidOutput, "Bad"), attempts: 2)
            : Task.FromResult(Result(TicketChecksTests.Bug())));

        var result = await Run(generator, set);

        var failed = Assert.Single(result.Records, record => !record.Succeeded);
        Assert.Equal(2, failed.Attempts);
        Assert.False(failed.FirstAttemptValid);
        var total = 7 + 3 * (1 + EvaluationRunner.Repeats);
        Assert.Equal(new RunTotals(total, total - 1, total - 1), result.Totals);
    }

    [Fact]
    public async Task A_failure_without_an_attempts_tag_counts_as_one_attempt()
    {
        var set = ScenarioLoader.Load(RepoPaths.Scenarios);
        var generator = new ScriptedGenerator((_, call) => call == 1
            ? throw new ApiException(422, ErrorCodes.LlmRefused, "Declined")
            : Task.FromResult(Result(TicketChecksTests.Bug())));

        var result = await Run(generator, set);

        Assert.Equal(1, Assert.Single(result.Records, record => !record.Succeeded).Attempts);
    }

    [Fact]
    public async Task The_scoring_sheet_and_json_show_attempts()
    {
        var set = ScenarioLoader.Load(RepoPaths.Scenarios);
        var generator = new ScriptedGenerator((_, call) => Task.FromResult(Result(TicketChecksTests.Bug(), call == 1 ? 2 : 1)));
        var result = await Run(generator, set);

        ResultWriter.Write(_directory, [result], set.Scenarios);

        var sheet = File.ReadAllText(Path.Combine(_directory, ResultWriter.ScoringSheetFileName));
        Assert.Contains("**Attempts: 2**", sheet);
        Assert.Single(sheet.Split("**Attempts: 2**")[1..]);
        Assert.Contains($"Valid on the first attempt: {result.Totals.FirstAttemptValid} of {result.Totals.Runs}", sheet);
        using var document = JsonDocument.Parse(File.ReadAllText(Path.Combine(_directory, "fake.json")));
        var first = document.RootElement.GetProperty("records")[0];
        Assert.Equal(2, first.GetProperty("attempts").GetInt32());
        Assert.False(first.GetProperty("firstAttemptValid").GetBoolean());
        Assert.Equal(result.Totals.FirstAttemptValid, document.RootElement.GetProperty("totals").GetProperty("firstAttemptValid").GetInt32());
    }

    [Fact]
    public async Task A_bug_in_the_generator_is_not_swallowed()
    {
        var set = ScenarioLoader.Load(RepoPaths.Scenarios);
        var generator = new ScriptedGenerator((_, _) => throw new InvalidOperationException("bug"));

        await Assert.ThrowsAsync<InvalidOperationException>(() => Run(generator, set));
    }

    [Fact]
    public async Task Stability_is_false_when_a_repeat_changes_type()
    {
        var set = ScenarioLoader.Load(RepoPaths.Scenarios);
        var noisyCalls = 0;
        var generator = new ScriptedGenerator((transcript, _) =>
        {
            var noisy = transcript == set.Scenarios.Single(scenario => scenario.Id == "NOISY-01").Script;
            if (!noisy)
            {
                return Task.FromResult(Result(TicketChecksTests.Bug()));
            }

            noisyCalls++;
            return Task.FromResult(Result(noisyCalls == 2 ? Feature() : TicketChecksTests.Bug(environment: "Firefox on Windows")));
        });

        var result = await Run(generator, set);

        var noisySummary = result.Summaries.Single(summary => summary.ScenarioId == "NOISY-01");
        Assert.Equal(false, noisySummary.StableType);
        Assert.Equal(true, result.Summaries.Single(summary => summary.ScenarioId == "BUG-01").StableType);
    }

    [Fact]
    public async Task The_writer_produces_well_formed_json_and_a_scoring_sheet_for_each_model()
    {
        var set = ScenarioLoader.Load(RepoPaths.Scenarios);
        var result = await Run(new FakeTicketGenerator(TimeProvider.System), set);

        ResultWriter.Write(_directory, [result], set.Scenarios);

        using var document = JsonDocument.Parse(File.ReadAllText(Path.Combine(_directory, "fake.json")));
        var root = document.RootElement;
        Assert.Equal("fake", root.GetProperty("model").GetString());
        Assert.Equal("eval-scenarios-v1", root.GetProperty("info").GetProperty("scenarioVersion").GetString());
        Assert.Equal(set.Hash, root.GetProperty("info").GetProperty("scenarioHash").GetString());
        Assert.Equal(result.Records.Count, root.GetProperty("records").GetArrayLength());
        var first = root.GetProperty("records")[0];
        Assert.Contains(first.GetProperty("ticket").GetProperty("type").GetString(), new[] { "Bug", "Feature" });

        var sheet = File.ReadAllText(Path.Combine(_directory, ResultWriter.ScoringSheetFileName));
        Assert.All(set.Scenarios, scenario => Assert.Contains($"### {scenario.Id}", sheet));
        Assert.Contains("#### NOISY-01 · run 4", sheet);
        Assert.Contains($"- Facts present: __ of {set.Scenarios.Single(scenario => scenario.Id == "BUG-01").Facts.Count}", sheet);
        Assert.Contains("- Usability (usable / minor edit / rewrite): ", sheet);
        Assert.Contains(set.Scenarios.First().Script, sheet);
    }

    [Fact]
    public async Task A_failed_run_appears_in_the_scoring_sheet_as_failed()
    {
        var set = ScenarioLoader.Load(RepoPaths.Scenarios);
        var generator = new ScriptedGenerator((_, call) =>
            call == 1 ? throw new ApiException(422, ErrorCodes.LlmRefused, "Declined") : Task.FromResult(Result(TicketChecksTests.Bug())));
        var result = await Run(generator, set);

        var sheet = ResultWriter.ScoringSheet([result], set.Scenarios);

        Assert.Contains($"**Failed:** `{ErrorCodes.LlmRefused}`", sheet);
    }

    [Theory]
    [InlineData("claude-sonnet-5-5", "claude-sonnet-5-5")]
    [InlineData("a/b c:d", "a_b_c_d")]
    [InlineData("", "model")]
    public void Model_ids_become_safe_file_names(string model, string expected)
    {
        Assert.Equal(expected, ResultWriter.FileNameFor(model));
    }

    [Fact]
    public void The_run_directory_is_named_by_date_and_minute()
    {
        Assert.Equal("20261111-1430", ResultWriter.RunDirectoryName(Started));
    }

    private static Task<ModelResult> Run(ITicketGenerator generator, ScenarioSet set)
    {
        var info = new RunInfo(RunInfoFactory.ScenarioVersion, set.Hash, RunInfoFactory.PromptHash(), "abc1234", false, Started);
        return new EvaluationRunner(TimeProvider.System).RunAsync("fake", "Fake", generator, set.Scenarios, info, TestContext.Current.CancellationToken);
    }

    private static GenerationResult Result(Ticket ticket, int attempts = 1) => new(ticket, "Test", "test", 5, new TokenUsage(10, 20), attempts, FirstAttemptValid: attempts == 1);

    private static ApiException Tagged(ApiException exception, int attempts)
    {
        exception.Data[VoiceToTicket.Api.Features.Tickets.Claude.ClaudeTicketGenerator.AttemptsDataKey] = attempts;
        return exception;
    }

    private static Ticket Feature() => new(
        TicketType.Feature,
        "Footer note",
        "Add a footer note.",
        null,
        new FeatureDetails("Need", "Behavior", ["Shown on PDF"]),
        []);

    private sealed class ScriptedGenerator(Func<string, int, Task<GenerationResult>> script) : ITicketGenerator
    {
        private int _calls;

        public Task<GenerationResult> GenerateAsync(string transcript, CancellationToken cancellationToken, TicketType? requestedType = null) => script(transcript, ++_calls);
    }
}
