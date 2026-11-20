namespace VoiceToTicket.Api.Features.Transcriptions;

/// <param name="Text">The transcript. May be empty when the audio has no speech.</param>
/// <param name="DurationMs">How long the transcription took, measured by the API (not the audio length).</param>
public sealed record Transcription(string Text, long DurationMs);

public interface ISpeechToText
{
    /// <param name="language">A configured language code (<c>Stt:Languages</c>); null or empty means <c>en</c>.</param>
    /// <exception cref="Infrastructure.ApiException">400 <c>validation</c> (language not configured), 503 <c>stt_unavailable</c>, 504 <c>stt_timeout</c> or 422 <c>audio_unreadable</c>.</exception>
    Task<Transcription> TranscribeAsync(
        Stream audio,
        string fileName,
        string contentType,
        CancellationToken cancellationToken,
        string? language = null);
}
