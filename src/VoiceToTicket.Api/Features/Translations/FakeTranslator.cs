namespace VoiceToTicket.Api.Features.Translations;

/// <summary>
/// Deterministic translator for offline work and tests. It cannot translate: it detects Cyrillic text as Ukrainian and
/// anything else as English, and puts the target code in front of the text (<c>[en] ...</c>), so a demo shows that
/// the box changed. Text already in the target language comes back unchanged.
/// </summary>
public sealed class FakeTranslator : ITranslator
{
    public const string ModelName = "fake";

    public Task<TranslatorReply> TranslateAsync(string text, string to, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(text);
        var from = IsMostlyCyrillic(text) ? "uk" : "en";
        var translated = from == to ? text : $"[{to}] {text}";
        return Task.FromResult(new TranslatorReply(from, translated, ModelName));
    }

    private static bool IsMostlyCyrillic(string text)
    {
        var letters = 0;
        var cyrillic = 0;
        foreach (var character in text)
        {
            if (!char.IsLetter(character))
            {
                continue;
            }

            letters++;
            if (character is >= 'Ѐ' and <= 'ӿ')
            {
                cyrillic++;
            }
        }

        return cyrillic * 2 > letters;
    }
}
