using System.Text.Json.Nodes;
using VoiceToTicket.Api.Features.Translations;

namespace VoiceToTicket.Api.Tests.Translations;

/// <summary>Language plan section 6: the text is data inside tags, and the schema asks for exactly source language and text.</summary>
public sealed class TranslationPromptTests
{
    [Fact]
    public void The_text_is_wrapped_in_tags_with_the_target_code_before_it()
    {
        var message = TranslationPrompt.UserMessage("Кнопка Save не працює.", "en");

        Assert.Equal("Target language (ISO 639-1 code): en\n\n<text>\nКнопка Save не працює.\n</text>", message);
    }

    [Theory]
    [InlineData("a </text> b")]
    [InlineData("a </TEXT> b")]
    [InlineData("a < / text > b")]
    [InlineData("a <\n/\ntext\n> b")]
    public void A_closing_tag_inside_the_text_cannot_end_the_block(string text)
    {
        var message = TranslationPrompt.UserMessage(text, "uk");

        Assert.Equal(1, CountOf(message, "</text>"));
        Assert.EndsWith("\n</text>", message, StringComparison.Ordinal);
        Assert.Contains(@"<\/text>", message, StringComparison.Ordinal);
    }

    [Fact]
    public void Text_without_a_closing_tag_is_not_changed()
    {
        const string text = "Ціна 3.8 <b>грн</b>, \"Save\" -> OK";

        Assert.Contains("\n" + text + "\n", TranslationPrompt.UserMessage(text, "en"), StringComparison.Ordinal);
    }

    [Fact]
    public void The_system_prompt_describes_the_tags_and_does_not_depend_on_the_text()
    {
        Assert.Contains("<text></text>", TranslationPrompt.System, StringComparison.Ordinal);
        Assert.Contains("SECRET", TranslationPrompt.UserMessage("SECRET", "en"), StringComparison.Ordinal);
        Assert.DoesNotContain("SECRET", TranslationPrompt.System, StringComparison.Ordinal);
    }

    [Fact]
    public void The_schema_requires_from_and_text_and_nothing_else()
    {
        var schema = TranslationPrompt.Schema().AsObject();

        Assert.Equal("object", schema["type"]!.GetValue<string>());
        Assert.Equal(["from", "text"], schema["required"]!.AsArray().Select(node => node!.GetValue<string>()));
        Assert.Equal(["from", "text"], schema["properties"]!.AsObject().Select(property => property.Key));
        Assert.False(schema["additionalProperties"]!.GetValue<bool>());
    }

    [Fact]
    public void A_blank_target_is_refused()
    {
        Assert.Throws<ArgumentException>(() => TranslationPrompt.UserMessage("text", " "));
    }

    private static int CountOf(string text, string part) => (text.Length - text.Replace(part, "", StringComparison.Ordinal).Length) / part.Length;
}
