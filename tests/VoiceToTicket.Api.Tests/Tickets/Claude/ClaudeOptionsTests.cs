using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using VoiceToTicket.Api.Features.Tickets.Claude;

namespace VoiceToTicket.Api.Tests.Tickets.Claude;

/// <summary>Plan 4.6 / decision D9: Claude settings are checked at start, and only when Claude is the provider.</summary>
public sealed class ClaudeOptionsTests
{
    private const string TestKey = "sk-test-do-not-print-0000";

    [Fact]
    public async Task Claude_without_a_key_fails_startup_and_says_where_to_set_it()
    {
        await using var factory = Configured(("TicketGenerator:Provider", "Claude"), ("Claude:ApiKey", ""));

        var exception = Assert.ThrowsAny<Exception>(() => factory.CreateClient());

        Assert.Contains("Claude:ApiKey is required", exception.ToString(), StringComparison.Ordinal);
        Assert.Contains("Claude__ApiKey", exception.ToString(), StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("Claude:Model", "")]
    [InlineData("Claude:Effort", "turbo")]
    [InlineData("Claude:Effort", "")]
    [InlineData("Claude:MaxTokens", "0")]
    [InlineData("Claude:TimeoutSeconds", "-1")]
    public async Task Claude_with_a_bad_setting_fails_startup_without_printing_the_key(string setting, string value)
    {
        await using var factory = Configured(("TicketGenerator:Provider", "Claude"), ("Claude:ApiKey", TestKey), (setting, value));

        var exception = Assert.ThrowsAny<Exception>(() => factory.CreateClient());

        Assert.Contains(setting, exception.ToString(), StringComparison.Ordinal);
        Assert.DoesNotContain(TestKey, exception.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Claude_with_valid_settings_starts()
    {
        await using var factory = Configured(("TicketGenerator:Provider", "Claude"), ("Claude:ApiKey", TestKey));
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/health", TestContext.Current.CancellationToken);

        Assert.True(response.IsSuccessStatusCode);
    }

    [Fact]
    public async Task Fake_needs_no_key_and_ignores_bad_claude_settings()
    {
        await using var factory = Configured(("TicketGenerator:Provider", "Fake"), ("Claude:ApiKey", ""), ("Claude:Effort", "turbo"));
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/health", TestContext.Current.CancellationToken);

        Assert.True(response.IsSuccessStatusCode);
    }

    [Fact]
    public void Defaults_match_plan_4_6()
    {
        var options = new ClaudeOptions();

        Assert.Equal("claude-sonnet-5-5", options.Model);
        Assert.Equal("medium", options.Effort);
        Assert.Equal(16_000, options.MaxTokens);
        Assert.Equal(60, options.TimeoutSeconds);
    }

    private static WebApplicationFactory<Program> Configured(params (string Key, string Value)[] settings) =>
        new ApiFactory("Production").WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration(configuration =>
                configuration.AddInMemoryCollection(settings.ToDictionary(setting => setting.Key, setting => (string?)setting.Value))));
}
