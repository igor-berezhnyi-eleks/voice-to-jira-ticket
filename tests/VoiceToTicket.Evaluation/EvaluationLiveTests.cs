using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using VoiceToTicket.Api.Features.Transcriptions;
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
/// <item><c>VTT_EVAL_AUDIO=1</c> — also transcribe <c>eval/audio/&lt;id&gt;.webm</c> with the STT container (<c>docker compose up stt</c>), compute the WER and generate one ticket per transcript (T5.3).</item>
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

        // The STT is free, so the recordings are transcribed first: a missing server stops the run before any Claude call is paid for.
        var stt = Environment.GetEnvironmentVariable("VTT_EVAL_AUDIO") == "1"
            ? await TranscribeRecordingsAsync(scenarios, cancellationToken)
            : null;

        foreach (var model in models)
        {
            var options = new ClaudeOptions();
            configuration.GetSection(ClaudeOptions.SectionName).Bind(options);
            options.Model = model;
            var problems = options.Problems();
            Assert.True(problems.Count == 0, string.Join(" ", problems));

            var wrapped = Options.Create(options);
            var generator = new ClaudeTicketGenerator(new AnthropicMessages(wrapped), wrapped, timeProvider, NullLogger<ClaudeTicketGenerator>.Instance);
            results.Add(await runner.RunAsync(model, "Claude", generator, scenarios, info, cancellationToken, stt));
        }

        var directory = Path.Combine(RepoPaths.Results, ResultWriter.RunDirectoryName(started));
        ResultWriter.Write(directory, results, scenarios, stt);

        Assert.All(results, result => Assert.NotEmpty(result.Records));
    }

    /// <summary>Settings: the API's appsettings (Development, so <c>http://localhost:8000</c>), then environment variables such as <c>Stt__BaseUrl</c>.</summary>
    private static async Task<SttResult> TranscribeRecordingsAsync(IReadOnlyList<Scenario> scenarios, CancellationToken cancellationToken)
    {
        var configuration = new ConfigurationBuilder()
            .AddJsonFile(Path.Combine(RepoPaths.ApiProject, "appsettings.json"), optional: false)
            .AddJsonFile(Path.Combine(RepoPaths.ApiProject, "appsettings.Development.json"), optional: true)
            .AddEnvironmentVariables()
            .Build();
        var options = new SttOptions();
        configuration.GetSection(SttOptions.SectionName).Bind(options);
        Assert.True(options.IsValid(), SttOptions.InvalidMessage);

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton(TimeProvider.System);
        services.AddSingleton(Options.Create(options));
        services.AddHttpClient<ISpeechToText, SpeachesClient>(client =>
        {
            client.BaseAddress = new Uri(options.BaseUrl.TrimEnd('/') + "/");
            client.Timeout = Timeout.InfiniteTimeSpan; // SpeachesClient enforces Stt:TimeoutSeconds itself.
        });
        await using var provider = services.BuildServiceProvider();

        var transcriber = new AudioTranscriber(provider.GetRequiredService<ISpeechToText>(), options.Model, options.Language, options.BaseUrl);
        var result = await transcriber.TranscribeAsync(scenarios, RepoPaths.Audio, cancellationToken);

        Assert.True(result.Records.Any(record => record.Recorded), $"VTT_EVAL_AUDIO=1 is set but there is no recording for the selected scenarios in {RepoPaths.Audio} (<id>.webm).");
        Assert.False(result.Unreachable, $"VTT_EVAL_AUDIO=1 is set but the speech-to-text server at {options.BaseUrl} (Stt:BaseUrl, or the Stt__BaseUrl variable) did not answer. Start it with `docker compose up stt`.");
        return result;
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
