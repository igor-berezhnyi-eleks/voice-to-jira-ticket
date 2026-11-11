using System.Text.Json;
using VoiceToTicket.Api.Features.Tickets;
using VoiceToTicket.Api.Features.Tickets.Contract;
using VoiceToTicket.Api.Features.Transcriptions;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Evaluation;

public sealed class AudioTests : IDisposable
{
    private static readonly DateTimeOffset Started = new(2026, 11, 11, 14, 30, 0, TimeSpan.Zero);

    private readonly string _audio = Directory.CreateTempSubdirectory("vtt-audio-").FullName;
    private readonly string _results = Directory.CreateTempSubdirectory("vtt-results-").FullName;

    public void Dispose()
    {
        Directory.Delete(_audio, recursive: true);
        Directory.Delete(_results, recursive: true);
    }

    [Fact]
    public async Task A_recording_is_transcribed_and_scored_against_the_script_and_a_missing_one_is_skipped()
    {
        var set = ScenarioLoader.Load(RepoPaths.Scenarios);
        var bug = set.Scenarios.Single(scenario => scenario.Id == "BUG-01");
        Record("BUG-01");
        var stt = new FakeStt(_ => bug.Script.ToUpperInvariant() + " extra");

        var result = await Transcribe(stt, set);

        Assert.Equal(set.Scenarios.Count, result.Records.Count);
        var transcribed = Assert.Single(result.Records, record => record.Recorded);
        Assert.Equal("BUG-01", transcribed.ScenarioId);
        Assert.Equal(1, transcribed.Wer!.Insertions);
        Assert.Equal(0, transcribed.Wer.Substitutions);
        Assert.Equal(Wer.Words(bug.Script).Count, transcribed.Wer.ReferenceWords);
        Assert.Equal(transcribed.Wer.Rate, result.PooledWer);
        Assert.All(result.Records.Where(record => !record.Recorded), record =>
        {
            Assert.Null(record.Transcript);
            Assert.Null(record.Wer);
            Assert.Null(record.ErrorCode);
        });
        Assert.Equal(1, stt.Calls);
        Assert.Equal("BUG-01.webm", stt.FileName);
        Assert.Equal("audio/webm", stt.ContentType);
    }

    [Fact]
    public async Task A_failed_transcription_is_recorded_with_its_code_and_the_next_recording_still_runs()
    {
        var set = ScenarioLoader.Load(RepoPaths.Scenarios);
        Record("BUG-01");
        Record("BUG-02");
        var stt = new FakeStt(call => call == 1
            ? throw new ApiException(504, ErrorCodes.SttTimeout, "Timed out")
            : "the export button is broken");

        var result = await Transcribe(stt, set);

        var failed = result.Records.Single(record => record.ScenarioId == "BUG-01");
        Assert.Equal(ErrorCodes.SttTimeout, failed.ErrorCode);
        Assert.Null(failed.Transcript);
        Assert.False(failed.Transcribed);
        Assert.True(result.Records.Single(record => record.ScenarioId == "BUG-02").Transcribed);
        Assert.False(result.Unreachable);
    }

    [Fact]
    public async Task The_server_is_unreachable_only_when_every_attempt_was_unavailable()
    {
        var set = ScenarioLoader.Load(RepoPaths.Scenarios);
        Record("BUG-01");
        Record("BUG-02");
        var down = new FakeStt(_ => throw new ApiException(503, ErrorCodes.SttUnavailable, "Down"));

        Assert.True((await Transcribe(down, set)).Unreachable);
        Assert.False((await Transcribe(new FakeStt(_ => "text"), set)).Unreachable);
        Assert.False(new SttResult("m", "en", "http://x", []).Unreachable);
    }

    [Fact]
    public async Task A_transcript_with_no_words_is_an_empty_transcript_error()
    {
        var set = ScenarioLoader.Load(RepoPaths.Scenarios);
        Record("BUG-01");

        var result = await Transcribe(new FakeStt(_ => "."), set);

        var record = Assert.Single(result.Records, item => item.Recorded);
        Assert.Equal("empty_transcript", record.ErrorCode);
        Assert.Null(record.Transcript);
        Assert.Equal(1.0, record.Wer!.Rate);
    }

    [Fact]
    public async Task The_runner_generates_one_ticket_from_each_transcript_and_not_for_failures()
    {
        var set = ScenarioLoader.Load(RepoPaths.Scenarios);
        Record("BUG-01");
        Record("BUG-02");
        var stt = new FakeStt(call => call == 1 ? "transcript of the first recording" : throw new ApiException(503, ErrorCodes.SttUnavailable, "Down"));
        var sttResult = await Transcribe(stt, set);
        var seen = new List<string>();
        var generator = new FakeGenerator(transcript =>
        {
            seen.Add(transcript);
            return Task.FromResult(Result(TicketChecksTests.Bug()));
        });

        var result = await Run(generator, set, sttResult);

        var audio = Assert.Single(result.AudioRecords!);
        Assert.Equal("BUG-01", audio.ScenarioId);
        Assert.True(audio.Succeeded);
        Assert.Equal(true, audio.TypeMatches);
        Assert.Contains("transcript of the first recording", seen);
        Assert.Equal(1, seen.Count(text => text == "transcript of the first recording"));
        // The script path is unchanged and the audio tickets are not part of its totals.
        Assert.Equal(7 + 3 * (1 + EvaluationRunner.Repeats), result.Records.Count);
        Assert.Equal(result.Records.Count, result.Totals.Runs);
    }

