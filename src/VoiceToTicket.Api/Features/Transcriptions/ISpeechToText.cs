namespace VoiceToTicket.Api.Features.Transcriptions;

/// <param name="Text">The transcript. May be empty when the audio has no speech.</param>
/// <param name="DurationMs">How long the transcription took, measured by the API (not the audio length).</param>
public sealed record Transcription(string Text, long DurationMs);

public interface ISpeechToText
{
    /// <exception cref="Infrastructure.ApiException">503 <c>stt_unavailable</c> or 504 <c>stt_timeout</c>.</exception>
    Task<Transcription> TranscribeAsync(
        Stream audio,
        string fileName,
        string contentType,
        CancellationToken cancellationToken);
}
