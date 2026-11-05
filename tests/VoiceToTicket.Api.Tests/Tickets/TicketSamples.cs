using VoiceToTicket.Api.Features.Tickets.Contract;

namespace VoiceToTicket.Api.Tests.Tickets;

/// <summary>Valid tickets for tests to start from; a test changes only what it is about.</summary>
internal static class TicketSamples
{
    public const string PlanBugExampleJson = """
        {
          "type": "Bug",
          "title": "Saving an invoice with an empty date crashes the editor",
          "description": "Saving an invoice whose date field is empty closes the editor and loses unsaved changes.",
          "bug": {
            "stepsToReproduce": ["Open an existing invoice", "Clear the date field", "Click Save"],
            "actualResult": "The editor closes and unsaved changes are lost.",
            "expectedResult": "Not provided",
            "environment": "Not provided"
          },
          "feature": null,
          "missingInformation": [
            { "field": "bug.expectedResult", "question": "What should happen when the date is empty: a validation message, or saving without a date?" },
            { "field": "bug.environment", "question": "Which browser and application version?" }
          ]
        }
        """;

    public const string FeatureExampleJson = """
        {
          "type": "Feature",
          "title": "Export the invoice list as CSV",
          "description": "Accountants want to download the filtered invoice list as a CSV file.",
          "bug": null,
          "feature": {
            "userNeed": "Accountants reconcile invoices in a spreadsheet.",
            "proposedBehavior": "An Export button downloads the current list as CSV.",
            "acceptanceCriteria": ["The file contains only the rows that match the current filter"]
          },
          "missingInformation": [
            { "field": null, "question": "Is this also needed for archived invoices?" }
          ]
        }
        """;

    public static Ticket Bug() => new(
        TicketType.Bug,
        "Saving an invoice crashes the editor",
        "The editor closes when an invoice is saved.",
        new BugDetails(["Open an invoice", "Click Save"], "The editor closes.", "The invoice is saved.", "Chrome 120"),
        null,
        []);

    public static Ticket Feature() => new(
        TicketType.Feature,
        "Export the invoice list as CSV",
        "Accountants want to download the invoice list.",
        null,
        new FeatureDetails("Reconcile invoices in a spreadsheet.", "An Export button downloads a CSV.", ["The file has one row per invoice"]),
        []);

    public static IReadOnlyList<MissingInformation> Asking(params string?[] fields) =>
        fields.Select(field => new MissingInformation(field, "Can you give more detail?")).ToList();
}
