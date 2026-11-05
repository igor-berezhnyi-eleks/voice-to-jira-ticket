using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http.HttpResults;

namespace VoiceToTicket.Api.Features.Tickets;

public static class GenerateTicketEndpoint
{
    public static IEndpointRouteBuilder MapGenerateTicketEndpoint(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/tickets", HandleAsync)
            .WithName("GenerateTicket")
            .WithTags("Tickets")
            .ProducesValidationProblem();

        return endpoints;
    }

    private static async Task<Ok<GenerationResult>> HandleAsync(
        GenerateTicketRequest request,
        ITicketGenerator generator,
        ILogger<GenerateTicketRequest> logger,
        CancellationToken cancellationToken)
    {
        var result = await generator.GenerateAsync(request.Transcript, cancellationToken);

        // Length and duration only: the transcript itself is never logged at this level (plan 4.4).
        logger.LogInformation(
            "Generated a ticket from {TranscriptLength} characters in {DurationMs} ms with {Provider}",
            request.Transcript.Length,
            result.DurationMs,
            result.Provider);

        return TypedResults.Ok(result);
    }
}

/// <param name="Transcript">20 to 20,000 characters. <see cref="RequiredAttribute"/> also rejects text that is only whitespace.</param>
public sealed record GenerateTicketRequest(
    [Required, StringLength(GenerateTicketRequest.MaxTranscriptLength, MinimumLength = GenerateTicketRequest.MinTranscriptLength)]
    string Transcript)
{
    public const int MinTranscriptLength = 20;
    public const int MaxTranscriptLength = 20_000;
}
