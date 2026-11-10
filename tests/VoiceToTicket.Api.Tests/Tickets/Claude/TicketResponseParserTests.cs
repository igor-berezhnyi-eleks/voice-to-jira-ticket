using Microsoft.AspNetCore.Http;
using VoiceToTicket.Api.Features.Tickets.Claude;
using VoiceToTicket.Api.Features.Tickets.Contract;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Tests.Tickets.Claude;

/// <summary>Plan 4.6: how a Claude reply becomes a ticket or a typed error.</summary>
public sealed class TicketResponseParserTests
{
    private static ClaudeReply Reply(string? text, string? stopReason = "end_turn") => new(text, stopReason, InputTokens: 10, OutputTokens: 20);

    [Fact]
    public void Valid_bug_is_parsed()
    {
        var ticket = TicketResponseParser.Parse(Reply(TicketSamples.PlanBugExampleJson));

        Assert.Equal(TicketType.Bug, ticket.Type);
        Assert.Equal("Saving an invoice with an empty date crashes the editor", ticket.Title);
        Assert.NotNull(ticket.Bug);
        Assert.Null(ticket.Feature);
        Assert.Equal(2, ticket.MissingInformation.Count);
    }

    [Fact]
    public void Valid_feature_is_parsed()
    {
        var ticket = TicketResponseParser.Parse(Reply(TicketSamples.FeatureExampleJson));

        Assert.Equal(TicketType.Feature, ticket.Type);
        Assert.NotNull(ticket.Feature);
        Assert.Null(ticket.Bug);
    }

    [Fact]
    public void Refusal_is_unprocessable_even_without_text()
    {
        var exception = Assert.Throws<ApiException>(() => TicketResponseParser.Parse(Reply(null, "refusal")));

        Assert.Equal(ErrorCodes.LlmRefused, exception.Code);
        Assert.Equal(StatusCodes.Status422UnprocessableEntity, exception.StatusCode);
    }

    [Fact]
    public void Refusal_wins_over_text_that_looks_valid()
    {
        var exception = Assert.Throws<ApiException>(() => TicketResponseParser.Parse(Reply(TicketSamples.PlanBugExampleJson, "refusal")));

        Assert.Equal(ErrorCodes.LlmRefused, exception.Code);
    }

    [Theory]
    [InlineData("{\"type\": \"Bug\", \"title\": \"cut off")]
    [InlineData(TicketSamples.PlanBugExampleJson)]
    public void Truncation_is_a_bad_gateway_even_if_the_text_is_complete(string text)
    {
        var exception = Assert.Throws<ApiException>(() => TicketResponseParser.Parse(Reply(text, "max_tokens")));

        Assert.Equal(ErrorCodes.LlmTruncated, exception.Code);
        Assert.Equal(StatusCodes.Status502BadGateway, exception.StatusCode);
    }

    [Theory]
    [InlineData("not json")]
    [InlineData("{}")]
    [InlineData("null")]
    [InlineData("[]")]
    [InlineData("{\"type\": \"Bug\"}")]
    [InlineData("{\"type\":\"Epic\",\"title\":\"t\",\"description\":\"d\",\"bug\":null,\"feature\":null,\"missingInformation\":[]}")]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Text_that_is_not_a_ticket_is_invalid_output(string? text)
    {
        var exception = Assert.Throws<ApiException>(() => TicketResponseParser.Parse(Reply(text)));

        Assert.Equal(ErrorCodes.LlmInvalidOutput, exception.Code);
        Assert.Equal(StatusCodes.Status502BadGateway, exception.StatusCode);
    }

    [Theory]
    [InlineData("tool_use")]
    [InlineData("pause_turn")]
    [InlineData("stop_sequence")]
    [InlineData(null)]
    public void An_unexpected_stop_reason_is_invalid_output(string? stopReason)
    {
        var exception = Assert.Throws<ApiException>(() => TicketResponseParser.Parse(Reply(TicketSamples.PlanBugExampleJson, stopReason)));

        Assert.Equal(ErrorCodes.LlmInvalidOutput, exception.Code);
    }

    [Fact]
    public void A_ticket_that_breaks_a_validator_rule_is_invalid_output()
    {
        // Parses and fits the schema, but the Bug carries feature details (rule 1).
        const string json = """
            {
              "type": "Bug", "title": "t", "description": "d",
              "bug": { "stepsToReproduce": ["a"], "actualResult": "x", "expectedResult": "y", "environment": "z" },
              "feature": { "userNeed": "n", "proposedBehavior": "p", "acceptanceCriteria": ["c"] },
              "missingInformation": []
            }
            """;

        var exception = Assert.Throws<ApiException>(() => TicketResponseParser.Parse(Reply(json)));

        Assert.Equal(ErrorCodes.LlmInvalidOutput, exception.Code);
        Assert.Contains("must not have feature details", exception.Detail, StringComparison.Ordinal);
    }

    [Fact]
    public void A_gap_without_a_question_is_invalid_output()
    {
        // "environment" stays "Not provided" but its question is replaced by an unrelated one (rule 3).
        var json = TicketSamples.PlanBugExampleJson.Replace(
            "{ \"field\": \"bug.environment\", \"question\": \"Which browser and application version?\" }",
            "{ \"field\": null, \"question\": \"Anything else?\" }",
            StringComparison.Ordinal);

        var exception = Assert.Throws<ApiException>(() => TicketResponseParser.Parse(Reply(json)));

        Assert.Equal(ErrorCodes.LlmInvalidOutput, exception.Code);
    }

    [Fact]
    public void Error_details_never_contain_the_model_text()
    {
        const string json = """
            {
              "type": "Bug", "title": "SECRET-TITLE", "description": "SECRET-DESCRIPTION",
              "bug": { "stepsToReproduce": ["SECRET-STEP"], "actualResult": "x", "expectedResult": "y", "environment": "z" },
              "feature": { "userNeed": "SECRET-NEED", "proposedBehavior": "p", "acceptanceCriteria": [] },
              "missingInformation": []
            }
            """;

        var exception = Assert.Throws<ApiException>(() => TicketResponseParser.Parse(Reply(json)));

        Assert.DoesNotContain("SECRET", exception.Detail ?? "", StringComparison.Ordinal);
        Assert.DoesNotContain("SECRET", exception.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Broken_json_error_does_not_carry_the_model_text_either()
    {
        var exception = Assert.Throws<ApiException>(() => TicketResponseParser.Parse(Reply("SECRET-TEXT {")));

        Assert.DoesNotContain("SECRET", exception.Detail ?? "", StringComparison.Ordinal);
        Assert.DoesNotContain("SECRET", exception.Message, StringComparison.Ordinal);
    }
}
