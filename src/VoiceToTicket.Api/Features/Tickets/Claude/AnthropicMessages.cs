using System.Text.Json;
using System.Text.Json.Nodes;
using Anthropic;
using Anthropic.Models.Beta;
using Anthropic.Models.Beta.Messages;
using Microsoft.Extensions.Options;

namespace VoiceToTicket.Api.Features.Tickets.Claude;

/// <summary>The Anthropic SDK behind <see cref="IClaudeMessages"/>. Only the live test and the manual check exercise it.</summary>
public sealed class AnthropicMessages : IClaudeMessages
{
    private const string RefusalFallbackBeta = "server-side-fallback-2026-07-01";

    private readonly AnthropicClient _client;

    public AnthropicMessages(IOptions<ClaudeOptions> options)
    {
        var settings = options.Value;
        _client = new AnthropicClient
        {
            ApiKey = settings.ApiKey,
            // A little longer than the generator's own deadline, so that deadline decides and maps to llm_timeout.
            Timeout = TimeSpan.FromSeconds(settings.TimeoutSeconds + 5),
        };
    }

    public async Task<ClaudeReply> CreateAsync(ClaudeRequest request, CancellationToken cancellationToken)
    {
        var parameters = new MessageCreateParams
        {
            Model = request.Model,
            MaxTokens = request.MaxTokens,
            System = request.SystemPrompt,
            Messages = [new BetaUserMessageParam { Content = request.UserMessage }],
            Thinking = new BetaThinkingConfigAdaptive(),
            OutputConfig = new BetaOutputConfig
            {
                Effort = ToEffort(request.Effort),
                Format = new BetaJsonOutputFormat { Schema = ToSchema(request.Schema) },
            },
        };

        if (request.RefusalFallback)
        {
            parameters = parameters with
            {
                Betas = [RefusalFallbackBeta],
                Fallbacks = new BetaFallbacksParam(new Default()),
            };
        }

        var response = await _client.Beta.Messages.Create(parameters, cancellationToken);

        var text = response.Content
            .Select(block => block.TryPickText(out var textBlock) ? textBlock.Text : null)
            .FirstOrDefault(text => text is not null);

        return new ClaudeReply(text, response.StopReason?.Raw(), response.Usage.InputTokens, response.Usage.OutputTokens);
    }

    private static Effort ToEffort(string effort) => effort switch
    {
        "low" => Effort.Low,
        "medium" => Effort.Medium,
        "high" => Effort.High,
        "xhigh" => Effort.Xhigh,
        "max" => Effort.Max,
        _ => throw new ArgumentOutOfRangeException(nameof(effort), "Not a known effort level."),
    };

    private static Dictionary<string, JsonElement> ToSchema(JsonNode schema) =>
        schema.AsObject().ToDictionary(property => property.Key, property => JsonSerializer.SerializeToElement(property.Value));
}
