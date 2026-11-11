using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using VoiceToTicket.Api.Features.Tickets.Claude;

namespace VoiceToTicket.Evaluation;

/// <summary>
/// The real evaluation (plan section 7). It costs money, so it is skipped unless <c>VTT_RUN_EVALUATION=1</c>, and it is run
/// only when the human asks. It sends the scenario scripts (made up) to the Anthropic API.
/// <code>
/// $env:VTT_RUN_EVALUATION = "1"; dotnet test tests/VoiceToTicket.Evaluation --filter "Category=Evaluation"
/// </code>
/// Settings (environment variables):
/// <list type="bullet">
/// <item><c>VTT_EVAL_MODELS</c> — comma-separated model ids; default <c>claude-sonnet-5-5,claude-haiku-5-5</c>.</item>
/// <item><c>VTT_EVAL_SCENARIOS</c> — comma-separated scenario ids to run; default all. Use it for a cheap pipeline check.</item>
/// </list>
/// The key comes from the API's user-secrets (<c>Claude:ApiKey</c>) or the <c>Claude__ApiKey</c> environment variable.
/// Results go to <c>eval/results/&lt;yyyyMMdd-HHmm&gt;/</c>.
/// </summary>
[Trait("Category", "Evaluation")]
public sealed class EvaluationLiveTests
{
    private static readonly string[] DefaultModels = ["claude-sonnet-5-5", "claude-haiku-5-5"];

    [Fact]
    public async Task Run_the_evaluation_for_the_configured_models()
    {
        Assert.SkipUnless(Environment.GetEnvironmentVariable("VTT_RUN_EVALUATION") == "1", "Set VTT_RUN_EVALUATION=1 and provide Claude:ApiKey to run the evaluation (it costs money).");

        var cancellationToken = TestContext.Current.CancellationToken;
        var configuration = new ConfigurationBuilder()
            .AddUserSecrets(typeof(ClaudeOptions).Assembly)
            .AddEnvironmentVariables()
            .Build();

        var set = ScenarioLoader.Load(RepoPaths.Scenarios);
        var scenarios = SelectScenarios(set, Environment.GetEnvironmentVariable("VTT_EVAL_SCENARIOS"));
        var models = Split(Environment.GetEnvironmentVariable("VTT_EVAL_MODELS")) is { Length: > 0 } listed ? listed : DefaultModels;

        var timeProvider = TimeProvider.System;
        var started = timeProvider.GetLocalNow();
        var info = RunInfoFactory.Create(set, started);
        var runner = new EvaluationRunner(timeProvider);
        var results = new List<ModelResult>();

        foreach (var model in models)
        {
            var options = new ClaudeOptions();
            configuration.GetSection(ClaudeOptions.SectionName).Bind(options);
            options.Model = model;
            var problems = options.Problems();
            Assert.True(problems.Count == 0, string.Join(" ", problems));

            var wrapped = Options.Create(options);
            var generator = new ClaudeTicketGenerator(new AnthropicMessages(wrapped), wrapped, timeProvider, NullLogger<ClaudeTicketGenerator>.Instance);
            results.Add(await runner.RunAsync(model, "Claude", generator, scenarios, info, cancellationToken));
        }

        var directory = Path.Combine(RepoPaths.Results, ResultWriter.RunDirectoryName(started));
        ResultWriter.Write(directory, results, scenarios);

        Assert.All(results, result => Assert.NotEmpty(result.Records));
    }

    private static IReadOnlyList<Scenario> SelectScenarios(ScenarioSet set, string? ids)
    {
        var wanted = Split(ids);
        if (wanted.Length == 0)
        {
            return set.Scenarios;
        }

        var unknown = wanted.Except(set.Scenarios.Select(scenario => scenario.Id), StringComparer.Ordinal).ToArray();
        Assert.True(unknown.Length == 0, "Unknown scenario ids in VTT_EVAL_SCENARIOS: " + string.Join(", ", unknown));
        return set.Scenarios.Where(scenario => wanted.Contains(scenario.Id)).ToList();
    }

    private static string[] Split(string? value) =>
        (value ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
