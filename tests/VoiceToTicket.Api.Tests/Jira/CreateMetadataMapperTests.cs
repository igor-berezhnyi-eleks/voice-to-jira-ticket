using System.Text.Json;
using VoiceToTicket.Api.Features.Jira;
using VoiceToTicket.Api.Features.Jira.Contract;

namespace VoiceToTicket.Api.Tests.Jira;

public sealed class CreateMetadataMapperTests
{
    private static CreateMetaField Field(
        string type,
        string? items = null,
        string? system = null,
        string? custom = null,
        IReadOnlyList<JiraAllowedValue>? allowed = null,
        int? allowedCount = null,
        bool autoComplete = false,
        string id = "customfield_1") =>
        new(id, "Name", false, false, type, items, system, custom, autoComplete, allowed, allowedCount ?? allowed?.Count ?? 0);

    private static readonly JiraAllowedValue[] Values = [new("1", "One"), new("2", "Two")];

    [Theory]
    [InlineData("string", null, null, null, JiraFieldKind.Text)]
    [InlineData("string", null, "environment", null, JiraFieldKind.Textarea)]
    [InlineData("string", null, null, "com.atlassian.jira.plugin.system.customfieldtypes:textarea", JiraFieldKind.Textarea)]
    [InlineData("string", null, null, "com.atlassian.jira.plugin.system.customfieldtypes:textfield", JiraFieldKind.Text)]
    [InlineData("string", null, null, "com.atlassian.jira.plugin.system.customfieldtypes:url", JiraFieldKind.Text)]
    [InlineData("number", null, null, "com.atlassian.jira.plugin.system.customfieldtypes:float", JiraFieldKind.Number)]
    [InlineData("date", null, "duedate", null, JiraFieldKind.Date)]
    [InlineData("datetime", null, null, "com.atlassian.jira.plugin.system.customfieldtypes:datetime", JiraFieldKind.Unsupported)]
    [InlineData("array", "string", "labels", null, JiraFieldKind.Labels)]
    [InlineData("array", "string", null, "com.atlassian.jira.plugin.system.customfieldtypes:labels", JiraFieldKind.Labels)]
    [InlineData("array", "string", null, null, JiraFieldKind.Unsupported)]
    [InlineData("array", "user", null, "com.atlassian.jira.plugin.system.customfieldtypes:multiuserpicker", JiraFieldKind.Unsupported)]
    [InlineData("array", "json", null, "com.pyxis.greenhopper.jira:gh-sprint", JiraFieldKind.Unsupported)]
    [InlineData("array", "attachment", "attachment", null, JiraFieldKind.Unsupported)]
    [InlineData("user", null, "assignee", null, JiraFieldKind.Unsupported)]
    [InlineData("option-with-child", null, null, "com.atlassian.jira.plugin.system.customfieldtypes:cascadingselect", JiraFieldKind.Unsupported)]
    [InlineData("gadget-thing", null, null, "com.example:gadget", JiraFieldKind.Unsupported)]
    public void The_schema_decides_the_kind_for_fields_without_allowed_values(
        string type, string? items, string? system, string? custom, JiraFieldKind expected)
    {
        var field = CreateMetadataMapper.MapField(Field(type, items, system, custom));

        Assert.Equal(expected, field.Kind);
        Assert.Null(field.AllowedValues);
    }

    [Theory]
    [InlineData("priority", "priority")]
    [InlineData("option", null)]
    [InlineData("version", null)]
    [InlineData("component", null)]
    [InlineData("securitylevel", "security")]
    public void A_single_value_with_allowed_values_is_an_option_with_those_values(string type, string? system)
    {
        var field = CreateMetadataMapper.MapField(Field(type, system: system, allowed: Values));

        Assert.Equal(JiraFieldKind.Option, field.Kind);
        Assert.Equal(Values, field.AllowedValues!);
    }

    [Theory]
    [InlineData("option")]
    [InlineData("component")]
    [InlineData("version")]
    public void An_array_of_option_component_or_version_with_allowed_values_is_options(string items)
    {
        var field = CreateMetadataMapper.MapField(Field("array", items, allowed: Values));

        Assert.Equal(JiraFieldKind.Options, field.Kind);
        Assert.Equal(Values, field.AllowedValues!);
    }

