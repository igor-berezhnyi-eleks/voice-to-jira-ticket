using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using VoiceToJira.Api.Features.Tickets;

namespace VoiceToJira.Tests.Features.Tickets;

public sealed class TicketEndpointTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly Mock<ITicketGenerator> generator = new();

    [Theory]
    [InlineData("   ")]
    [InlineData(null)]
    public async Task Empty_transcript_is_a_validation_problem(string? transcript)
    {
        var response = await Post(new { transcript });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).Should().Contain("transcript");
        generator.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Too_long_transcript_is_a_validation_problem()
    {
        var response = await Post(new { transcript = new string('a', TicketEndpoints.MaxTranscriptLength + 1) });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Generated_ticket_is_returned_as_flat_camel_case_json_with_type_first()
    {
        generator.Setup(g => g.GenerateAsync("Report text", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new FeatureTicket
            {
                Title = "T",
                Description = "D",
                UserOrBusinessNeed = "N",
                MissingInformation = ["acceptanceCriteria"],
            });

        var response = await Post(new { transcript = "  Report text " });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(json);
        document.RootElement.EnumerateObject().Select(p => p.Name).Should().Equal(
            "type", "title", "description", "userOrBusinessNeed", "acceptanceCriteria", "missingInformation");
        document.RootElement.GetProperty("type").GetString().Should().Be("Feature");
        document.RootElement.GetProperty("missingInformation")[0].GetString().Should().Be("acceptanceCriteria");
    }

    [Theory]
    [InlineData(TicketGenerationError.Refused, HttpStatusCode.UnprocessableEntity)]
    [InlineData(TicketGenerationError.NotConfigured, HttpStatusCode.ServiceUnavailable)]
    [InlineData(TicketGenerationError.Timeout, HttpStatusCode.GatewayTimeout)]
    [InlineData(TicketGenerationError.InvalidOutput, HttpStatusCode.BadGateway)]
    public async Task Generation_errors_become_problem_details(TicketGenerationError error, HttpStatusCode expected)
    {
        generator.Setup(g => g.GenerateAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new TicketGenerationException(error, "why it failed"));

        var response = await Post(new { transcript = "x" });

        response.StatusCode.Should().Be(expected);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/problem+json");
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).Should().Contain("why it failed");
    }

    private Task<HttpResponseMessage> Post(object body)
    {
        var client = factory
            .WithWebHostBuilder(b => b.ConfigureTestServices(s => s.AddSingleton(generator.Object)))
            .CreateClient();

        return client.PostAsJsonAsync("/api/tickets/generate", body, TestContext.Current.CancellationToken);
    }
}
