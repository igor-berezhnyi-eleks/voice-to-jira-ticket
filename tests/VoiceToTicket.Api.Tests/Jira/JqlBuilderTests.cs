using VoiceToTicket.Api.Features.Jira;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Tests.Jira;

public sealed class JqlBuilderTests
{
    [Fact]
    public void Project_type_and_text_clauses_are_combined_in_order()
    {
        var query = JqlBuilder.Build("SCRUM", ["10001", "10003"], "login");

        Assert.Equal("""project = "SCRUM" AND issuetype in (10001, 10003) AND summary ~ "login*" ORDER BY updated DESC""", query.Jql);
        Assert.Null(query.Key);
    }

    [Fact]
    public void The_project_and_type_clauses_are_optional()
    {
        Assert.Equal("""summary ~ "login*" ORDER BY updated DESC""", JqlBuilder.Build(null, null, "login").Jql);
        Assert.Equal("""project = "SCRUM" ORDER BY updated DESC""", JqlBuilder.Build("SCRUM", [], null).Jql);
        Assert.Equal("""project = "SCRUM" ORDER BY updated DESC""", JqlBuilder.Build("SCRUM", null, "   ").Jql);
    }

    [Fact]
    public void Quotes_and_backslashes_are_escaped()
    {
        var query = JqlBuilder.Build(null, null, "say \"hi\" a\\b");

        Assert.Equal("""summary ~ "say \"hi\" a\\b*" ORDER BY updated DESC""", query.Jql);
    }

    [Theory]
    [InlineData("a+b", "a b")]
    [InlineData("(x) OR [y]", "x OR y")]
    [InlineData("what?*", "what")]
    [InlineData("a:b ~ c", "a b c")]
    public void Reserved_search_characters_become_spaces(string text, string expected)
    {
        Assert.Equal($"summary ~ \"{expected}*\" ORDER BY updated DESC", JqlBuilder.Build(null, null, text).Jql);
    }

    [Fact]
    public void The_text_is_capped_at_100_characters()
    {
        var query = JqlBuilder.Build(null, null, new string('a', 250));

        Assert.Equal($"summary ~ \"{new string('a', 100)}*\" ORDER BY updated DESC", query.Jql);
    }

    [Theory]
    [InlineData("SCRUM-12", "SCRUM-12")]
    [InlineData("  scrum-7 ", "SCRUM-7")]
    [InlineData("AB_C-100", "AB_C-100")]
    public void Key_shaped_text_returns_the_key_for_a_separate_lookup_and_no_key_clause(string text, string key)
    {
        var query = JqlBuilder.Build(null, null, text);

        Assert.Equal(key, query.Key);
        Assert.DoesNotContain("key =", query.Jql);
    }

    [Theory]
    [InlineData("login")]
    [InlineData("SCRUM-")]
    [InlineData("SCRUM-12 crash")]
    [InlineData("12-SCRUM")]
    public void Other_text_has_no_key(string text)
    {
        Assert.Null(JqlBuilder.Build(null, null, text).Key);
    }

    [Theory]
    [InlineData(null, null)]
    [InlineData("", "")]
    [InlineData("   ", null)]
    [InlineData(null, "***")]
    public void No_project_and_no_usable_text_is_400_validation(string? project, string? text)
    {
        var exception = Assert.Throws<ApiException>(() => JqlBuilder.Build(project, ["10001"], text));

        Assert.Equal((400, ErrorCodes.Validation), (exception.StatusCode, exception.Code));
    }

    [Theory]
    [InlineData("scrum")]
    [InlineData("S")]
    [InlineData("1ABC")]
    [InlineData("AB\" OR 1=1")]
    [InlineData("AB-C")]
    public void A_bad_project_key_is_400_validation(string project)
    {
        var exception = Assert.Throws<ApiException>(() => JqlBuilder.Build(project, null, "x"));

        Assert.Equal(ErrorCodes.Validation, exception.Code);
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("10001) OR (1=1")]
    [InlineData("")]
    [InlineData("-5")]
    public void A_non_numeric_type_id_is_400_validation(string id)
    {
        var exception = Assert.Throws<ApiException>(() => JqlBuilder.Build("SCRUM", [id], "x"));

        Assert.Equal(ErrorCodes.Validation, exception.Code);
    }
}
