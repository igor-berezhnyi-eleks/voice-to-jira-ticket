using System.Text.Json;
using System.Text.Json.Nodes;
using VoiceToTicket.Api.Features.Tickets.Contract;

namespace VoiceToTicket.Evaluation;

/// <param name="Fields">Contract field paths where the text was found; question hits are reported as <c>missingInformation</c>.</param>
/// <param name="OnlyInQuestions">True when every hit is inside a missing-information question, which may merely mention the term.</param>
public sealed record TrapHit(string Text, string Reason, IReadOnlyList<string> Fields, bool OnlyInQuestions);

/// <summary>The automatic checks of plan 7.2 that need only a ticket and its scenario.</summary>
public static class TicketChecks
{
    public const string QuestionsPath = "missingInformation";

    /// <summary>Case-insensitive search of every text in the ticket JSON for each trap (plan 7.1).</summary>
    public static IReadOnlyList<TrapHit> FindTrapHits(Ticket ticket, IReadOnlyList<Trap> traps)
    {
        var texts = Texts(JsonSerializer.SerializeToNode(ticket, TicketJson.Options)!, "").ToList();
        var hits = new List<TrapHit>();
        foreach (var trap in traps)
        {
            var fields = texts
                .Where(entry => entry.Text.Contains(trap.Text, StringComparison.OrdinalIgnoreCase))
                .Select(entry => entry.Path)
                .Distinct()
                .ToList();
            if (fields.Count > 0)
            {
                hits.Add(new TrapHit(trap.Text, trap.Reason, fields, fields.All(field => field == QuestionsPath)));
            }
        }

        return hits;
    }

    /// <returns>Null when the scenario does not count for type accuracy.</returns>
    public static bool? TypeMatches(Scenario scenario, TicketType actual) =>
        scenario.CountsForTypeAccuracy ? string.Equals(scenario.ExpectedType, actual.ToString(), StringComparison.Ordinal) : null;

    private static IEnumerable<(string Path, string Text)> Texts(JsonNode? node, string path)
    {
        switch (node)
        {
            case JsonValue value when value.TryGetValue<string>(out var text):
                yield return (path, text);
                break;
            case JsonObject obj:
                foreach (var property in obj)
                {
                    foreach (var entry in Texts(property.Value, path.Length == 0 ? property.Key : path + "." + property.Key))
                    {
                        yield return entry;
                    }
                }

                break;
            case JsonArray array:
                foreach (var item in array)
                {
                    foreach (var entry in Texts(item, path))
                    {
                        if (path != QuestionsPath)
                        {
                            yield return entry;
                        }
                        else if (entry.Path == QuestionsPath + ".question")
                        {
                            // Only the question text is searched; the field path is a contract value, not model prose.
                            yield return (QuestionsPath, entry.Text);
                        }
                    }
                }

                break;
        }
    }
}
