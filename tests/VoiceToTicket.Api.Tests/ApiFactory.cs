using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace VoiceToTicket.Api.Tests;

/// <summary>
/// Hosts the API in memory in a chosen environment. It always starts with the Fake generator and Jira switched off,
/// so a developer's user-secrets, environment variables or Development settings (for example
/// <c>TicketGenerator:Provider=Claude</c> or <c>Jira:Enabled=true</c>) cannot change test results.
/// A test that needs another provider overrides the setting in its own <c>WithWebHostBuilder</c>.
/// </summary>
public sealed class ApiFactory(string environment) : WebApplicationFactory<Program>
{
    public ApiFactory() : this("Development")
    {
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(environment);
        builder.ConfigureAppConfiguration(configuration =>
            configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["TicketGenerator:Provider"] = "Fake",
                ["Jira:Enabled"] = "false",
            }));
    }
}
