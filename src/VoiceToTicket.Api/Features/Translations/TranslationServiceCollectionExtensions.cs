using Microsoft.Extensions.Options;

namespace VoiceToTicket.Api.Features.Translations;

public static class TranslationServiceCollectionExtensions
{
    /// <summary>
    /// Registers the translator. As with the ticket generator, the provider is read when the translator is first
    /// needed, so tests and later configuration sources decide it; the Claude settings are validated at start only
    /// when Claude is chosen. <c>IClaudeMessages</c> is registered with the ticket generator and shared.
    /// </summary>
    public static IServiceCollection AddTranslation(this IServiceCollection services)
    {
        services.AddOptions<TranslationOptions>()
            .BindConfiguration(TranslationOptions.SectionName)
            .ValidateOnStart();
        services.AddSingleton<IValidateOptions<TranslationOptions>, TranslationOptionsValidator>();
        services.AddSingleton<FakeTranslator>();
        services.AddSingleton<ClaudeTranslator>();
        services.AddSingleton<ITranslator>(provider =>
            provider.GetRequiredService<IOptions<TranslationOptions>>().Value.UsesClaude()
                ? provider.GetRequiredService<ClaudeTranslator>()
                : provider.GetRequiredService<FakeTranslator>());
        return services;
    }
}
