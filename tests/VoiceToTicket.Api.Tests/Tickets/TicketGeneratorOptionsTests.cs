using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace VoiceToTicket.Api.Tests.Tickets;

/// <summary>Decision D9: the provider is explicit configuration, and a wrong value stops the app at startup.</summary>
public sealed class TicketGeneratorOptionsTests
{
    [Theory]
    [InlineData("Nope")]
    [InlineData("Claude")] // Not accepted until T3.2 adds it.
    [InlineData("fake")]
    [InlineData("")]
    public async Task Unknown_provider_fails_startup_with_a_clear_message(string provider)
    {
        await using var factory = FactoryWithProvider(provider);

        var exception = Assert.ThrowsAny<Exception>(() => factory.CreateClient());

        Assert.Contains("TicketGenerator:Provider must be 'Fake'", exception.ToString(), StringComparison.Ordinal);
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
