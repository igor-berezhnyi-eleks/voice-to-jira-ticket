using VoiceToTicket.Api.Features.Tickets.Contract;

namespace VoiceToTicket.Api.Features.Tickets;

/// <summary>
/// The semantic rules of a generated ticket (plan 4.3) that a JSON schema cannot express.
/// Error texts name fields only and never quote values, because the values come from the transcript.
/// </summary>
public static class TicketValidator
{
    public const int MaxTitleLength = 120;

    /// <returns>All broken rules; empty when the ticket is valid.</returns>
    public static IReadOnlyList<string> Validate(Ticket ticket)
    {
        var errors = new List<string>();

        CheckDetailsMatchType(ticket, errors);
        CheckTitleAndDescription(ticket, errors);
        CheckGapsAreDeclared(ticket, errors);
        CheckFieldPaths(ticket, errors);
        CheckListItems(ticket, errors);

        return errors;
    }

    // Rule 1
    private static void CheckDetailsMatchType(Ticket ticket, List<string> errors)
    {
        switch (ticket.Type)
        {
            case TicketType.Bug:
                if (ticket.Bug is null)
                {
                    errors.Add("A Bug ticket must have bug details.");
                }

                if (ticket.Feature is not null)
                {
                    errors.Add("A Bug ticket must not have feature details.");
                }

                break;

            case TicketType.Feature:
                if (ticket.Feature is null)
                {
                    errors.Add("A Feature ticket must have feature details.");
                }

                if (ticket.Bug is not null)
                {
                    errors.Add("A Feature ticket must not have bug details.");
                }

                break;

            default:
                errors.Add("The ticket type is not Bug or Feature.");
                break;
        }
    }

    // Rule 2
    private static void CheckTitleAndDescription(Ticket ticket, List<string> errors)
    {
        CheckHasContent(TicketFields.Title, ticket.Title, errors);
        CheckHasContent(TicketFields.Description, ticket.Description, errors);

        if (ticket.Title.Length > MaxTitleLength)
        {
            errors.Add($"{TicketFields.Title} is longer than {MaxTitleLength} characters.");
        }
    }

    private static void CheckHasContent(string field, string value, List<string> errors)
    {
        if (string.IsNullOrWhiteSpace(value) || value == TicketFields.NotProvided)
        {
            errors.Add($"{field} must have content and must not be \"{TicketFields.NotProvided}\".");
        }
    }

    // Rule 3, plus (human decision at the T1.2 gate) a blank detail string is an error: a gap is exactly "Not provided".
    private static void CheckGapsAreDeclared(Ticket ticket, List<string> errors)
    {
        var (strings, lists) = DetailsOf(ticket);

        foreach (var (field, value) in strings)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                errors.Add($"{field} is blank; a field without information must be \"{TicketFields.NotProvided}\".");
            }
        }

        var gaps = strings.Where(entry => entry.Value == TicketFields.NotProvided).Select(entry => entry.Field)
            .Concat(lists.Where(entry => entry.Items.Count == 0).Select(entry => entry.Field));

        foreach (var field in gaps)
        {
            if (!ticket.MissingInformation.Any(entry => entry?.Field == field))
            {
                errors.Add($"{field} has no information but no missingInformation entry names it.");
            }
        }
    }

    // Rule 4
    private static void CheckFieldPaths(Ticket ticket, List<string> errors)
    {
        var known = TicketFields.For(ticket.Type);

        for (var i = 0; i < ticket.MissingInformation.Count; i++)
        {
            var field = ticket.MissingInformation[i]?.Field;
            if (field is not null && !known.Contains(field, StringComparer.Ordinal))
            {
                errors.Add($"missingInformation[{i}].field is not a known field path of a {ticket.Type} ticket.");
            }
        }
    }

    // Rule 5. A missing-information entry is a list item too; its text is the question.
    // JSON can still put null in a list (see TicketJson.Options), so null counts as empty here.
    // Human decision at the T1.2 gate: the gap marker is not content either; a list with no support is [].
    private static void CheckListItems(Ticket ticket, List<string> errors)
    {
        foreach (var (field, items) in DetailsOf(ticket).Lists)
        {
            for (var i = 0; i < items.Count; i++)
            {
                if (HasNoContent(items[i]))
                {
                    errors.Add($"{field}[{i}] is empty or \"{TicketFields.NotProvided}\".");
                }
            }
        }

        for (var i = 0; i < ticket.MissingInformation.Count; i++)
        {
            if (HasNoContent(ticket.MissingInformation[i]?.Question))
            {
                errors.Add($"missingInformation[{i}].question is empty or \"{TicketFields.NotProvided}\".");
            }
        }
    }

    private static bool HasNoContent(string? value) =>
        string.IsNullOrWhiteSpace(value) || value == TicketFields.NotProvided;

    // The fields of the section that belongs to the ticket's type. A section of the wrong type is rule 1's error.
    private static (List<(string Field, string Value)> Strings, List<(string Field, IReadOnlyList<string> Items)> Lists) DetailsOf(Ticket ticket)
    {
        if (ticket is { Type: TicketType.Bug, Bug: { } bug })
        {
            return (
                [
                    (TicketFields.BugActualResult, bug.ActualResult),
                    (TicketFields.BugExpectedResult, bug.ExpectedResult),
                    (TicketFields.BugEnvironment, bug.Environment),
                ],
                [(TicketFields.BugStepsToReproduce, bug.StepsToReproduce)]);
        }

        if (ticket is { Type: TicketType.Feature, Feature: { } feature })
        {
            return (
                [
                    (TicketFields.FeatureUserNeed, feature.UserNeed),
                    (TicketFields.FeatureProposedBehavior, feature.ProposedBehavior),
                ],
                [(TicketFields.FeatureAcceptanceCriteria, feature.AcceptanceCriteria)]);
        }

        return ([], []);
    }
}
