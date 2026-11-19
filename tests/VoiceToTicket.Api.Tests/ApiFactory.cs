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
                // The developer's user-secrets may hold a Jira allowlist and deployment for a real site; tests start from
                // the defaults. Blank allowlist entries are ignored, so a test can still set its own.
                ["Jira:Deployment"] = "Cloud",
                ["Jira:ServerAuthScheme"] = "Bearer",
                ["Jira:AllowedHosts:0"] = "",
                ["Jira:AllowedHosts:1"] = "",
                ["Jira:AllowedHosts:2"] = "",
                ["Jira:AllowedHosts:3"] = "",
                ["Jira:AllowedHosts:4"] = "",
                ["Jira:AllowedHosts:5"] = "",
                ["Jira:AllowedHosts:6"] = "",
                ["Jira:AllowedHosts:7"] = "",
            }));
    }
}
