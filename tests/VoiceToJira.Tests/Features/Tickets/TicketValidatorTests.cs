using FluentAssertions;
using VoiceToJira.Api.Features.Tickets;

namespace VoiceToJira.Tests.Features.Tickets;

public sealed class TicketValidatorTests
{
    [Fact]
    public void Absent_bug_details_stay_empty_and_are_listed_as_missing()
    {
        var raw = new ClaudeTicketOutput
        {
            Type = TicketType.Bug,
            Bug = new BugTicket { Title = "Chart shows nothing", Description = "The chart is blank.", ActualResult = "Nothing is shown." },
        };

        var result = TicketValidator.Validate(raw);

        result.IsValid.Should().BeTrue();
        var bug = result.Ticket.Should().BeOfType<BugTicket>().Subject;
        bug.MissingInformation.Should().Equal("stepsToReproduce", "expectedResult", "environment");
        bug.Environment.Should().BeEmpty();
    }

    [Fact]
    public void Whitespace_values_and_blank_list_items_count_as_empty()
    {
        var raw = new ClaudeTicketOutput
        {
            Type = TicketType.Feature,
            Feature = new FeatureTicket
            {
                Title = "  Export notes  ",
                Description = "Users want to export notes.",
                UserOrBusinessNeed = "   ",
                AcceptanceCriteria = ["", "  "],
            },
        };

        var feature = TicketValidator.Validate(raw).Ticket.Should().BeOfType<FeatureTicket>().Subject;

        feature.Title.Should().Be("Export notes");
        feature.AcceptanceCriteria.Should().BeEmpty();
        feature.MissingInformation.Should().Equal("userOrBusinessNeed", "acceptanceCriteria");
    }

    [Fact]
    public void Fully_filled_ticket_has_no_missing_information()
    {
        var raw = new ClaudeTicketOutput
        {
            Type = TicketType.Feature,
            Feature = new FeatureTicket
            {
                Title = "Export notes",
                Description = "Users want to export notes.",
                UserOrBusinessNeed = "Support needs offline copies.",
                AcceptanceCriteria = ["Notes can be exported as CSV."],
            },
        };

        TicketValidator.Validate(raw).Ticket!.MissingInformation.Should().BeEmpty();
    }

    [Fact]
    public void Type_without_its_object_is_rejected()
    {
        var raw = new ClaudeTicketOutput { Type = TicketType.Bug, Feature = new FeatureTicket { Title = "x", Description = "y" } };

        var result = TicketValidator.Validate(raw);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle().Which.Should().Contain("bug object is missing");
    }

    [Fact]
    public void Both_objects_set_is_rejected()
    {
        var raw = new ClaudeTicketOutput
        {
            Type = TicketType.Feature,
            Bug = new BugTicket { Title = "x", Description = "y" },
            Feature = new FeatureTicket { Title = "x", Description = "y" },
        };

        TicketValidator.Validate(raw).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Empty_title_and_description_are_rejected()
    {
        var raw = new ClaudeTicketOutput { Type = TicketType.Bug, Bug = new BugTicket { Title = " ", Description = "" } };

        TicketValidator.Validate(raw).Errors.Should().Equal("Title is empty.", "Description is empty.");
    }
}
