using System.ComponentModel.DataAnnotations;

namespace VoiceToJira.Api.Features.Tickets;

public sealed class ClaudeOptions
{
    public const string SectionName = "Claude";

    // Not required at start-up: the app (recording, transcription) is usable without a key.
    // Ticket generation reports a missing key when it is called.
    public string ApiKey { get; set; } = string.Empty;

    [Required]
    public string Model { get; set; } = string.Empty;

    [Required]
    public string Effort { get; set; } = string.Empty;

    [Range(256, 64_000)]
    public int MaxTokens { get; set; }

    // Per attempt; the SDK retries transient failures (429, 5xx, connection errors) MaxRetries times.
    [Range(5, 300)]
    public int TimeoutSeconds { get; set; } = 60;

    [Range(0, 5)]
    public int MaxRetries { get; set; } = 2;
}
