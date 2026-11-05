using System.Text.Json;
using System.Text.Json.Nodes;
using VoiceToTicket.Api.Features.Tickets.Contract;

namespace VoiceToTicket.Api.Tests.Tickets;

public sealed class TicketContractTests
{
    [Fact]
    public void Bug_example_from_the_plan_is_read_into_the_records()
    {
        var ticket = JsonSerializer.Deserialize<Ticket>(TicketSamples.PlanBugExampleJson, TicketJson.Options)!;

        Assert.Equal(TicketType.Bug, ticket.Type);
        Assert.Equal("Saving an invoice with an empty date crashes the editor", ticket.Title);
        Assert.Null(ticket.Feature);
        Assert.Equal(["Open an existing invoice", "Clear the date field", "Click Save"], ticket.Bug!.StepsToReproduce);
        Assert.Equal("Not provided", ticket.Bug.Environment);
        Assert.Equal("bug.environment", ticket.MissingInformation[1].Field);
    }

    [Fact]
    public void Feature_example_is_read_into_the_records()
    {
        var ticket = JsonSerializer.Deserialize<Ticket>(TicketSamples.FeatureExampleJson, TicketJson.Options)!;

        Assert.Equal(TicketType.Feature, ticket.Type);
        Assert.Null(ticket.Bug);
        Assert.Equal("Accountants reconcile invoices in a spreadsheet.", ticket.Feature!.UserNeed);
        Assert.Equal(["The file contains only the rows that match the current filter"], ticket.Feature.AcceptanceCriteria);
        Assert.Null(ticket.MissingInformation[0].Field);
    }

    [Theory]
    [InlineData(TicketSamples.PlanBugExampleJson)]
    [InlineData(TicketSamples.FeatureExampleJson)]
    public void Round_trip_keeps_the_exact_json_shape(string json)
    {
        var ticket = JsonSerializer.Deserialize<Ticket>(json, TicketJson.Options);

        var written = JsonSerializer.Serialize(ticket, TicketJson.Options);

        Assert.True(
            JsonNode.DeepEquals(JsonNode.Parse(json), JsonNode.Parse(written)),
            $"Round trip changed the JSON:\n{written}");
    }

    [Fact]
    public void Enum_is_written_as_a_string_and_null_details_are_written_explicitly()
    {
        var root = JsonNode.Parse(JsonSerializer.Serialize(TicketSamples.Bug(), TicketJson.Options))!.AsObject();

        Assert.Equal("Bug", root["type"]!.GetValue<string>());
        Assert.True(root.ContainsKey("feature"));
        Assert.Null(root["feature"]);
    }

    [Theory]
    [InlineData("missing property", """{"title":"t","description":"d","bug":null,"feature":null,"missingInformation":[]}""")]
    [InlineData("missing nullable property", """{"type":"Bug","title":"t","description":"d","bug":null,"missingInformation":[]}""")]
    [InlineData("null for a non-nullable string", """{"type":"Bug","title":null,"description":"d","bug":null,"feature":null,"missingInformation":[]}""")]
    [InlineData("null for a list", """{"type":"Bug","title":"t","description":"d","bug":null,"feature":null,"missingInformation":null}""")]
    [InlineData("unknown property", """{"type":"Bug","title":"t","description":"d","bug":null,"feature":null,"missingInformation":[],"priority":"high"}""")]
    [InlineData("wrong property casing", """{"Type":"Bug","title":"t","description":"d","bug":null,"feature":null,"missingInformation":[]}""")]
    [InlineData("unknown type", """{"type":"Task","title":"t","description":"d","bug":null,"feature":null,"missingInformation":[]}""")]
    [InlineData("type as a number", """{"type":0,"title":"t","description":"d","bug":null,"feature":null,"missingInformation":[]}""")]
    public void Json_that_breaks_the_contract_is_rejected(string because, string json)
    {
        var exception = Record.Exception(() => JsonSerializer.Deserialize<Ticket>(json, TicketJson.Options));

        Assert.True(exception is JsonException, $"Expected JsonException for {because}, got: {exception?.GetType().Name ?? "no exception"}");
    }
}
