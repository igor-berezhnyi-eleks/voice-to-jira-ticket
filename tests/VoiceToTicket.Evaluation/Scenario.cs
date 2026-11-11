namespace VoiceToTicket.Evaluation;

/// <summary>One frozen evaluation scenario (plan 7.1), read from <c>eval/scenarios/&lt;id&gt;.json</c>.</summary>
public sealed record Scenario(
    string Id,
    string Category,
    string Script,
    string ExpectedType,
    IReadOnlyList<string> Facts,
    IReadOnlyList<string> ExpectedMissing,
    IReadOnlyList<Trap> Traps)
{
    /// <summary>Type accuracy counts only the clear scenarios (plan 7.5); ambiguous and mixed ones have a type by convention.</summary>
    public bool CountsForTypeAccuracy => Category is "bug" or "feature";
}

public sealed record Trap(string Text, string Reason);
