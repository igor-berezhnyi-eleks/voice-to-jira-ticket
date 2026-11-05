using System.Text.Json;
using Anthropic;
using Anthropic.Exceptions;
using Anthropic.Models.Beta.Messages;
using Microsoft.Extensions.Options;

namespace VoiceToJira.Api.Features.Tickets;

public sealed class ClaudeTicketGenerator(
    IHttpClientFactory httpClientFactory,
    IOptions<ClaudeOptions> options,
    ILogger<ClaudeTicketGenerator> logger) : ITicketGenerator
{
    public const string HttpClientName = "Claude";

    // Server-side refusal fallback: a policy decline is re-served by the model's default fallback in the same call.
    private const string FallbackBeta = "server-side-fallback-2026-07-01";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<Ticket> GenerateAsync(string transcript, CancellationToken cancellationToken)
    {
        var settings = options.Value;
        if (string.IsNullOrWhiteSpace(settings.ApiKey))
        {
            throw new TicketGenerationException(TicketGenerationError.NotConfigured, "The Claude API key is not configured (Claude:ApiKey).");
        }

        var client = new AnthropicClient
        {
            ApiKey = settings.ApiKey,
            HttpClient = httpClientFactory.CreateClient(HttpClientName),
            Timeout = TimeSpan.FromSeconds(settings.TimeoutSeconds),
            MaxRetries = settings.MaxRetries,
        };

        var parameters = new MessageCreateParams
        {
            Model = settings.Model,
            MaxTokens = settings.MaxTokens,
            Betas = [FallbackBeta],
            Fallbacks = new Default(),
            System = TicketPrompt.System,
            OutputConfig = new BetaOutputConfig
            {
                Effort = Enum.Parse<Effort>(settings.Effort, ignoreCase: true),
                Format = new BetaJsonOutputFormat { Schema = TicketPrompt.Schema() },
            },
            Messages = [new BetaUserMessageParam { Content = TicketPrompt.UserMessage(transcript) }],
        };

        BetaMessage response;
        try
        {
            response = await client.Beta.Messages.Create(parameters, cancellationToken);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new TicketGenerationException(TicketGenerationError.Timeout, "Claude did not answer in time.");
        }
        catch (AnthropicUnauthorizedException ex)
        {
            throw new TicketGenerationException(TicketGenerationError.NotConfigured, "The Claude API key was rejected.", ex);
        }
        catch (AnthropicApiException ex)
        {
            logger.LogWarning(ex, "Claude API error (request {RequestId})", ex.RequestID);
            throw new TicketGenerationException(TicketGenerationError.Unavailable, "The Claude API returned an error.", ex);
        }
        catch (AnthropicIOException ex)
        {
            logger.LogWarning(ex, "Claude API not reachable");
            throw new TicketGenerationException(TicketGenerationError.Unavailable, "The Claude API could not be reached.", ex);
        }

        logger.LogInformation(
            "Claude answered: model {Model}, stop {StopReason}, input {InputTokens} / output {OutputTokens} tokens",
            response.Model, response.StopReason, response.Usage.InputTokens, response.Usage.OutputTokens);

        if (response.StopReason == "refusal")
        {
            throw new TicketGenerationException(TicketGenerationError.Refused, "Claude declined to process this transcript.");
        }

        if (response.StopReason == "max_tokens")
        {
            throw new TicketGenerationException(TicketGenerationError.Truncated, "Claude's answer was cut off (Claude:MaxTokens too low).");
        }

        var json = string.Concat(response.Content.Select(b => b.TryPickText(out var text) ? text.Text : string.Empty));

        ClaudeTicketOutput? raw;
        try
        {
            raw = JsonSerializer.Deserialize<ClaudeTicketOutput>(json, JsonOptions);
        }
        catch (JsonException ex)
        {
            throw new TicketGenerationException(TicketGenerationError.InvalidOutput, "Claude returned malformed JSON.", ex);
        }

        if (raw is null)
        {
            throw new TicketGenerationException(TicketGenerationError.InvalidOutput, "Claude returned no ticket.");
        }

        var result = TicketValidator.Validate(raw);
        if (!result.IsValid)
        {
            logger.LogWarning("Claude output failed validation: {Errors}", string.Join(" ", result.Errors));
            throw new TicketGenerationException(TicketGenerationError.InvalidOutput, "Claude's ticket does not match the contract: " + string.Join(" ", result.Errors));
        }

        return result.Ticket!;
    }
}
