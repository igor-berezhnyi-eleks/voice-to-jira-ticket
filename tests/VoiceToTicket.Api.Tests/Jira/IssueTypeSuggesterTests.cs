using VoiceToTicket.Api.Features.Jira;

namespace VoiceToTicket.Api.Tests.Jira;

public sealed class IssueTypeSuggesterTests
{
    private static readonly JiraIssueTypeInfo Epic = new("1", "Epic", 1, false);
    private static readonly JiraIssueTypeInfo Story = new("2", "Story", 0, false);
    private static readonly JiraIssueTypeInfo Task = new("3", "Task", 0, false);
    private static readonly JiraIssueTypeInfo Bug = new("4", "Bug", 0, false);

    private static readonly string[] BugNames = ["Bug", "Defect"];
    private static readonly string[] FeatureNames = ["Story", "Feature", "Task"];

    [Fact]
    public void A_preferred_name_that_exists_is_suggested()
    {
        var suggestion = IssueTypeSuggester.Suggest([Epic, Task, Story, Bug], BugNames, FeatureNames);

        Assert.Equal("4", suggestion.BugTypeId);
        Assert.Equal("2", suggestion.FeatureTypeId); // Story comes before Task in the preference list, not in Jira's order
    }

    [Fact]
    public void Names_match_in_any_case()
    {
        var suggestion = IssueTypeSuggester.Suggest([new("9", "BUG", 0, false), new("8", "story", 0, false)], BugNames, FeatureNames);

        Assert.Equal(("9", "8"), (suggestion.BugTypeId, suggestion.FeatureTypeId));
    }

    [Fact]
    public void The_first_available_name_wins_when_earlier_ones_are_missing()
    {
        var suggestion = IssueTypeSuggester.Suggest([Epic, Task], BugNames, FeatureNames);

        Assert.Equal("3", suggestion.FeatureTypeId); // no Story or Feature, so Task
    }

    [Fact]
    public void Without_a_preferred_name_the_first_top_level_type_is_suggested_for_both()
    {
        var suggestion = IssueTypeSuggester.Suggest([Epic, new("7", "Incident", 0, false), new("6", "Change", 0, false)], BugNames, FeatureNames);

        Assert.Equal(("7", "7"), (suggestion.BugTypeId, suggestion.FeatureTypeId));
    }

    [Fact]
    public void Both_ticket_types_can_get_the_same_type()
    {
        var suggestion = IssueTypeSuggester.Suggest([Task], ["Task"], ["Task"]);

        Assert.Equal(("3", "3"), (suggestion.BugTypeId, suggestion.FeatureTypeId));
    }

    [Fact]
    public void An_empty_preference_list_means_the_fallback_applies()
    {
        var suggestion = IssueTypeSuggester.Suggest([Epic, Bug, Story], [], []);

        Assert.Equal(("4", "4"), (suggestion.BugTypeId, suggestion.FeatureTypeId));
    }

    [Fact]
    public void A_project_with_only_higher_level_types_suggests_nothing()
    {
        var suggestion = IssueTypeSuggester.Suggest([Epic], BugNames, FeatureNames);

        Assert.Equal((null, null), (suggestion.BugTypeId, suggestion.FeatureTypeId));
    }
}
