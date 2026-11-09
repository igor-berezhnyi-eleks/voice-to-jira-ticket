namespace VoiceToTicket.Api.Features.Transcriptions;

/// <summary>Where the speech-to-text server is and how to call it (plan 4.5).</summary>
public sealed class SttOptions
{
    public const string SectionName = "Stt";
    public const string InvalidMessage =
        $"{SectionName}:{nameof(BaseUrl)} must be an absolute http(s) URL, {nameof(Model)} and {nameof(Language)} must not be empty, and {nameof(TimeoutSeconds)} must be positive.";

    public string BaseUrl { get; set; } = "http://stt:8000";

    public string Model { get; set; } = "Systran/faster-whisper-medium.en";

    public string Language { get; set; } = "en";

    public int TimeoutSeconds { get; set; } = 120;

    public bool IsValid() =>
        Uri.TryCreate(BaseUrl, UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
        && !string.IsNullOrWhiteSpace(Model)
        && !string.IsNullOrWhiteSpace(Language)
        && TimeoutSeconds > 0;
}