    [Fact]
    public void An_array_of_options_without_allowed_values_is_unsupported()
    {
        Assert.Equal(JiraFieldKind.Unsupported, CreateMetadataMapper.MapField(Field("array", "option")).Kind);
    }

    [Fact]
    public void A_single_value_without_allowed_values_is_unsupported()
    {
        Assert.Equal(JiraFieldKind.Unsupported, CreateMetadataMapper.MapField(Field("option")).Kind);
        Assert.Equal(JiraFieldKind.Unsupported, CreateMetadataMapper.MapField(Field("option", allowed: [])).Kind);
    }

    [Fact]
    public void A_person_with_allowed_values_is_still_unsupported()
    {
        Assert.Equal(JiraFieldKind.Unsupported, CreateMetadataMapper.MapField(Field("user", allowed: Values)).Kind);
    }

    [Fact]
    public void More_than_200_allowed_values_is_unsupported_and_drops_the_list()
    {
        var field = CreateMetadataMapper.MapField(Field("option", allowed: Values, allowedCount: 201));

        Assert.Equal(JiraFieldKind.Unsupported, field.Kind);
        Assert.Null(field.AllowedValues);
    }

    [Fact]
    public void Exactly_200_allowed_values_is_still_an_option()
    {
        var values = Enumerable.Range(1, 200).Select(number => new JiraAllowedValue(number.ToString(), $"V{number}")).ToArray();

        Assert.Equal(JiraFieldKind.Option, CreateMetadataMapper.MapField(Field("option", allowed: values)).Kind);
    }

    [Fact]
    public void A_field_with_an_autocomplete_url_is_unsupported()
    {
        Assert.Equal(JiraFieldKind.Unsupported, CreateMetadataMapper.MapField(Field("option", allowed: Values, autoComplete: true)).Kind);
    }

    [Fact]
    public void A_field_without_a_schema_is_unsupported()
    {
        var field = new CreateMetaField("customfield_9", "X", true, false, null, null, null, null, false, null, 0);

        Assert.Equal(JiraFieldKind.Unsupported, CreateMetadataMapper.MapField(field).Kind);
    }

    [Fact]
    public void The_required_and_default_flags_and_names_pass_through()
    {
        var field = CreateMetadataMapper.MapField(new CreateMetaField("customfield_5", "Severity", true, true, "string", null, null, null, false, null, 0));

        Assert.Equal(("customfield_5", "Severity", true, true), (field.FieldId, field.Name, field.Required, field.HasDefaultValue));
    }

    [Fact]
    public void The_fields_the_app_fills_itself_are_left_out()
    {
        var ids = new[] { "project", "issuetype", "summary", "description", "parent", "issuelinks", "reporter", "attachment", "labels" };

        var fields = CreateMetadataMapper.MapFields(ids.Select(id => Field("string", id: id)));

        Assert.Equal(["labels"], fields.Select(field => field.FieldId));
    }

    [Fact]
    public void Parent_types_are_the_creatable_types_one_level_above()
    {
        var types = CreateMetadataParser.ParseIssueTypes(Parse(JiraFixtures.CompanyIssueTypes));
        var story = types.Single(type => type.Name == "Story");
        var epic = types.Single(type => type.Name == "Epic");

        Assert.Equal(["10000"], CreateMetadataMapper.ParentTypeIds(types, story));
        Assert.Empty(CreateMetadataMapper.ParentTypeIds(types, epic)); // nothing above an Epic
    }

    [Fact]
    public void Subtask_types_are_not_creatable_whether_flagged_or_only_below_level_zero()
    {
        var company = CreateMetadataMapper.CreatableTypes(CreateMetadataParser.ParseIssueTypes(Parse(JiraFixtures.CompanyIssueTypes)));
        var team = CreateMetadataMapper.CreatableTypes(CreateMetadataParser.ParseIssueTypes(Parse(JiraFixtures.TeamIssueTypes)));

        Assert.Equal(["Epic", "Story", "Task", "Bug"], company.Select(type => type.Name));
        Assert.Equal(["Epic", "Task", "Bug"], team.Select(type => type.Name));
    }

