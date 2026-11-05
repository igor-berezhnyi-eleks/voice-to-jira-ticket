namespace VoiceToJira.Api.Features.Tickets;

public sealed record TicketValidationResult(Ticket? Ticket, IReadOnlyList<string> Errors)
{
    public bool IsValid => Errors.Count == 0;
}

// Checks the model output against the contract, flattens and trims it, and derives MissingInformation
// from the empty optional fields (and Acceptance criteria, which is required but may come back empty).
public static class TicketValidator
{
    public static TicketValidationResult Validate(ClaudeTicketOutput raw)
    {
        List<string> errors = [];

        switch (raw.Type)
        {
            case TicketType.Bug when raw.Bug is null:
                errors.Add("Type is Bug but the bug object is missing.");
                break;
            case TicketType.Bug when raw.Feature is not null:
                errors.Add("Type is Bug but a feature object is also set.");
                break;
            case TicketType.Feature when raw.Feature is null:
                errors.Add("Type is Feature but the feature object is missing.");
                break;
            case TicketType.Feature when raw.Bug is not null:
                errors.Add("Type is Feature but a bug object is also set.");
                break;
        }

        if (errors.Count > 0)
        {
            return new TicketValidationResult(null, errors);
        }

        Ticket ticket = raw.Type == TicketType.Bug ? Normalize(raw.Bug!) : Normalize(raw.Feature!);

        if (ticket.Title.Length == 0)
        {
            errors.Add("Title is empty.");
        }

        if (ticket.Description.Length == 0)
        {
            errors.Add("Description is empty.");
        }

        return errors.Count > 0 ? new TicketValidationResult(null, errors) : new TicketValidationResult(ticket, []);
    }

    private static BugTicket Normalize(BugTicket bug)
    {
        var t = bug with
        {
            Title = Clean(bug.Title),
            Description = Clean(bug.Description),
            StepsToReproduce = Clean(bug.StepsToReproduce),
            ActualResult = Clean(bug.ActualResult),
            ExpectedResult = Clean(bug.ExpectedResult),
            Environment = Clean(bug.Environment),
        };

        return t with
        {
            MissingInformation = Missing(
                ("stepsToReproduce", t.StepsToReproduce.Count == 0),
                ("actualResult", t.ActualResult.Length == 0),
                ("expectedResult", t.ExpectedResult.Length == 0),
                ("environment", t.Environment.Length == 0)),
        };
    }

    private static FeatureTicket Normalize(FeatureTicket feature)
    {
        var t = feature with
        {
            Title = Clean(feature.Title),
            Description = Clean(feature.Description),
            UserOrBusinessNeed = Clean(feature.UserOrBusinessNeed),
            AcceptanceCriteria = Clean(feature.AcceptanceCriteria),
        };

        return t with
        {
            MissingInformation = Missing(
                ("userOrBusinessNeed", t.UserOrBusinessNeed.Length == 0),
                ("acceptanceCriteria", t.AcceptanceCriteria.Count == 0)),
        };
    }

    private static string Clean(string? value) => value?.Trim() ?? string.Empty;

    private static string[] Clean(IReadOnlyList<string>? values) =>
        values?.Select(Clean).Where(v => v.Length > 0).ToArray() ?? [];

    private static string[] Missing(params (string Field, bool IsEmpty)[] fields) =>
        fields.Where(f => f.IsEmpty).Select(f => f.Field).ToArray();
}
