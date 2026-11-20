namespace VoiceToTicket.Api.Features.Translations;

/// <summary>Translates a report to a configured language. The endpoint applies the pair rule to what comes back.</summary>
public interface ITranslator
{
    Task<TranslatorReply> TranslateAsync(string text, string to, CancellationToken cancellationToken);
}

/// <param name="From">ISO 639-1 code of the language the text was written in.</param>
/// <param name="Text">The translation, or the original text when it was already in the target language.</param>
/// <param name="Model">The model behind the translation (the provider name for the fake).</param>
public sealed record TranslatorReply(string From, string Text, string Model);
