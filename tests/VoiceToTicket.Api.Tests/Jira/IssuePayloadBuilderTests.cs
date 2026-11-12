using System.Text.Json.Nodes;
using VoiceToTicket.Api.Features.Jira;
using VoiceToTicket.Api.Features.Jira.Contract;

namespace VoiceToTicket.Api.Tests.Jira;

public sealed class IssuePayloadBuilderTests
{
    private static CreateIssueRequest Request(
        Dictionary<string, FieldValue>? fields = null,
        string? parent = null,
        string description = "h3. Description\nIt *breaks*.") =>
        new("SCRUM", "10004", "Login fails", description, parent, fields ?? [], []);

    [Fact]
    public void A_request_with_no_extras_has_only_the_fixed_fields_and_the_description_unchanged()
    {
        var payload = IssuePayloadBuilder.Build(Request());

        Assert.Equal(
            """{"fields":{"project":{"key":"SCRUM"},"issuetype":{"id":"10004"},"summary":"Login fails","description":"h3. Description\nIt *breaks*."}}""",
            payload.ToJsonString());
    }

    [Fact]
    public void A_parent_becomes_parent_key()
    {
        var fields = IssuePayloadBuilder.Build(Request(parent: "SCRUM-12"))["fields"]!;

        Assert.Equal("SCRUM-12", fields["parent"]!["key"]!.GetValue<string>());
    }

    [Fact]
    public void An_empty_description_and_no_parent_are_left_out()
    {
        var fields = IssuePayloadBuilder.Build(Request(description: ""))["fields"]!.AsObject();

        Assert.False(fields.ContainsKey("description"));
        Assert.False(fields.ContainsKey("parent"));
    }

    [Theory]
    [InlineData("text", "\"hello\"")]
    [InlineData("textarea", "\"line 1\\nline 2\"")]
    [InlineData("number", "123.4")]
    [InlineData("whole", "5")]
    [InlineData("date", "\"2026-11-12\"")]
    [InlineData("option", """{"id":"3"}""")]
    [InlineData("options", """[{"id":"1"},{"id":"2"}]""")]
    [InlineData("labels", """["voice","bug"]""")]
    [InlineData("noOptions", "[]")]
    public void Each_kind_is_converted_to_the_Jira_shape(string name, string expected)
    {
        FieldValue value = name switch
        {
            "text" => new TextFieldValue("hello"),
            "textarea" => new TextareaFieldValue("line 1\nline 2"),
            "number" => new NumberFieldValue(123.4),
            "whole" => new NumberFieldValue(5),
            "date" => new DateFieldValue("2026-11-12"),
            "option" => new OptionFieldValue("3"),
            "options" => new OptionsFieldValue(["1", "2"]),
            "labels" => new LabelsFieldValue(["voice", "bug"]),
            _ => new OptionsFieldValue([]),
        };

        var fields = IssuePayloadBuilder.Build(Request(new() { ["customfield_10020"] = value }))["fields"]!;

        Assert.Equal(expected, fields["customfield_10020"]!.ToJsonString());
    }

    [Fact]
    public void Extra_fields_are_added_beside_the_fixed_ones()
    {
        var fields = IssuePayloadBuilder.Build(Request(new()
        {
            ["priority"] = new OptionFieldValue("2"),
            ["labels"] = new LabelsFieldValue(["voice"]),
        }))["fields"]!.AsObject();

        Assert.Equal(["project", "issuetype", "summary", "description", "priority", "labels"], fields.Select(pair => pair.Key));
        Assert.IsType<JsonObject>(fields["priority"]);
    }
}
