using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;
using VoiceToTicket.Api.Features.Transcriptions;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Features.Translations;

public static class TranslateEndpoint
{
    public const string EnglishCode = SttOptions.DefaultLanguageCode;

    public static IEndpointRouteBuilder MapTranslateEndpoint(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/translations", HandleAsync)
            .WithName("Translate")
            .WithTags("Translations")
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity)
            .ProducesProblem(StatusCodes.Status502BadGateway)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable)
            .ProducesProblem(StatusCodes.Status504GatewayTimeout);

        return endpoints;
    }

    private static async Task<Ok<TranslationResponse>> HandleAsync(
        TranslateRequest request,
        ITranslator translator,
        IOptions<SttOptions> languages,
        TimeProvider timeProvider,
        ILogger<TranslateRequest> logger,
        CancellationToken cancellationToken)
    {
        // "To" must be one of the languages the selector offers (the same list as speech-to-text). An empty value is
        // not English here: Resolve treats empty as English, a request must name its target.
        var to = request.To.Trim();
        if (languages.Value.Resolve(to) is null)
        {
            throw new ApiException(
                StatusCodes.Status400BadRequest,
                ErrorCodes.Validation,
                "The request is not valid.",
                $"The language '{to}' is not supported for translation.");
        }

        var start = timeProvider.GetTimestamp();
        var reply = await translator.TranslateAsync(request.Text, to, cancellationToken);
        var durationMs = (long)timeProvider.GetElapsedTime(start).TotalMilliseconds;

        // Text that was already in the target language comes back as it was sent.
        if (reply.From == to)
        {
            LogResult(logger, request, reply, to, durationMs);
            return TypedResults.Ok(new TranslationResponse(request.Text, reply.From, to, reply.Model, durationMs));
        }

        // Translation goes to or from English only (decision D20). A reply that fits neither way is refused here, so
        // every provider gets the rule, and a later language cannot be translated to another language directly.
        if (reply.From != EnglishCode && to != EnglishCode)
        {
            throw new ApiException(
                StatusCodes.Status422UnprocessableEntity,
                ErrorCodes.TranslationPairUnsupported,
                "This language pair is not supported.",
                "Translate the text to English first, then to the other language.");
        }

        LogResult(logger, request, reply, to, durationMs);
        return TypedResults.Ok(new TranslationResponse(reply.Text, reply.From, to, reply.Model, durationMs));
    }

    // Lengths, languages and duration only: the report is never logged (plan 4.4).
    private static void LogResult(ILogger logger, TranslateRequest request, TranslatorReply reply, string to, long durationMs) =>
        logger.LogInformation(
            "Translated {TextLength} characters from {From} to {To} in {DurationMs} ms with {Model}",
            request.Text.Length,
            reply.From,
            to,
            durationMs,
            reply.Model);
}

/// <param name="Text">1 to 20,000 characters, the same limit as a ticket's transcript. <see cref="RequiredAttribute"/> also rejects text that is only whitespace.</param>
/// <param name="To">A language code from the configured languages (for example <c>en</c>, <c>uk</c>).</param>
public sealed record TranslateRequest(
    [Required, StringLength(TranslateRequest.MaxTextLength, MinimumLength = 1)]
    string Text,
    [Required]
    string To)
{
    public const int MaxTextLength = 20_000;
}

/// <param name="Text">The translation, or the text as sent when it was already in the target language.</param>
/// <param name="From">The detected language of the text sent.</param>
public sealed record TranslationResponse(string Text, string From, string To, string Model, long DurationMs);