    [Fact]
    public void The_team_managed_fixture_has_numeric_ids_and_no_parent_above_an_epic()
    {
        var types = CreateMetadataParser.ParseIssueTypes(Parse(JiraFixtures.TeamIssueTypes));

        Assert.Equal(["10100", "10101", "10102", "10103"], types.Select(type => type.Id));
        Assert.Equal(["10100"], CreateMetadataMapper.ParentTypeIds(types, types.Single(type => type.Name == "Task")));
    }

    [Fact]
    public void A_company_managed_bug_maps_every_field_it_can_and_marks_the_rest()
    {
        var fields = CreateMetadataMapper.MapFields(CreateMetadataParser.ParseFields(Parse(JiraFixtures.CompanyBugFields)));

        Assert.Equal(
            [
                ("priority", JiraFieldKind.Option, false),
                ("labels", JiraFieldKind.Labels, false),
                ("components", JiraFieldKind.Options, false),
                ("fixVersions", JiraFieldKind.Options, false),
                ("environment", JiraFieldKind.Textarea, false),
                ("duedate", JiraFieldKind.Date, false),
                ("customfield_10016", JiraFieldKind.Number, false),
                ("customfield_10050", JiraFieldKind.Option, true),
                ("customfield_10051", JiraFieldKind.Textarea, false),
                ("customfield_10052", JiraFieldKind.Unsupported, true),
                ("customfield_10020", JiraFieldKind.Unsupported, false),
            ],
            fields.Select(field => (field.FieldId, field.Kind, field.Required)));

        var severity = fields.Single(field => field.FieldId == "customfield_10050");
        Assert.Equal([new JiraAllowedValue("40001", "Minor"), new JiraAllowedValue("40002", "Major")], severity.AllowedValues!);
        Assert.True(fields.Single(field => field.FieldId == "priority").HasDefaultValue);
    }

    [Fact]
    public void A_team_managed_task_leaves_out_the_parent_and_marks_an_unknown_required_type_unsupported()
    {
        var fields = CreateMetadataMapper.MapFields(CreateMetadataParser.ParseFields(Parse(JiraFixtures.TeamTaskFields)));

        Assert.Equal(
            [("labels", JiraFieldKind.Labels, false), ("assignee", JiraFieldKind.Unsupported, false), ("customfield_10200", JiraFieldKind.Unsupported, true)],
            fields.Select(field => (field.FieldId, field.Kind, field.Required)));
    }

    [Fact]
    public void The_parser_reads_the_total_and_skips_malformed_entries()
    {
        var page = Parse("""{"total": 3, "fields": [{"name": "no id"}, "text", {"fieldId": "labels", "schema": {"type": "array"}}]}""");

        Assert.Equal(3, CreateMetadataParser.ParseTotal(page));
        Assert.Equal(["labels"], CreateMetadataParser.ParseFields(page).Select(field => field.FieldId));
        Assert.Null(CreateMetadataParser.ParseTotal(Parse("{}")));
        Assert.Empty(CreateMetadataParser.ParseFields(Parse("[]")));
    }

    [Fact]
    public void The_parser_keeps_only_200_allowed_values_but_counts_them_all()
    {
        var values = string.Join(",", Enumerable.Range(1, 250).Select(number => $$"""{"id":"{{number}}","name":"V{{number}}"}"""));
        var page = Parse($$"""{"fields": [{"fieldId": "customfield_1", "schema": {"type": "option"}, "allowedValues": [{{values}}]}]}""");

        var field = Assert.Single(CreateMetadataParser.ParseFields(page));

        Assert.Equal((200, 250), (field.AllowedValues!.Count, field.AllowedValueCount));
        Assert.Equal(JiraFieldKind.Unsupported, CreateMetadataMapper.MapField(field).Kind);
    }

    private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement.Clone();
}
