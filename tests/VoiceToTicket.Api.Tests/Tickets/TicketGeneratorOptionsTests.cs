using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using VoiceToTicket.Api.Features.Tickets;

namespace VoiceToTicket.Api.Tests.Tickets;

/// <summary>Decision D9: the provider is explicit configuration, and a wrong value stops the app at startup.</summary>
public sealed class TicketGeneratorOptionsTests
{
    // Starts a plain host with the real registration instead of WebApplicationFactory: when startup fails, the
    // factory can surface an ObjectDisposedException from its own teardown in place of the validation error.
    [Theory]
    [InlineData("Nope")]
    [InlineData("claude")]
    [InlineData("fake")]
    [InlineData("")]
    public async Task Unknown_provider_fails_startup_with_a_clear_message(string provider)
    {
        var builder = Host.CreateApplicationBuilder();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?> { ["TicketGenerator:Provider"] = provider });
        builder.Services.AddTicketGeneratorOptions();
        using var host = builder.Build();

        var exception = await Assert.ThrowsAsync<OptionsValidationException>(() => host.StartAsync(TestContext.Current.CancellationToken));

        Assert.Contains("TicketGenerator:Provider must be 'Fake' or 'Claude'", exception.Message, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("Fake")]
    [InlineData("Claude")]
    public async Task Known_provider_passes_validation(string provider)
    {
        var builder = Host.CreateApplicationBuilder();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?> { ["TicketGenerator:Provider"] = provider });
        builder.Services.AddTicketGeneratorOptions();
        using var host = builder.Build();

        await host.StartAsync(TestContext.Current.CancellationToken);
        await host.StopAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Fake_provider_starts()
    {
        await using var factory = FactoryWithProvider("Fake");
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/health", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static WebApplicationFactory<Program> FactoryWithProvider(string provider) =>
        new ApiFactory("Production").WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration(configuration =>
                configuration.AddInMemoryCollection(new Dictionary<string, string?> { ["TicketGenerator:Provider"] = provider })));
}
