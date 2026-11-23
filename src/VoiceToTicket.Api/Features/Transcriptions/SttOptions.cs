using System.Text.RegularExpressions;

namespace VoiceToTicket.Api.Features.Transcriptions;

/// <summary>The model and the timeout for one spoken language (language plan section 4).</summary>
public sealed class SttLanguageOptions
{
    public string Model { get; set; } = "";

    public int TimeoutSeconds { get; set; } = 120;
}

/// <summary>Where the speech-to-text server is and how to call it (plan 4.5, language plan section 4).</summary>
public sealed partial class SttOptions
{
    public const string SectionName = "Stt";
    public const string DefaultLanguageCode = "en";
    public const string InvalidMessage =
        $"{SectionName}:{nameof(BaseUrl)} must be an absolute http(s) URL; {SectionName}:{nameof(Languages)} (when set) needs an '{DefaultLanguageCode}' entry, lower-case two-letter codes, and a model and a positive timeout for each; otherwise {nameof(Model)}, {nameof(Language)} and a positive {nameof(TimeoutSeconds)} are required. {SectionName}:{nameof(MaxWaiting)} must be positive.";

    public string BaseUrl { get; set; } = "http://stt:8000";

    /// <summary>The English entry when <see cref="Languages"/> is empty.</summary>
    public string Model { get; set; } = "Systran/faster-whisper-medium.en";

    public string Language { get; set; } = DefaultLanguageCode;

    public int TimeoutSeconds { get; set; } = 120;

    /// <summary>Language code (for example <c>en</c>, <c>uk</c>) to model and timeout. Must contain <c>en</c>.</summary>
    public Dictionary<string, SttLanguageOptions> Languages { get; set; } = [];

    /// <summary>
    /// Requests that may wait per language while one is transcribed (deployment plan D24); the next gets 503
    /// <c>stt_busy</c>. Waiting does not count toward the language's timeout.
    /// </summary>
    public int MaxWaiting { get; set; } = 2;

    /// <summary>The entry for a code, or null when that language is not configured. Empty means English.</summary>
    public SttLanguageOptions? Resolve(string? code)
    {
        var key = string.IsNullOrEmpty(code) ? DefaultLanguageCode : code;
        if (Languages.Count > 0)
        {
            return Languages.GetValueOrDefault(key);
        }

        // Only the older Model/TimeoutSeconds settings: English only.
        return key == DefaultLanguageCode ? new SttLanguageOptions { Model = Model, TimeoutSeconds = TimeoutSeconds } : null;
    }

    public bool IsValid()
    {
        if (!Uri.TryCreate(BaseUrl, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            return false;
        }

        if (MaxWaiting <= 0)
        {
            return false;
        }

        if (Languages.Count == 0)
        {
            return !string.IsNullOrWhiteSpace(Model)
                && !string.IsNullOrWhiteSpace(Language)
                && TimeoutSeconds > 0;
        }

        return Languages.ContainsKey(DefaultLanguageCode)
            && Languages.All(pair =>
                CodePattern().IsMatch(pair.Key)
                && pair.Value is not null
                && !string.IsNullOrWhiteSpace(pair.Value.Model)
                && pair.Value.TimeoutSeconds > 0);
    }

    [GeneratedRegex("^[a-z]{2}$")]
    private static partial Regex CodePattern();
}
