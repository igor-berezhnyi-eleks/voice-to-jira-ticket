using Microsoft.AspNetCore.Http;
using VoiceToTicket.Api.Features.Tickets.Claude;
using VoiceToTicket.Api.Features.Translations;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Tests.Translations;

public sealed class TranslationResponseParserTests
{
    [Fact]
    public void A_valid_reply_gives_the_source_language_and_the_text()
    {
        var (from, text) = TranslationResponseParser.Parse(Reply("""{"from":"uk","text":"The Save button does not work."}"""));

        Assert.Equal("uk", from);
        Assert.Equal("The Save button does not work.", text);
    }

    [Fact]
    public void Characters_outside_ascii_survive()
    {
        var (_, text) = TranslationResponseParser.Parse(Reply("""{"from":"en","text":"Кнопка «Save» не працює — 'так'"}"""));

        Assert.Equal("Кнопка «Save» не працює — 'так'", text);
    }

    [Theory]
    [InlineData("refusal", ErrorCodes.LlmRefused, StatusCodes.Status422UnprocessableEntity)]
    [InlineData("max_tokens", ErrorCodes.LlmTruncated, StatusCodes.Status502BadGateway)]
    [InlineData("pause_turn", ErrorCodes.LlmInvalidOutput, StatusCodes.Status502BadGateway)]
    [InlineData(null, ErrorCodes.LlmInvalidOutput, StatusCodes.Status502BadGateway)]
    public void A_stop_reason_other_than_end_turn_maps_to_its_code(string? stopReason, string code, int status)
    {
        var exception = Assert.Throws<ApiException>(() =>
            TranslationResponseParser.Parse(new ClaudeReply("""{"from":"uk","text":"x"}""", stopReason, 1, 1)));

        Assert.Equal(code, exception.Code);
        Assert.Equal(status, exception.StatusCode);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not json")]
    [InlineData("null")]
    [InlineData("[]")]
    [InlineData("""{"text":"x"}""")]
    [InlineData("""{"from":"uk"}""")]
    [InlineData("""{"from":"uk","text":""}""")]
    [InlineData("""{"from":"uk","text":"  "}""")]
    [InlineData("""{"from":"UK","text":"x"}""")]
    [InlineData("""{"from":"ukr","text":"x"}""")]
    [InlineData("""{"from":"","text":"x"}""")]
    [InlineData("""{"from":null,"text":"x"}""")]
    [InlineData("""{"from":"u1","text":"x"}""")]
    public void An_unusable_reply_is_llm_invalid_output(string? text)
    {
        var exception = Assert.Throws<ApiException>(() => TranslationResponseParser.Parse(Reply(text)));

        Assert.Equal(ErrorCodes.LlmInvalidOutput, exception.Code);
        Assert.Equal(StatusCodes.Status502BadGateway, exception.StatusCode);
    }

    [Fact]
    public void Error_details_never_contain_the_model_text()
    {
        var exception = Assert.Throws<ApiException>(() =>
            TranslationResponseParser.Parse(Reply("""{"from":"UK","text":"SECRET-MODEL-TEXT"}""")));

        Assert.DoesNotContain("SECRET", exception.Detail ?? "", StringComparison.Ordinal);
        Assert.DoesNotContain("SECRET", exception.Message, StringComparison.Ordinal);
    }

    private static ClaudeReply Reply(string? text) => new(text, "end_turn", 1, 1);
}
