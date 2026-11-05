using System.Text.Json;
using VoiceToTicket.Api.Features.Tickets;
using VoiceToTicket.Api.Features.Tickets.Contract;

namespace VoiceToTicket.Api.Tests.Tickets;

public sealed class TicketValidatorTests
{
    private const string NotProvided = "Not provided";

    private static void AssertValid(Ticket ticket) => Assert.Empty(TicketValidator.Validate(ticket));

    private static void AssertSingleError(Ticket ticket, string expectedText)
    {
        var error = Assert.Single(TicketValidator.Validate(ticket));
        Assert.Contains(expectedText, error);
    }

    [Theory]
    [InlineData(TicketSamples.PlanBugExampleJson)]
    [InlineData(TicketSamples.FeatureExampleJson)]
    public void Complete_examples_are_valid(string json) =>
        AssertValid(JsonSerializer.Deserialize<Ticket>(json, TicketJson.Options)!);

    // Rule 1: the details match the type.

    [Fact]
    public void Rule1_bug_with_only_bug_details_passes() => AssertValid(TicketSamples.Bug());

    [Fact]
    public void Rule1_feature_with_only_feature_details_passes() => AssertValid(TicketSamples.Feature());

    [Fact]
    public void Rule1_bug_with_feature_set_fails() =>
        AssertSingleError(TicketSamples.Bug() with { Feature = TicketSamples.Feature().Feature }, "feature");

    [Fact]
    public void Rule1_bug_without_bug_details_fails() =>
        AssertSingleError(TicketSamples.Bug() with { Bug = null }, "bug");

    [Fact]
    public void Rule1_feature_with_bug_set_fails() =>
        AssertSingleError(TicketSamples.Feature() with { Bug = TicketSamples.Bug().Bug }, "bug");

    [Fact]
    public void Rule1_feature_without_feature_details_fails() =>
        AssertSingleError(TicketSamples.Feature() with { Feature = null }, "feature");

    [Fact]
    public void Rule1_undefined_type_fails() =>
        Assert.NotEmpty(TicketValidator.Validate(TicketSamples.Bug() with { Type = (TicketType)99 }));

