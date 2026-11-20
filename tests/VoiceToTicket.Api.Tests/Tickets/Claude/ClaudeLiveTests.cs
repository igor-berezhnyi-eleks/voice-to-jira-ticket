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

    // L4: written for this check, not taken from the evaluation scenarios. Neither says the browser or the expected result.
    private const string UkrainianTranscript =
        "Коли я зберігаю рахунок з порожнім полем дати, редактор просто закривається, і все, що я ввів, пропадає. "
        + "Я помітив це сьогодні на staging. Що має відбуватися натомість, я не знаю.";

    private const string EnglishTranscript =
        "When I export the report with an empty filter, the download button does nothing and no file is saved. "
        + "I saw it this morning. I do not know what should happen instead.";

    [Theory]
    [InlineData(UkrainianTranscript, "uk")]
    [InlineData(EnglishTranscript, "en")]
    public async Task A_real_call_writes_the_ticket_in_the_language_of_the_transcript(string transcript, string language)
    {
        Assert.SkipUnless(Environment.GetEnvironmentVariable("VTT_RUN_LIVE") == "1", "Set VTT_RUN_LIVE=1 and provide Claude:ApiKey to run the live test.");

        await using var factory = new ApiFactory("Development").WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration(configuration =>
                configuration.AddInMemoryCollection(new Dictionary<string, string?> { ["TicketGenerator:Provider"] = "Claude" })));
        using var client = factory.CreateClient();
        var cancellationToken = TestContext.Current.CancellationToken;

        using var response = await client.PostAsJsonAsync("/api/tickets", new { transcript }, cancellationToken);

        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        Assert.True(response.StatusCode == HttpStatusCode.OK, $"{(int)response.StatusCode}: {body}");

        using var document = JsonDocument.Parse(body);
        var ticket = document.RootElement.GetProperty("ticket").Deserialize<Ticket>(TicketJson.Options);
        Assert.NotNull(ticket);
        TestContext.Current.SendDiagnosticMessage(JsonSerializer.Serialize(ticket, new JsonSerializerOptions(TicketJson.Options) { WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping }));

        Assert.Empty(TicketValidator.Validate(ticket));
        Assert.Equal(language, ticket.Language);

        var hasCyrillic = System.Text.RegularExpressions.Regex.IsMatch(ticket.Title + ticket.Description, @"\p{IsCyrillic}");
        Assert.Equal(language == "uk", hasCyrillic);
    }

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
