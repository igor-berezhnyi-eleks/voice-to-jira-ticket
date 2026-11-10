using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using VoiceToTicket.Api.Features.Tickets;
using VoiceToTicket.Api.Features.Tickets.Contract;

namespace VoiceToTicket.Api.Tests.Tickets.Claude;

/// <summary>
/// One real Claude call through the whole API (plan 4.10). Costs a few cents and sends a made-up transcript to the Anthropic API.
/// Run: <c>$env:VTT_RUN_LIVE = "1"; dotnet test --filter "Category=Live"</c>. The key comes from user-secrets
/// (<c>Claude:ApiKey</c>, loaded because the host runs in Development) or the <c>Claude__ApiKey</c> environment variable.
/// </summary>
[Trait("Category", "Live")]
public sealed class ClaudeLiveTests
{
    private const string BugTranscript =
        "When I save an invoice and the date field is empty the editor just closes and I lose everything I typed. "
        + "I first noticed it today on the staging site. I did not try other browsers.";

    [Fact]
    public async Task A_real_call_returns_a_schema_and_validator_valid_ticket()
    {
        Assert.SkipUnless(Environment.GetEnvironmentVariable("VTT_RUN_LIVE") == "1", "Set VTT_RUN_LIVE=1 and provide Claude:ApiKey to run the live test.");

        await using var factory = new ApiFactory("Development").WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration(configuration =>
                configuration.AddInMemoryCollection(new Dictionary<string, string?> { ["TicketGenerator:Provider"] = "Claude" })));
        using var client = factory.CreateClient();
        var cancellationToken = TestContext.Current.CancellationToken;

        using var response = await client.PostAsJsonAsync("/api/tickets", new { transcript = BugTranscript }, cancellationToken);

        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        Assert.True(response.StatusCode == HttpStatusCode.OK, $"{(int)response.StatusCode}: {body}");

        using var document = JsonDocument.Parse(body);
        var root = document.RootElement;
        Assert.Equal("Claude", root.GetProperty("provider").GetString());
        Assert.Equal("claude-sonnet-5-5", root.GetProperty("model").GetString());
        Assert.True(root.GetProperty("usage").GetProperty("outputTokens").GetInt64() > 0);

        var ticket = root.GetProperty("ticket").Deserialize<Ticket>(TicketJson.Options);
        Assert.NotNull(ticket);
        Assert.Empty(TicketValidator.Validate(ticket));
        Assert.Equal(TicketType.Bug, ticket.Type);
    }
}
