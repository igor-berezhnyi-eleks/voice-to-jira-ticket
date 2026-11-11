using VoiceToTicket.Api.Features.Transcriptions;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Evaluation;

/// <summary>
/// Transcribes the recordings in <c>eval/audio/&lt;id&gt;.webm</c> and compares each transcript with the scenario script (T5.3).
/// The STT does not depend on the Claude model, so this runs once per evaluation. A missing file is skipped; a failed
/// transcription is recorded with its code and the next recording still runs. Transcripts are never logged.
/// </summary>
public sealed class AudioTranscriber(ISpeechToText speechToText, string model, string language, string baseUrl)
{
    public const string EmptyTranscript = "empty_transcript";

    public async Task<SttResult> TranscribeAsync(IReadOnlyList<Scenario> scenarios, string audioDirectory, CancellationToken cancellationToken)
    {
        var records = new List<SttRecord>();
        foreach (var scenario in scenarios)
        {
            var path = Path.Combine(audioDirectory, scenario.Id + ".webm");
            records.Add(File.Exists(path)
                ? await TranscribeOneAsync(scenario, path, cancellationToken)
                : new SttRecord(scenario.Id, Recorded: false, ErrorCode: null, ErrorDetail: null, Transcript: null, Wer: null, DurationMs: 0));
        }

        return new SttResult(model, language, baseUrl, records);
    }

    private async Task<SttRecord> TranscribeOneAsync(Scenario scenario, string path, CancellationToken cancellationToken)
    {
        try
        {
            await using var audio = File.OpenRead(path);
            var transcription = await speechToText.TranscribeAsync(audio, Path.GetFileName(path), "audio/webm", cancellationToken);
            var wer = Wer.Compute(scenario.Script, transcription.Text);
            if (Wer.Words(transcription.Text).Count == 0)
            {
                // The STT answers "." for silence (decision 2026-11-10, T2.3): there is nothing to generate from.
                return new SttRecord(scenario.Id, true, EmptyTranscript, "The recording gave no words.", null, wer, transcription.DurationMs);
            }

            return new SttRecord(scenario.Id, true, null, null, transcription.Text, wer, transcription.DurationMs);
        }
        catch (ApiException exception)
        {
            return new SttRecord(scenario.Id, true, exception.Code, exception.Detail, null, null, 0);
        }
    }
}
