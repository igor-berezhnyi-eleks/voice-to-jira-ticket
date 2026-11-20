using System.Text.Json;
using VoiceToTicket.Api.Features.Tickets;
using VoiceToTicket.Api.Features.Tickets.Contract;
using VoiceToTicket.Api.Features.Transcriptions;

namespace VoiceToTicket.Evaluation;

public sealed class UkrainianSetTests : IDisposable
{
    private static readonly DateTimeOffset Started = new(2026, 11, 20, 12, 0, 0, TimeSpan.Zero);

    private readonly string _audio = Directory.CreateTempSubdirectory("vtt-audio-uk-").FullName;
    private readonly string _results = Directory.CreateTempSubdirectory("vtt-results-uk-").FullName;

    public void Dispose()
    {
        Directory.Delete(_audio, recursive: true);
        Directory.Delete(_results, recursive: true);
    }

    [Fact]
    public void The_default_set_is_v1_and_uk_is_chosen_by_name()
    {
        Assert.Same(EvaluationSet.V1, EvaluationSet.Resolve(null));
        Assert.Same(EvaluationSet.V1, EvaluationSet.Resolve(""));
        Assert.Same(EvaluationSet.V1, EvaluationSet.Resolve("v1"));
        Assert.Same(EvaluationSet.Ukrainian, EvaluationSet.Resolve("uk"));
        Assert.Same(EvaluationSet.Ukrainian, EvaluationSet.Resolve(" UK "));
        Assert.Equal("eval-scenarios-v1", EvaluationSet.V1.Version);
        Assert.Equal("eval-scenarios-uk-v1", EvaluationSet.Ukrainian.Version);
        Assert.Equal("en", EvaluationSet.V1.Language);
        Assert.Equal("uk", EvaluationSet.Ukrainian.Language);
    }

    [Fact]
    public void An_unknown_set_name_is_an_error_that_names_the_choices()
    {
        var error = Assert.Throws<InvalidDataException>(() => EvaluationSet.Resolve("de"));

        Assert.Contains("v1", error.Message);
        Assert.Contains("uk", error.Message);
    }

    [Fact]
    public void The_ukrainian_audio_folder_is_apart_from_the_english_one()
    {
        Assert.Equal(RepoPaths.Audio, EvaluationSet.V1.AudioDirectory);
        Assert.Equal(Path.Combine(RepoPaths.Audio, "uk"), EvaluationSet.Ukrainian.AudioDirectory);
    }

    [Fact]
    public void The_ukrainian_set_loads_with_ten_scenarios_all_expecting_uk()
    {
        var set = ScenarioLoader.Load(EvaluationSet.Ukrainian.ScenarioDirectory);

        Assert.Equal(10, set.Scenarios.Count);
        Assert.Equal(7, set.Scenarios.Count(scenario => scenario.CountsForTypeAccuracy));
        Assert.All(set.Scenarios, scenario => Assert.Equal("uk", scenario.ExpectedLanguage));
        Assert.All(set.Scenarios, scenario => Assert.Contains(scenario.Script, character => character is >= 'а' and <= 'я'));
    }

    [Fact]
    public void The_english_scenarios_still_load_without_an_expected_language()
    {
        var set = ScenarioLoader.Load(EvaluationSet.V1.ScenarioDirectory);

        Assert.All(set.Scenarios, scenario => Assert.Null(scenario.ExpectedLanguage));
    }

    [Theory]
    [InlineData("uk", "uk", true)]
    [InlineData("uk", "en", false)]
    [InlineData("en", "uk", false)]
    [InlineData("uk", "UK", false)]
    public void The_ticket_language_is_compared_with_the_expected_one(string expected, string actual, bool matches)
    {
        var scenario = TicketChecksTests.Scenario("bug", "Bug") with { ExpectedLanguage = expected };

        Assert.Equal(matches, TicketChecks.LanguageMatches(scenario, TicketChecksTests.Bug() with { Language = actual }));
    }

    [Fact]
    public void Without_an_expected_language_the_check_is_not_counted()
    {
        Assert.Null(TicketChecks.LanguageMatches(TicketChecksTests.Scenario("bug", "Bug"), TicketChecksTests.Bug()));
    }

    [Fact]
    public async Task The_runner_records_the_language_check_and_only_writes_it_when_there_is_one()
    {
        var uk = ScenarioLoader.Load(EvaluationSet.Ukrainian.ScenarioDirectory);
        var generator = new FakeTicketGenerator(TimeProvider.System);

        var ukResult = await Run(generator, uk, EvaluationSet.Ukrainian);
        var enResult = await Run(generator, ScenarioLoader.Load(EvaluationSet.V1.ScenarioDirectory), EvaluationSet.V1);

        Assert.Equal(uk.Scenarios.Count + 3 * 3, ukResult.Records.Count);
        Assert.All(ukResult.Records, record => Assert.Equal(true, record.LanguageMatches));
        Assert.Equal(EvaluationSet.Ukrainian.Version, ukResult.Info.ScenarioVersion);
        Assert.All(enResult.Records, record => Assert.Null(record.LanguageMatches));
        Assert.Equal(EvaluationSet.V1.Version, enResult.Info.ScenarioVersion);

        ResultWriter.Write(_results, [enResult], ScenarioLoader.Load(EvaluationSet.V1.ScenarioDirectory).Scenarios);
        Assert.DoesNotContain("languageMatches", File.ReadAllText(Path.Combine(_results, "fake.json")));
    }

