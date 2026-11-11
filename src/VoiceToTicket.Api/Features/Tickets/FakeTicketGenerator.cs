using System.Text.RegularExpressions;
using VoiceToTicket.Api.Features.Tickets.Contract;

namespace VoiceToTicket.Api.Features.Tickets;

/// <summary>
/// A deterministic stand-in for the real generator (plan 4.6), for tests and for development without an API key.
/// Every ticket it returns passes <see cref="TicketValidator"/>, whatever the transcript contains.
/// </summary>
public sealed partial class FakeTicketGenerator(TimeProvider timeProvider) : ITicketGenerator
{
    public const string ModelName = "fake";

    private const string FallbackTitle = "Report without a usable title";
    private const string FallbackDescription = "The transcript has no usable description.";

    public Task<GenerationResult> GenerateAsync(string transcript, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var start = timeProvider.GetTimestamp();

        var trimmed = transcript.Trim();
        var title = TitleFrom(trimmed);
        var description = HasContent(trimmed) ? trimmed : FallbackDescription;
        var ticket = BugWords().IsMatch(transcript) ? Bug(title, description) : Feature(title, description);

        var durationMs = (long)timeProvider.GetElapsedTime(start).TotalMilliseconds;
        return Task.FromResult(new GenerationResult(ticket, TicketGeneratorOptions.FakeProvider, ModelName, durationMs, Usage: null, Attempts: 1, FirstAttemptValid: true));
    }

    private static Ticket Bug(string title, string description) => new(
        TicketType.Bug,
        title,
        description,
        new BugDetails([], TicketFields.NotProvided, TicketFields.NotProvided, TicketFields.NotProvided),
        Feature: null,
        [
            new MissingInformation(TicketFields.BugStepsToReproduce, "What are the steps to reproduce the problem?"),
            new MissingInformation(TicketFields.BugActualResult, "What actually happens?"),
            new MissingInformation(TicketFields.BugExpectedResult, "What should happen instead?"),
            new MissingInformation(TicketFields.BugEnvironment, "Which environment or platform is this on?"),
        ]);

    private static Ticket Feature(string title, string description) => new(
        TicketType.Feature,
        title,
        description,
        Bug: null,
        new FeatureDetails(TicketFields.NotProvided, TicketFields.NotProvided, []),
        [
            new MissingInformation(TicketFields.FeatureUserNeed, "Who needs this, and why?"),
            new MissingInformation(TicketFields.FeatureProposedBehavior, "How should it behave?"),
            new MissingInformation(TicketFields.FeatureAcceptanceCriteria, "How will we know it is done?"),
        ]);

    private static string TitleFrom(string trimmedTranscript)
    {
        var sentence = FirstSentence(trimmedTranscript).TrimEnd('.', '!', '?', ' ');
        var title = Truncate(sentence);
        return HasContent(title) ? title : FallbackTitle;
    }

    // A sentence ends at a line break, or at . ! ? followed by whitespace or the end, so "Version 1.2" stays whole.
    private static string FirstSentence(string text)
    {
        for (var i = 0; i < text.Length; i++)
        {
            var endsLine = text[i] is '\r' or '\n';
            var endsSentence = text[i] is '.' or '!' or '?' && (i + 1 == text.Length || char.IsWhiteSpace(text[i + 1]));
            if (endsLine)
            {
                return text[..i];
            }

            if (endsSentence)
            {
                return text[..(i + 1)];
            }
        }

        return text;
    }

    private static string Truncate(string text)
    {
        if (text.Length <= TicketValidator.MaxTitleLength)
        {
            return text;
        }

        var length = char.IsHighSurrogate(text[TicketValidator.MaxTitleLength - 1])
            ? TicketValidator.MaxTitleLength - 1
            : TicketValidator.MaxTitleLength;
        return text[..length].TrimEnd();
    }

    private static bool HasContent(string value) =>
        !string.IsNullOrWhiteSpace(value) && value != TicketFields.NotProvided;

    [GeneratedRegex(@"\b(bugs?|errors?|crash(es|ed|ing)?|broken)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex BugWords();
}
