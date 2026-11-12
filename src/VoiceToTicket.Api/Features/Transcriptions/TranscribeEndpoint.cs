using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Net.Http.Headers;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Features.Transcriptions;

public static class TranscribeEndpoint
{
    public const long MaxAudioBytes = 25L * 1024 * 1024;

    private static readonly Dictionary<string, string> Extensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ["audio/webm"] = ".webm",
        ["audio/ogg"] = ".ogg",
        ["audio/wav"] = ".wav",
        ["audio/mpeg"] = ".mp3",
    };

    public static IEndpointRouteBuilder MapTranscribeEndpoint(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/transcriptions", HandleAsync)
            .WithName("Transcribe")
            .WithTags("Transcriptions")
            .DisableAntiforgery() // No cookies or sessions: a browser form post cannot be a forged-request risk here.
            .Accepts<TranscribeForm>("multipart/form-data")
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status413PayloadTooLarge)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable)
            .ProducesProblem(StatusCodes.Status504GatewayTimeout);

        return endpoints;
    }

    private static async Task<Ok<TranscriptionResponse>> HandleAsync(
        HttpRequest request,
        ISpeechToText speechToText,
        ILogger<TranscribeForm> logger,
        CancellationToken cancellationToken)
    {
        if (!request.HasFormContentType)
        {
            throw Invalid("Send the recording as multipart/form-data in the field 'audio'.");
        }

        IFormCollection form;
        try
        {
            form = await request.ReadFormAsync(cancellationToken);
        }
        catch (Exception exception) when (exception is InvalidDataException or IOException)
        {
            // A broken multipart body (bad boundary: InvalidDataException; truncated: IOException) is the
            // client's mistake, not a server error.
            throw Invalid("The multipart body could not be read.");
        }

        var audio = form.Files.GetFile("audio") ?? throw Invalid("The form field 'audio' is missing.");

        if (audio.Length == 0)
        {
            throw Invalid("The recording is empty.");
        }

        if (audio.Length > MaxAudioBytes)
        {
            throw new ApiException(
                StatusCodes.Status413PayloadTooLarge,
                ErrorCodes.PayloadTooLarge,
                "The recording is too large.",
                $"The limit is {MaxAudioBytes / (1024 * 1024)} MB.");
        }

        var mediaType = MediaTypeHeaderValue.TryParse(audio.ContentType, out var parsed)
            ? parsed.MediaType.Value?.ToLowerInvariant()
            : null;
        if (mediaType is null || !Extensions.TryGetValue(mediaType, out var extension))
        {
            throw Invalid($"Audio type '{audio.ContentType}' is not supported. Use {string.Join(", ", Extensions.Keys)}.");
        }

        var fileName = Path.GetExtension(audio.FileName).Length > 0 ? Path.GetFileName(audio.FileName) : $"audio{extension}";

        await using var stream = audio.OpenReadStream();
        var result = await speechToText.TranscribeAsync(stream, fileName, mediaType, cancellationToken);

        // Length and duration only: the transcript is never logged at this level (plan 4.4).
        logger.LogInformation(
            "Transcribed {AudioBytes} bytes of {ContentType} into {TranscriptLength} characters in {DurationMs} ms",
            audio.Length,
            mediaType,
            result.Text.Length,
            result.DurationMs);

        return TypedResults.Ok(new TranscriptionResponse(result.Text, result.DurationMs));
    }

    private static ApiException Invalid(string detail) =>
        new(StatusCodes.Status400BadRequest, ErrorCodes.Validation, "The request is not valid.", detail);
}

/// <summary>Documents the multipart form for OpenAPI.</summary>
/// <param name="Audio">The recording: audio/webm, audio/ogg, audio/wav or audio/mpeg, up to 25 MB.</param>
public sealed record TranscribeForm(IFormFile Audio);

public sealed record TranscriptionResponse(string Text, long DurationMs);
