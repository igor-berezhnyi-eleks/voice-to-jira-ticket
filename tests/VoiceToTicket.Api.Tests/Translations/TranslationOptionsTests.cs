using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using VoiceToTicket.Api.Features.Tickets;
using VoiceToTicket.Api.Features.Tickets.Claude;
using VoiceToTicket.Api.Features.Translations;

namespace VoiceToTicket.Api.Tests.Translations;

/// <summary>Language plan section 6: the provider is checked at start; Claude settings only when Claude is chosen.</summary>
public sealed class TranslationOptionsTests
{
    private const string TestKey = "sk-test-do-not-print-0000";

    [Fact]
    public async Task Claude_without_a_key_fails_startup_and_says_where_to_set_it()
    {
        var exception = await StartFailure(("Translation:Provider", "Claude"), ("Claude:ApiKey", ""));

        Assert.Contains("Claude:ApiKey is required", exception.Message, StringComparison.Ordinal);
        Assert.Contains("Claude__ApiKey", exception.Message, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("")]
    [InlineData("Gemini")]
    [InlineData("claude")]
    public async Task An_unknown_or_missing_provider_fails_startup(string provider)
    {
        var exception = await StartFailure(("Translation:Provider", provider));

        Assert.Contains("Translation:Provider must be", exception.Message, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("Translation:Model", "")]
    [InlineData("Translation:Effort", "turbo")]
    [InlineData("Translation:MaxTokens", "0")]
    [InlineData("Translation:TimeoutSeconds", "0")]
    [InlineData("Translation:TimeoutSeconds", "61")]
    public async Task Claude_with_a_bad_setting_fails_startup_without_printing_the_key(string setting, string value)
    {
        var exception = await StartFailure(("Translation:Provider", "Claude"), ("Claude:ApiKey", TestKey), (setting, value));

        Assert.Contains(setting, exception.Message, StringComparison.Ordinal);
        Assert.DoesNotContain(TestKey, exception.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Claude_with_valid_settings_starts_even_when_tickets_use_the_fake()
    {
        await using var factory = Configured(("TicketGenerator:Provider", "Fake"), ("Translation:Provider", "Claude"), ("Claude:ApiKey", TestKey));
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/health", TestContext.Current.CancellationToken);

        Assert.True(response.IsSuccessStatusCode);
        Assert.IsType<ClaudeTranslator>(factory.Services.GetRequiredService<ITranslator>());
    }

    [Fact]
    public async Task Fake_needs_no_key_and_ignores_bad_claude_settings()
    {
        await using var factory = Configured(("Translation:Provider", "Fake"), ("Claude:ApiKey", ""), ("Translation:Effort", "turbo"));
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/health", TestContext.Current.CancellationToken);

        Assert.True(response.IsSuccessStatusCode);
        Assert.IsType<FakeTranslator>(factory.Services.GetRequiredService<ITranslator>());
    }

    [Fact]
    public void Defaults_match_the_language_plan()
    {
        var options = new TranslationOptions();

        Assert.Equal("claude-haiku-5-5", options.Model);
        Assert.Equal("low", options.Effort);
        Assert.Equal(16_000, options.MaxTokens);
        Assert.Equal(60, options.TimeoutSeconds);
    }

    // A plain host with the real registrations, as in ClaudeOptionsTests.
    private static async Task<OptionsValidationException> StartFailure(params (string Key, string Value)[] settings)
    {
        var builder = Host.CreateApplicationBuilder();
        var values = new Dictionary<string, string?> { ["TicketGenerator:Provider"] = "Fake" };
        foreach (var (key, value) in settings)
        {
            values[key] = value;
        }

        builder.Configuration.AddInMemoryCollection(values);
        builder.Services.AddTicketGeneratorOptions();
        builder.Services.AddClaudeOptions();
        builder.Services.AddTranslation();
        using var host = builder.Build();

        return await Assert.ThrowsAsync<OptionsValidationException>(() => host.StartAsync(TestContext.Current.CancellationToken));
    }

    private static WebApplicationFactory<Program> Configured(params (string Key, string Value)[] settings) =>
        new ApiFactory("Production").WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration(configuration =>
                configuration.AddInMemoryCollection(settings.ToDictionary(setting => setting.Key, setting => (string?)setting.Value))));
}
