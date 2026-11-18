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

        routes.MapPost("/tickets/translate", TranslateAsync)
            .WithName("TranslateText")
            .WithSummary("Translate a transcript into another language (one Claude call).");

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
            return ToProblem("Ticket generation failed.", ex);
        }
    }

    private static async Task<Results<Ok<TranslateResponse>, ValidationProblem, ProblemHttpResult>> TranslateAsync(
        TranslateRequest request,
        ITicketGenerator generator,
        CancellationToken cancellationToken)
    {
        var text = request.Text?.Trim() ?? string.Empty;
        if (text.Length == 0)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["text"] = ["The text is empty."] });
        }

        if (text.Length > MaxTranscriptLength)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["text"] = [$"The text is longer than {MaxTranscriptLength} characters."],
            });
        }

        if (request.TargetLanguage is null || !TranslationPrompt.Languages.TryGetValue(request.TargetLanguage, out var language))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["targetLanguage"] = [$"Supported languages: {string.Join(", ", TranslationPrompt.Languages.Keys)}."],
            });
        }

        try
        {
            return TypedResults.Ok(new TranslateResponse(await generator.TranslateAsync(text, language, cancellationToken)));
        }
        catch (TicketGenerationException ex)
        {
            return ToProblem("Translation failed.", ex);
        }
    }

    private static ProblemHttpResult ToProblem(string title, TicketGenerationException ex)
    {
        var status = ex.Error switch
        {
            TicketGenerationError.NotConfigured => StatusCodes.Status503ServiceUnavailable,
            TicketGenerationError.Refused => StatusCodes.Status422UnprocessableEntity,
            TicketGenerationError.Timeout => StatusCodes.Status504GatewayTimeout,
            _ => StatusCodes.Status502BadGateway,
        };

        return TypedResults.Problem(title: title, detail: ex.Message, statusCode: status);
    }
}
