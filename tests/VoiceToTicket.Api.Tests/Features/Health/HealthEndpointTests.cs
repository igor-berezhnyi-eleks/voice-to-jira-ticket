using System.Net;
using System.Text.Json;

namespace VoiceToTicket.Api.Tests.Features.Health;

public sealed class HealthEndpointTests
{
    [Fact]
    public async Task Get_health_returns_ok_status()
    {
        await using var factory = new ApiFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/health", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var root = body.RootElement;
        Assert.Equal(JsonValueKind.Object, root.ValueKind);
        Assert.Equal("ok", root.GetProperty("status").GetString());
        Assert.Single(root.EnumerateObject());
    }
}
