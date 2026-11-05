using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace VoiceToTicket.Api.Tests;

/// <summary>Hosts the API in memory in a chosen environment.</summary>
public sealed class ApiFactory(string environment) : WebApplicationFactory<Program>
{
    public ApiFactory() : this("Development")
    {
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.UseEnvironment(environment);
}