    [Fact]
    public async Task A_generation_failure_on_the_audio_path_is_recorded_like_on_the_script_path()
    {
        var set = ScenarioLoader.Load(RepoPaths.Scenarios);
        Record("BUG-01");
        var sttResult = await Transcribe(new FakeStt(_ => "an audio transcript"), set);
        var generator = new FakeGenerator(transcript => transcript == "an audio transcript"
            ? throw new ApiException(502, ErrorCodes.LlmInvalidOutput, "Bad")
            : Task.FromResult(Result(TicketChecksTests.Bug())));

        var result = await Run(generator, set, sttResult);

        var audio = Assert.Single(result.AudioRecords!);
        Assert.Equal(ErrorCodes.LlmInvalidOutput, audio.ErrorCode);
        Assert.Equal(1, audio.Attempts);
        Assert.False(audio.FirstAttemptValid);
    }

    [Fact]
    public async Task Without_an_stt_result_the_json_has_no_audio_records_and_no_stt_file()
    {
        var set = ScenarioLoader.Load(RepoPaths.Scenarios);
        var result = await Run(new FakeTicketGenerator(TimeProvider.System), set, stt: null);

        ResultWriter.Write(_results, [result], set.Scenarios);

        Assert.Null(result.AudioRecords);
        using var document = JsonDocument.Parse(File.ReadAllText(Path.Combine(_results, "fake.json")));
        Assert.False(document.RootElement.TryGetProperty("audioRecords", out _));
        Assert.False(File.Exists(Path.Combine(_results, ResultWriter.SttFileName)));
        Assert.DoesNotContain("From audio", File.ReadAllText(Path.Combine(_results, ResultWriter.ScoringSheetFileName)));
    }

    [Fact]
    public async Task The_writer_adds_stt_json_audio_records_and_the_from_audio_blocks()
    {
        var set = ScenarioLoader.Load(RepoPaths.Scenarios);
        Record("BUG-01");
        Record("BUG-02");
        var stt = new FakeStt(call => call == 1 ? "the export button was broken in the app" : throw new ApiException(504, ErrorCodes.SttTimeout, "Timed out"));
        var sttResult = await Transcribe(stt, set);
        var result = await Run(new FakeTicketGenerator(TimeProvider.System), set, sttResult);

        ResultWriter.Write(_results, [result], set.Scenarios, sttResult);

        using var sttDocument = JsonDocument.Parse(File.ReadAllText(Path.Combine(_results, ResultWriter.SttFileName)));
        var root = sttDocument.RootElement;
        Assert.Equal("test-model", root.GetProperty("model").GetString());
        Assert.Equal("en", root.GetProperty("language").GetString());
        Assert.Equal(set.Scenarios.Count, root.GetProperty("records").GetArrayLength());
        var first = root.GetProperty("records").EnumerateArray().Single(item => item.GetProperty("scenarioId").GetString() == "BUG-01");
        Assert.Equal("the export button was broken in the app", first.GetProperty("transcript").GetString());
        Assert.True(first.GetProperty("wer").GetProperty("referenceWords").GetInt32() > 0);
        Assert.Contains("pooledWer", root.EnumerateObject().Select(property => property.Name));

        using var modelDocument = JsonDocument.Parse(File.ReadAllText(Path.Combine(_results, "fake.json")));
        Assert.Equal(1, modelDocument.RootElement.GetProperty("audioRecords").GetArrayLength());

        var sheet = File.ReadAllText(Path.Combine(_results, ResultWriter.ScoringSheetFileName));
        Assert.Contains("#### BUG-01 · from audio", sheet);
        Assert.Contains("> the export button was broken in the app", sheet);
        Assert.Contains("Word error rate", sheet);
        Assert.Contains("Script path type (run 1):", sheet);
        Assert.Contains($"**Transcription failed:** `{ErrorCodes.SttTimeout}`", sheet);
        Assert.DoesNotContain("#### BUG-03 · from audio", sheet);
        // The audio ticket has its own empty scoring fields, after the script-path ones.
        Assert.Equal(result.Records.Count + 1, sheet.Split("- Usability (usable / minor edit / rewrite): ").Length - 1);
    }

    private void Record(string id) => File.WriteAllBytes(Path.Combine(_audio, id + ".webm"), [1, 2, 3]);

    private Task<SttResult> Transcribe(ISpeechToText stt, ScenarioSet set) =>
        new AudioTranscriber(stt, "test-model", "en", "http://stt.test").TranscribeAsync(set.Scenarios, _audio, TestContext.Current.CancellationToken);

    private static Task<ModelResult> Run(ITicketGenerator generator, ScenarioSet set, SttResult? stt)
    {
        var info = new RunInfo(RunInfoFactory.ScenarioVersion, set.Hash, RunInfoFactory.PromptHash(), "abc1234", false, Started);
        return new EvaluationRunner(TimeProvider.System).RunAsync("fake", "Fake", generator, set.Scenarios, info, TestContext.Current.CancellationToken, stt);
    }

    private static GenerationResult Result(Ticket ticket) => new(ticket, "Test", "test", 5, new TokenUsage(10, 20), 1, FirstAttemptValid: true);

    private sealed class FakeStt(Func<int, string> script) : ISpeechToText
    {
        public int Calls { get; private set; }

        public string? FileName { get; private set; }

        public string? ContentType { get; private set; }

        public async Task<Transcription> TranscribeAsync(Stream audio, string fileName, string contentType, CancellationToken cancellationToken)
        {
            Calls++;
            FileName = fileName;
            ContentType = contentType;
            using var buffer = new MemoryStream();
            await audio.CopyToAsync(buffer, cancellationToken);
            Assert.Equal(3L, buffer.Length);
            return new Transcription(script(Calls), 7);
        }
    }

    private sealed class FakeGenerator(Func<string, Task<GenerationResult>> script) : ITicketGenerator
    {
        public Task<GenerationResult> GenerateAsync(string transcript, CancellationToken cancellationToken, TicketType? requestedType = null) => script(transcript);
    }
}
