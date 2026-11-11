using VoiceToTicket.Api.Features.Tickets.Contract;

namespace VoiceToTicket.Evaluation;

public sealed class TicketChecksTests
{
    private static readonly Trap[] Traps = [new("Chrome", "No browser was mentioned"), new("timeout", "No cause was suggested")];

    [Fact]
    public void A_trap_is_found_case_insensitively_and_names_the_field()
    {
        var ticket = Bug(environment: "Running in CHROME on Windows");

        var hit = Assert.Single(TicketChecks.FindTrapHits(ticket, Traps));

        Assert.Equal("Chrome", hit.Text);
        Assert.Equal(["bug.environment"], hit.Fields);
        Assert.False(hit.OnlyInQuestions);
    }

    [Fact]
    public void A_trap_inside_a_list_item_is_found()
    {
        var ticket = Bug(steps: ["Open the list", "Wait for the timeout"]);

        var hit = Assert.Single(TicketChecks.FindTrapHits(ticket, Traps));

        Assert.Equal("timeout", hit.Text);
        Assert.Equal(["bug.stepsToReproduce"], hit.Fields);
    }

    [Fact]
    public void A_trap_only_in_a_question_is_marked_as_such()
    {
        var ticket = Bug(questions: [new MissingInformation("bug.environment", "Which browser, for example Chrome?")]);

        var hit = Assert.Single(TicketChecks.FindTrapHits(ticket, Traps));

        Assert.Equal([TicketChecks.QuestionsPath], hit.Fields);
        Assert.True(hit.OnlyInQuestions);
    }

    [Fact]
    public void A_trap_in_a_field_path_is_not_a_hit()
    {
        var ticket = Bug(questions: [new MissingInformation("bug.environment", "What is the setup?")]);

        Assert.Empty(TicketChecks.FindTrapHits(ticket, [new Trap("environment", "x")]));
    }

    [Fact]
    public void A_trap_in_a_field_and_a_question_is_not_only_in_questions()
    {
        var ticket = Bug(title: "Chrome crash", questions: [new MissingInformation(null, "Chrome version?")]);

        var hit = Assert.Single(TicketChecks.FindTrapHits(ticket, Traps));

        Assert.Equal(["title", TicketChecks.QuestionsPath], hit.Fields);
        Assert.False(hit.OnlyInQuestions);
    }

    [Fact]
    public void A_ticket_without_trap_text_has_no_hits()
    {
        Assert.Empty(TicketChecks.FindTrapHits(Bug(), Traps));
    }

    [Theory]
    [InlineData("bug", "Bug", TicketType.Bug, true)]
    [InlineData("bug", "Bug", TicketType.Feature, false)]
    [InlineData("feature", "Feature", TicketType.Feature, true)]
    [InlineData("feature", "Feature", TicketType.Bug, false)]
    public void Type_accuracy_compares_the_expected_type_for_clear_scenarios(string category, string expected, TicketType actual, bool matches)
    {
        Assert.Equal(matches, TicketChecks.TypeMatches(Scenario(category, expected), actual));
    }

    [Theory]
    [InlineData("ambiguous")]
    [InlineData("mixed")]
    public void Type_accuracy_is_not_counted_for_ambiguous_and_mixed_scenarios(string category)
    {
        Assert.Null(TicketChecks.TypeMatches(Scenario(category, "Bug"), TicketType.Feature));
    }

    internal static Scenario Scenario(string category, string expected) =>
        new("X-01", category, "script", expected, [], [], []);

    internal static Ticket Bug(
        string title = "Export fails",
        string environment = "Not provided",
        string[]? steps = null,
        MissingInformation[]? questions = null) =>
        new(
            TicketType.Bug,
            title,
            "The export fails.",
            new BugDetails(steps ?? ["Open the list"], "Empty file", "Full file", environment),
            null,
            questions ?? []);
}
