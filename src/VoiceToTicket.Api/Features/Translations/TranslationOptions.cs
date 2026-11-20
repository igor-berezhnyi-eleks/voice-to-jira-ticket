using Microsoft.Extensions.Options;
using VoiceToTicket.Api.Features.Tickets.Claude;

namespace VoiceToTicket.Api.Features.Translations;

/// <summary>
/// Which translator runs and how it calls Claude (language plan section 6, decision D20). The key and the client
/// timeout come from the <c>Claude</c> section, which the translator shares with the ticket generator.
/// </summary>
public sealed class TranslationOptions
{
    public const string SectionName = "Translation";
    public const string FakeProvider = "Fake";
    public const string ClaudeProvider = "Claude";
    public const string InvalidProviderMessage = $"{SectionName}:{nameof(Provider)} must be '{FakeProvider}' or '{ClaudeProvider}'.";

    /// <summary>No default: like the ticket generator, the provider is always stated in configuration.</summary>
    public string Provider { get; set; } = "";

    public string Model { get; set; } = "claude-haiku-5-5";

    public string Effort { get; set; } = "low";

    public int MaxTokens { get; set; } = 16_000;

    public int TimeoutSeconds { get; set; } = 60;

    public bool HasKnownProvider() => Provider is FakeProvider or ClaudeProvider;

    public bool UsesClaude() => Provider == ClaudeProvider;

    /// <summary>Problems with the Claude settings. The messages name settings only and never contain the key.</summary>
    public IReadOnlyList<string> ClaudeProblems(ClaudeOptions claude)
    {
        var problems = new List<string>();
        if (string.IsNullOrWhiteSpace(claude.ApiKey))
        {
            problems.Add($"{ClaudeOptions.SectionName}:{nameof(ClaudeOptions.ApiKey)} is required when {SectionName}:{nameof(Provider)} is '{ClaudeProvider}' "
                + $"(user-secrets key '{ClaudeOptions.SectionName}:{nameof(ClaudeOptions.ApiKey)}', or environment variable '{ClaudeOptions.SectionName}__{nameof(ClaudeOptions.ApiKey)}').");
        }

        if (string.IsNullOrWhiteSpace(Model))
        {
            problems.Add($"{SectionName}:{nameof(Model)} must not be empty.");
        }

        if (!ClaudeOptions.KnownEfforts.Contains(Effort))
        {
            problems.Add($"{SectionName}:{nameof(Effort)} must be one of {string.Join(", ", ClaudeOptions.KnownEfforts)}.");
        }

        if (MaxTokens <= 0)
        {
            problems.Add($"{SectionName}:{nameof(MaxTokens)} must be positive.");
        }

        if (TimeoutSeconds <= 0)
        {
            problems.Add($"{SectionName}:{nameof(TimeoutSeconds)} must be positive.");
        }
        else if (TimeoutSeconds > claude.TimeoutSeconds)
        {
            // The SDK client is built once from Claude:TimeoutSeconds (plus a margin); a longer translation deadline could never be reached.
            problems.Add($"{SectionName}:{nameof(TimeoutSeconds)} must not be longer than {ClaudeOptions.SectionName}:{nameof(ClaudeOptions.TimeoutSeconds)}.");
        }

        return problems;
    }
}

/// <summary>Checks the provider always, and the Claude settings only when Claude is the provider.</summary>
public sealed class TranslationOptionsValidator(IOptions<ClaudeOptions> claude) : IValidateOptions<TranslationOptions>
{
    public ValidateOptionsResult Validate(string? name, TranslationOptions options)
    {
        if (!options.HasKnownProvider())
        {
            return ValidateOptionsResult.Fail(TranslationOptions.InvalidProviderMessage);
        }

        if (!options.UsesClaude())
        {
            return ValidateOptionsResult.Success;
        }

        var problems = options.ClaudeProblems(claude.Value);
        return problems.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(problems);
    }
}
