using System.Text.Json.Nodes;

namespace VoiceToTicket.Api.Features.Tickets.Claude;

/// <summary>
/// The one Messages call the generator makes, with only the values it chooses. The seam lets tests check the request
/// and the error mapping without a network; the SDK translation lives in <see cref="AnthropicMessages"/>.
/// </summary>
public interface IClaudeMessages
{
    Task<ClaudeReply> CreateAsync(ClaudeRequest request, CancellationToken cancellationToken);
}

/// <param name="Schema">The exported ticket schema (structured output).</param>
/// <param name="RefusalFallback">Ask the API to re-serve a policy refusal with a fallback model (decision D7).</param>
public sealed record ClaudeRequest(
    string Model,
    string SystemPrompt,
    string UserMessage,
    JsonNode Schema,
    string Effort,
    int MaxTokens,
    bool RefusalFallback);

/// <param name="Text">The first text block, or null when the response has none.</param>
/// <param name="StopReason">The API's stop reason in snake case (<c>end_turn</c>, <c>refusal</c>, <c>max_tokens</c>), or null.</param>
public sealed record ClaudeReply(
    string? Text,
    string? StopReason,
    long InputTokens,
    long OutputTokens);
