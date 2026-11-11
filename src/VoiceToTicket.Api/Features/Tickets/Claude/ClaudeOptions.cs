using Microsoft.Extensions.Options;

namespace VoiceToTicket.Api.Features.Tickets.Claude;

/// <summary>How to call Claude (plan 4.6). The key comes from user-secrets or the environment, never from a tracked file.</summary>
public sealed class ClaudeOptions
{
    public const string SectionName = "Claude";

    public static readonly IReadOnlyList<string> KnownEfforts = ["low", "medium", "high", "xhigh", "max"];

    public string ApiKey { get; set; } = "";

    public string Model { get; set; } = "claude-sonnet-5-5";

    public string Effort { get; set; } = "medium";

    public int MaxTokens { get; set; } = 16_000;

    public int TimeoutSeconds { get; set; } = 60;

    /// <summary>Problems with the settings. The messages name settings only and never contain the key.</summary>
    public IReadOnlyList<string> Problems()
    {
        var problems = new List<string>();
        if (string.IsNullOrWhiteSpace(ApiKey))
        {
            problems.Add($"{SectionName}:{nameof(ApiKey)} is required when {TicketGeneratorOptions.SectionName}:Provider is '{TicketGeneratorOptions.ClaudeProvider}' "
                + $"(user-secrets key '{SectionName}:{nameof(ApiKey)}', or environment variable '{SectionName}__{nameof(ApiKey)}').");
        }

        if (string.IsNullOrWhiteSpace(Model))
        {
            problems.Add($"{SectionName}:{nameof(Model)} must not be empty.");
        }

        if (!KnownEfforts.Contains(Effort))
        {
            problems.Add($"{SectionName}:{nameof(Effort)} must be one of {string.Join(", ", KnownEfforts)}.");
        }

        if (MaxTokens <= 0)
        {
            problems.Add($"{SectionName}:{nameof(MaxTokens)} must be positive.");
        }

        if (TimeoutSeconds <= 0)
        {
            problems.Add($"{SectionName}:{nameof(TimeoutSeconds)} must be positive.");
        }

        return problems;
    }
}

public static class ClaudeOptionsRegistration
{
    public static IServiceCollection AddClaudeOptions(this IServiceCollection services)
    {
        services.AddOptions<ClaudeOptions>()
            .BindConfiguration(ClaudeOptions.SectionName)
            .ValidateOnStart();
        services.AddSingleton<IValidateOptions<ClaudeOptions>, ClaudeOptionsValidator>();
        return services;
    }
}

/// <summary>Validates <see cref="ClaudeOptions"/> only when the Claude provider is selected, so the Fake provider needs no key.</summary>
public sealed class ClaudeOptionsValidator(IOptions<TicketGeneratorOptions> generator) : IValidateOptions<ClaudeOptions>
{
    public ValidateOptionsResult Validate(string? name, ClaudeOptions options)
    {
        if (!generator.Value.UsesClaude())
        {
            return ValidateOptionsResult.Skip;
        }

        var problems = options.Problems();
        return problems.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(problems);
    }
}
