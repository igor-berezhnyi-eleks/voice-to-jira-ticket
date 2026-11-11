using Microsoft.AspNetCore.Http.HttpResults;

namespace VoiceToJira.Api.Features.Tickets;

public static class TicketEndpoints
{
    public const int MaxTranscriptLength = 20_000;

    public static IEndpointRouteBuilder MapTicketEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapPost("/tickets/generate", GenerateAsync)
            .WithName("GenerateTicket")
            .WithSummary("Turn a transcript into one Bug or Feature ticket (one Claude call).");

        return routes;
    }

    private static async Task<Results<Ok<Ticket>, ValidationProblem, ProblemHttpResult>> GenerateAsync(
        GenerateTicketRequest request,
        ITicketGenerator generator,
        CancellationToken cancellationToken)
    {
        var transcript = request.Transcript?.Trim() ?? string.Empty;
        if (transcript.Length == 0)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["transcript"] = ["The transcript is empty."] });
        }

        if (transcript.Length > MaxTranscriptLength)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["transcript"] = [$"The transcript is longer than {MaxTranscriptLength} characters."],
            });
        }

        try
        {
            return TypedResults.Ok(await generator.GenerateAsync(transcript, cancellationToken));
        }
        catch (TicketGenerationException ex)
        {
            var status = ex.Error switch
            {
                TicketGenerationError.NotConfigured => StatusCodes.Status503ServiceUnavailable,
                TicketGenerationError.Refused => StatusCodes.Status422UnprocessableEntity,
                TicketGenerationError.Timeout => StatusCodes.Status504GatewayTimeout,
                _ => StatusCodes.Status502BadGateway,
            };

            return TypedResults.Problem(title: "Ticket generation failed.", detail: ex.Message, statusCode: status);
        }
    }
}
