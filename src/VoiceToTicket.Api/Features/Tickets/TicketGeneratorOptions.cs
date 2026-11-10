namespace VoiceToTicket.Api.Features.Tickets;

/// <summary>Which generator runs (decision D9). There is no default: the provider is always stated in configuration.</summary>
public sealed class TicketGeneratorOptions
{
    public const string SectionName = "TicketGenerator";
    public const string FakeProvider = "Fake";
    public const string ClaudeProvider = "Claude";
    public const string InvalidProviderMessage = $"{SectionName}:{nameof(Provider)} must be '{FakeProvider}' or '{ClaudeProvider}'.";

    public string Provider { get; set; } = "";

    public bool HasKnownProvider() => Provider is FakeProvider or ClaudeProvider;

    public bool UsesClaude() => Provider == ClaudeProvider;
}
