using System.Text.Json;
using VoiceToTicket.Api.Features.Tickets;
using VoiceToTicket.Api.Features.Tickets.Contract;

namespace VoiceToTicket.Api.Tests.Tickets;

/// <summary>Plan 4.6: the fake is deterministic and only returns tickets that pass <see cref="TicketValidator"/>.</summary>
public sealed class FakeTicketGeneratorTests
{
    private static readonly FakeTicketGenerator Generator = new(TimeProvider.System);

    [Theory]
    [InlineData("The editor shows a bug when saving.")]
    [InlineData("We get an ERROR on the invoice page.")]
    [InlineData("The app crashes on startup every time.")]
    [InlineData("The export button is broken for everyone.")]
    public async Task Bug_words_make_a_bug(string transcript)
    {
        var ticket = await GenerateAsync(transcript);

        Assert.Equal(TicketType.Bug, ticket.Type);
        Assert.NotNull(ticket.Bug);
        Assert.Null(ticket.Feature);
    }

    [Theory]
    [InlineData("The app crashes on startup every time.", TicketType.Feature)]
    [InlineData("Please add a dark mode to the settings page.", TicketType.Bug)]
    [InlineData("The app crashes on startup every time.", TicketType.Bug)]
    [InlineData("Please add a dark mode to the settings page.", TicketType.Feature)]
    public async Task A_requested_type_overrides_the_word_guess_and_the_ticket_stays_valid(string transcript, TicketType requested)
    {
        var result = await Generator.GenerateAsync(transcript, TestContext.Current.CancellationToken, requested);

        Assert.Equal(requested, result.Ticket.Type);
        Assert.Empty(TicketValidator.Validate(result.Ticket));
        Assert.Equal(requested == TicketType.Bug, result.Ticket.Bug is not null);
        Assert.Equal(requested == TicketType.Feature, result.Ticket.Feature is not null);
    }

    [Theory]
    [InlineData("Please add a dark mode to the settings page.")]
    [InlineData("The new debugger view should list every terror alert.")]
    public async Task Anything_else_makes_a_feature(string transcript)
    {
        var ticket = await GenerateAsync(transcript);

        Assert.Equal(TicketType.Feature, ticket.Type);
        Assert.NotNull(ticket.Feature);
        Assert.Null(ticket.Bug);
    }

    [Theory]
    [InlineData("Version 1.2 is broken. Please fix it soon.", "Version 1.2 is broken")]
    [InlineData("Is this a crash? It looks like one to me.", "Is this a crash")]
    [InlineData("  Add a dark mode please\nto the settings page", "Add a dark mode please")]
    [InlineData("Add a dark mode to the settings page", "Add a dark mode to the settings page")]
    public async Task Title_is_the_first_sentence(string transcript, string title)
    {
        var ticket = await GenerateAsync(transcript);

        Assert.Equal(title, ticket.Title);
    }

    [Fact]
    public async Task Long_title_is_truncated_to_the_limit()
    {
        var ticket = await GenerateAsync(new string('a', 500));

        Assert.Equal(new string('a', TicketValidator.MaxTitleLength), ticket.Title);
    }

    [Fact]
    public async Task Truncation_does_not_split_a_surrogate_pair()
    {
        var transcript = new string('a', TicketValidator.MaxTitleLength - 1) + "😀 and some more words";

        var ticket = await GenerateAsync(transcript);

        Assert.Equal(new string('a', TicketValidator.MaxTitleLength - 1), ticket.Title);
    }

    [Fact]
    public async Task Bug_detail_fields_are_gaps_with_questions()
    {
        var ticket = await GenerateAsync("The app crashes when I save an invoice.");

        Assert.Empty(ticket.Bug!.StepsToReproduce);
        Assert.Equal(TicketFields.NotProvided, ticket.Bug.ActualResult);
        Assert.Equal(TicketFields.NotProvided, ticket.Bug.ExpectedResult);
        Assert.Equal(TicketFields.NotProvided, ticket.Bug.Environment);
        Assert.Equal(
            [TicketFields.BugStepsToReproduce, TicketFields.BugActualResult, TicketFields.BugExpectedResult, TicketFields.BugEnvironment],
            ticket.MissingInformation.Select(entry => entry.Field));
    }

    [Fact]
    public async Task Feature_detail_fields_are_gaps_with_questions()
    {
        var ticket = await GenerateAsync("Please add a dark mode to the settings page.");

        Assert.Equal(TicketFields.NotProvided, ticket.Feature!.UserNeed);
        Assert.Equal(TicketFields.NotProvided, ticket.Feature.ProposedBehavior);
        Assert.Empty(ticket.Feature.AcceptanceCriteria);
        Assert.Equal(
            [TicketFields.FeatureUserNeed, TicketFields.FeatureProposedBehavior, TicketFields.FeatureAcceptanceCriteria],
            ticket.MissingInformation.Select(entry => entry.Field));
    }

    [Theory]
    [InlineData("The app crashes when I save an invoice. It happens every day.")]
    [InlineData("Please add a dark mode to the settings page.")]
    [InlineData("....................")]
    [InlineData("!!! ??? ... !!! ??? ...")]
    [InlineData("      Not provided      ")]
    [InlineData("Not provided. And then some more text.")]
    [InlineData("\n\n\n\n\n\n\n\n\n\nx\n\n\n\n\n\n\n\n\n\n")]
    public async Task Every_ticket_passes_the_validator(string transcript)
    {
        var ticket = await GenerateAsync(transcript);

        Assert.Empty(TicketValidator.Validate(ticket));
    }

    [Theory]
    [InlineData("The app crashes when I save an invoice.")]
    [InlineData("Please add a dark mode to the settings page.")]
    public async Task Same_transcript_gives_the_same_ticket(string transcript)
    {
        var first = await GenerateAsync(transcript);
        var second = await GenerateAsync(transcript);

        Assert.Equal(JsonSerializer.Serialize(first, TicketJson.Options), JsonSerializer.Serialize(second, TicketJson.Options));
    }

    [Fact]
    public async Task Result_names_the_fake_and_has_no_usage()
    {
        var result = await Generator.GenerateAsync("Please add a dark mode to the settings page.", TestContext.Current.CancellationToken);

        Assert.Equal("Fake", result.Provider);
        Assert.Equal("fake", result.Model);
        Assert.Null(result.Usage);
    }

    [Fact]
    public async Task Duration_comes_from_the_injected_time_provider()
    {
        var generator = new FakeTicketGenerator(new SteppingTimeProvider(TimeSpan.FromMilliseconds(250)));

        var result = await generator.GenerateAsync("Please add a dark mode to the settings page.", TestContext.Current.CancellationToken);

        Assert.Equal(250, result.DurationMs);
    }

    private static async Task<Ticket> GenerateAsync(string transcript) =>
        (await Generator.GenerateAsync(transcript, TestContext.Current.CancellationToken)).Ticket;
}

/// <summary>A clock that moves forward by a fixed step every time it is read.</summary>
internal sealed class SteppingTimeProvider(TimeSpan step) : TimeProvider
{
    private long _timestamp;

    public override long TimestampFrequency => TimeSpan.TicksPerSecond;

    public override long GetTimestamp() => Interlocked.Add(ref _timestamp, step.Ticks);
}