    [Fact]
    public async Task A_wrong_ticket_language_is_flagged_in_the_json_and_the_scoring_sheet()
    {
        var uk = ScenarioLoader.Load(EvaluationSet.Ukrainian.ScenarioDirectory);
        var english = new FixedGenerator(TicketChecksTests.Bug() with { Language = "en" });

        var result = await Run(english, uk, EvaluationSet.Ukrainian);
        ResultWriter.Write(_results, [result], uk.Scenarios);

        Assert.All(result.Records, record => Assert.Equal(false, record.LanguageMatches));
        using var document = JsonDocument.Parse(File.ReadAllText(Path.Combine(_results, "fake.json")));
        Assert.False(document.RootElement.GetProperty("records")[0].GetProperty("languageMatches").GetBoolean());
        var sheet = File.ReadAllText(Path.Combine(_results, ResultWriter.ScoringSheetFileName));
        Assert.Contains("Language check: MISMATCH", sheet);
        // A scenario without an expected language (the English set) keeps its sheet as before.
        var englishSheet = ResultWriterSheetFor(TicketChecksTests.Bug());
        Assert.DoesNotContain("Language check", englishSheet);
        Assert.DoesNotContain("Ticket language as expected", englishSheet);
    }

    [Fact]
    public async Task The_scoring_sheet_counts_the_language_matches_per_model()
    {
        var uk = ScenarioLoader.Load(EvaluationSet.Ukrainian.ScenarioDirectory);
        var result = await Run(new FixedGenerator(TicketChecksTests.Bug() with { Language = "uk" }), uk, EvaluationSet.Ukrainian);

        var sheet = ResultWriter.ScoringSheet([result], uk.Scenarios);

        Assert.Contains($"Ticket language as expected: {result.Records.Count} of {result.Records.Count}", sheet);
    }

    [Fact]
    public async Task The_audio_path_sends_the_set_language_to_the_speech_to_text()
    {
        var uk = ScenarioLoader.Load(EvaluationSet.Ukrainian.ScenarioDirectory);
        Directory.CreateDirectory(_audio);
        File.WriteAllBytes(Path.Combine(_audio, "BUG-01.webm"), [1, 2, 3]);
        var stt = new RecordingStt("текст");

        var result = await new AudioTranscriber(stt, "large", "uk", "http://stt.test")
            .TranscribeAsync(uk.Scenarios, _audio, TestContext.Current.CancellationToken);

        Assert.Equal("uk", stt.Language);
        Assert.Equal("uk", result.Language);
        Assert.True(Assert.Single(result.Records, record => record.Recorded).Transcribed);
    }

    [Fact]
    public void The_stt_model_for_a_set_comes_from_its_language_entry()
    {
        var options = new SttOptions
        {
            Languages = new()
            {
                ["en"] = new SttLanguageOptions { Model = "english-model", TimeoutSeconds = 10 },
                ["uk"] = new SttLanguageOptions { Model = "ukrainian-model", TimeoutSeconds = 20 },
            },
        };

        Assert.Equal("ukrainian-model", EvaluationSet.Ukrainian.SttModel(options));
        Assert.Equal("english-model", EvaluationSet.V1.SttModel(options));
        Assert.Equal("english-model", EvaluationSet.V1.SttModel(new SttOptions { Model = "english-model" }));
        Assert.Throws<InvalidDataException>(() => EvaluationSet.Ukrainian.SttModel(new SttOptions { Model = "english-model" }));
    }

    [Fact]
    public void The_result_folder_of_the_ukrainian_set_has_a_suffix()
    {
        Assert.Equal("20261120-1200", EvaluationSet.V1.RunDirectoryName(Started));
        Assert.Equal("20261120-1200-uk", EvaluationSet.Ukrainian.RunDirectoryName(Started));
    }

    private static string ResultWriterSheetFor(Ticket ticket)
    {
        var scenario = TicketChecksTests.Scenario("bug", "Bug");
        var info = new RunInfo("v", "h", "p", "c", false, Started);
        var record = new RunRecord("X-01", 1, null, null, ticket, true, [], [], 1, null, null, 1, true) { LanguageMatches = null };
        var model = new ModelResult("m", "P", info, [record], [], RunTotals.From([record]));
        return ResultWriter.ScoringSheet([model], [scenario]);
    }

    private static Task<ModelResult> Run(ITicketGenerator generator, ScenarioSet set, EvaluationSet evaluationSet)
    {
        var info = RunInfoFactory.Create(set, Started, evaluationSet.Version);
        return new EvaluationRunner(TimeProvider.System).RunAsync("fake", "Fake", generator, set.Scenarios, info, TestContext.Current.CancellationToken);
    }

    private sealed class FixedGenerator(Ticket ticket) : ITicketGenerator
    {
        public Task<GenerationResult> GenerateAsync(string transcript, CancellationToken cancellationToken, TicketType? requestedType = null) =>
            Task.FromResult(new GenerationResult(ticket, "Test", "test", 5, null, 1, FirstAttemptValid: true));
    }

    private sealed class RecordingStt(string text) : ISpeechToText
    {
        public string? Language { get; private set; }

        public Task<Transcription> TranscribeAsync(Stream audio, string fileName, string contentType, CancellationToken cancellationToken, string? language = null)
        {
            Language = language;
            return Task.FromResult(new Transcription(text, 7));
        }
    }
}