    // Rule 2: title and description.

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(NotProvided)]
    public void Rule2_unusable_title_fails(string title) =>
        AssertSingleError(TicketSamples.Bug() with { Title = title }, "title");

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(NotProvided)]
    public void Rule2_unusable_description_fails(string description) =>
        AssertSingleError(TicketSamples.Feature() with { Description = description }, "description");

    [Fact]
    public void Rule2_title_of_exactly_120_characters_passes() =>
        AssertValid(TicketSamples.Bug() with { Title = new string('x', 120) });

    [Fact]
    public void Rule2_title_over_120_characters_fails() =>
        AssertSingleError(TicketSamples.Bug() with { Title = new string('x', 121) }, "120");

    // Rule 3: every gap is declared in missingInformation.

    [Theory]
    [InlineData("bug.stepsToReproduce")]
    [InlineData("bug.actualResult")]
    [InlineData("bug.expectedResult")]
    [InlineData("bug.environment")]
    [InlineData("feature.userNeed")]
    [InlineData("feature.proposedBehavior")]
    [InlineData("feature.acceptanceCriteria")]
    public void Rule3_gap_with_an_entry_naming_it_passes(string field) =>
        AssertValid(WithGap(field) with { MissingInformation = TicketSamples.Asking(field) });

    [Theory]
    [InlineData("bug.stepsToReproduce")]
    [InlineData("bug.actualResult")]
    [InlineData("bug.expectedResult")]
    [InlineData("bug.environment")]
    [InlineData("feature.userNeed")]
    [InlineData("feature.proposedBehavior")]
    [InlineData("feature.acceptanceCriteria")]
    public void Rule3_gap_without_an_entry_fails(string field) =>
        AssertSingleError(WithGap(field), field);

    [Theory]
    [InlineData("bug.actualResult", "")]
    [InlineData("bug.expectedResult", "   ")]
    [InlineData("bug.environment", "")]
    [InlineData("feature.userNeed", "  \t ")]
    [InlineData("feature.proposedBehavior", "")]
    public void Rule3_blank_detail_string_fails_even_with_an_entry(string field, string blank) =>
        AssertSingleError(WithDetailString(field, blank) with { MissingInformation = TicketSamples.Asking(field) }, field);

    [Fact]
    public void Rule3_vague_feature_with_no_acceptance_criteria_and_a_question_passes()
    {
        var feature = TicketSamples.Feature();

        AssertValid(feature with
        {
            Feature = feature.Feature! with { ProposedBehavior = NotProvided, AcceptanceCriteria = [] },
            MissingInformation = TicketSamples.Asking("feature.proposedBehavior", "feature.acceptanceCriteria"),
        });
    }

    [Fact]
    public void Rule3_general_entry_does_not_cover_a_gap() =>
        AssertSingleError(WithGap("bug.environment") with { MissingInformation = TicketSamples.Asking((string?)null) }, "bug.environment");

    [Fact]
    public void Rule3_entry_for_another_field_does_not_cover_a_gap() =>
        AssertSingleError(WithGap("bug.environment") with { MissingInformation = TicketSamples.Asking("bug.actualResult") }, "bug.environment");

    [Fact]
    public void Rule3_each_gap_is_reported_separately()
    {
        var bug = TicketSamples.Bug();
        var ticket = bug with { Bug = bug.Bug! with { ActualResult = NotProvided, Environment = NotProvided } };

        Assert.Equal(2, TicketValidator.Validate(ticket).Count);
    }

    [Fact]
    public void Rule3_question_about_a_provided_field_passes() =>
        AssertValid(TicketSamples.Bug() with { MissingInformation = TicketSamples.Asking("bug.environment") });

    // Rule 4: known field paths for the ticket's type.

    [Theory]
    [InlineData(null)]
    [InlineData("title")]
    [InlineData("description")]
    [InlineData("bug.environment")]
    public void Rule4_known_path_for_a_bug_passes(string? field) =>
        AssertValid(TicketSamples.Bug() with { MissingInformation = TicketSamples.Asking(field) });

    [Theory]
    [InlineData(null)]
    [InlineData("title")]
    [InlineData("feature.acceptanceCriteria")]
    public void Rule4_known_path_for_a_feature_passes(string? field) =>
        AssertValid(TicketSamples.Feature() with { MissingInformation = TicketSamples.Asking(field) });

    [Theory]
    [InlineData("bug.browser")]
    [InlineData("bug.Environment")]
    [InlineData("environment")]
    [InlineData("type")]
    [InlineData("")]
    [InlineData("feature.userNeed")]
    public void Rule4_unknown_path_for_a_bug_fails(string field) =>
        AssertSingleError(TicketSamples.Bug() with { MissingInformation = TicketSamples.Asking(field) }, "missingInformation[0].field");

    [Fact]
    public void Rule4_bug_path_on_a_feature_fails() =>
        AssertSingleError(TicketSamples.Feature() with { MissingInformation = TicketSamples.Asking("bug.environment") }, "missingInformation[0].field");

    // Rule 5: no empty list items.

    [Theory]
    [InlineData("")]
    [InlineData("  \t ")]
    public void Rule5_blank_step_fails(string item)
    {
        var bug = TicketSamples.Bug();
        var ticket = bug with { Bug = bug.Bug! with { StepsToReproduce = ["Open an invoice", item] } };

        AssertSingleError(ticket, "bug.stepsToReproduce[1]");
    }

    [Theory]
    [InlineData("")]
    [InlineData("  \t ")]
    public void Rule5_blank_acceptance_criterion_fails(string item)
    {
        var feature = TicketSamples.Feature();
        var ticket = feature with { Feature = feature.Feature! with { AcceptanceCriteria = [item] } };

        AssertSingleError(ticket, "feature.acceptanceCriteria[0]");
    }

    [Theory]
    [InlineData("")]
    [InlineData("  \t ")]
    public void Rule5_blank_question_fails(string question) =>
        AssertSingleError(TicketSamples.Bug() with { MissingInformation = [new MissingInformation(null, question)] }, "missingInformation[0].question");

    [Fact]
    public void Rule5_not_provided_as_a_step_fails()
    {
        var bug = TicketSamples.Bug();
        var ticket = bug with { Bug = bug.Bug! with { StepsToReproduce = ["Open an invoice", NotProvided] } };

        AssertSingleError(ticket, "bug.stepsToReproduce[1]");
    }

    [Fact]
    public void Rule5_not_provided_as_an_acceptance_criterion_fails_even_with_an_entry()
    {
        var feature = TicketSamples.Feature();
        var ticket = feature with
        {
            Feature = feature.Feature! with { AcceptanceCriteria = [NotProvided] },
            MissingInformation = TicketSamples.Asking("feature.acceptanceCriteria"),
        };

        AssertSingleError(ticket, "feature.acceptanceCriteria[0]");
    }

    [Fact]
    public void Rule5_not_provided_as_a_question_fails() =>
        AssertSingleError(TicketSamples.Bug() with { MissingInformation = [new MissingInformation(null, NotProvided)] }, "missingInformation[0].question");

    [Fact]
    public void Rule5_item_that_only_mentions_not_provided_passes()
    {
        var bug = TicketSamples.Bug();

        AssertValid(bug with { Bug = bug.Bug! with { StepsToReproduce = ["Check that the label says Not provided"] } });
    }

    [Fact]
    public void Rule5_null_list_items_from_json_are_reported_not_thrown()
    {
        const string json = """
            {
              "type": "Bug",
              "title": "t",
              "description": "d",
              "bug": { "stepsToReproduce": [null], "actualResult": "a", "expectedResult": "e", "environment": "Not provided" },
              "feature": null,
              "missingInformation": [null]
            }
            """;
        var ticket = JsonSerializer.Deserialize<Ticket>(json, TicketJson.Options)!;

        var errors = TicketValidator.Validate(ticket);

        Assert.Equal(3, errors.Count);
        Assert.Contains(errors, error => error.Contains("bug.environment"));
        Assert.Contains(errors, error => error.Contains("bug.stepsToReproduce[0]"));
        Assert.Contains(errors, error => error.Contains("missingInformation[0]"));
    }

    [Fact]
    public void Rule5_non_blank_items_pass()
    {
        var bug = TicketSamples.Bug();
        AssertValid(bug with
        {
            Bug = bug.Bug! with { StepsToReproduce = ["One", "Two"] },
            MissingInformation = [new MissingInformation(null, "Is there a workaround?")],
        });
    }

    [Fact]
    public void All_broken_rules_are_reported_together()
    {
        var bug = TicketSamples.Bug();
        var ticket = bug with
        {
            Title = "",
            Feature = TicketSamples.Feature().Feature,
            Bug = bug.Bug! with { StepsToReproduce = [" "], Environment = NotProvided },
            MissingInformation = TicketSamples.Asking("nonsense"),
        };

        Assert.Equal(5, TicketValidator.Validate(ticket).Count);
    }

    private static Ticket WithGap(string field)
    {
        var bug = TicketSamples.Bug();
        var feature = TicketSamples.Feature();

        return field switch
        {
            "bug.stepsToReproduce" => bug with { Bug = bug.Bug! with { StepsToReproduce = [] } },
            "feature.acceptanceCriteria" => feature with { Feature = feature.Feature! with { AcceptanceCriteria = [] } },
            _ => WithDetailString(field, NotProvided),
        };
    }

    private static Ticket WithDetailString(string field, string value)
    {
        var bug = TicketSamples.Bug();
        var feature = TicketSamples.Feature();

        return field switch
        {
            "bug.actualResult" => bug with { Bug = bug.Bug! with { ActualResult = value } },
            "bug.expectedResult" => bug with { Bug = bug.Bug! with { ExpectedResult = value } },
            "bug.environment" => bug with { Bug = bug.Bug! with { Environment = value } },
            "feature.userNeed" => feature with { Feature = feature.Feature! with { UserNeed = value } },
            "feature.proposedBehavior" => feature with { Feature = feature.Feature! with { ProposedBehavior = value } },
            _ => throw new ArgumentOutOfRangeException(nameof(field), field, null),
        };
    }
}
