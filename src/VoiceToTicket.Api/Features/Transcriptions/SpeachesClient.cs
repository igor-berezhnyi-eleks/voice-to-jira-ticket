using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Options;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Features.Transcriptions;

/// <summary>
/// Speaches (OpenAI-compatible <c>/v1/audio/transcriptions</c>). No retry: a transcription is long and a
/// repeat would double the wait (decision D2). The timeout is enforced here, not by <see cref="HttpClient.Timeout"/>,
/// so a timeout can be told apart from the caller cancelling.
/// </summary>
public sealed class SpeachesClient(
    HttpClient httpClient,
    IOptions<SttOptions> options,
    TimeProvider timeProvider,
    ILogger<SpeachesClient> logger) : ISpeechToText
{
    public async Task<Transcription> TranscribeAsync(
        Stream audio,
        string fileName,
        string contentType,
        CancellationToken cancellationToken)
    {
        var settings = options.Value;
        var started = timeProvider.GetTimestamp();

        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(settings.TimeoutSeconds), timeProvider);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);

        using var form = new MultipartFormDataContent();
        var file = new StreamContent(audio);
        file.Headers.ContentType = MediaTypeHeaderValue.Parse(contentType);
        form.Add(file, "file", fileName);
        form.Add(new StringContent(settings.Model), "model");
        form.Add(new StringContent(settings.Language), "language");
        form.Add(new StringContent("json"), "response_format");

        try
        {
            using var response = await httpClient.PostAsync("v1/audio/transcriptions", form, linked.Token);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("The speech-to-text server answered {StatusCode}", (int)response.StatusCode);
                throw Unavailable();
            }

            var text = await ReadTextAsync(response, linked.Token);
            var elapsed = timeProvider.GetElapsedTime(started);
            return new Transcription(text.Trim(), (long)elapsed.TotalMilliseconds);
        }
        catch (OperationCanceledException) when (timeout.IsCancellationRequested && !cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning("The speech-to-text server did not answer within {TimeoutSeconds} s", settings.TimeoutSeconds);
            throw new ApiException(
                StatusCodes.Status504GatewayTimeout,
                ErrorCodes.SttTimeout,
                "Transcription timed out.",
                "The speech-to-text server took too long. Try a shorter recording.");
        }
        catch (HttpRequestException exception)
        {
            logger.LogWarning(exception, "The speech-to-text server could not be reached");
            throw Unavailable(exception);
        }
    }

    private async Task<string> ReadTextAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        try
        {
            await using var body = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var document = await JsonDocument.ParseAsync(body, cancellationToken: cancellationToken);
            if (document.RootElement.ValueKind == JsonValueKind.Object
                && document.RootElement.TryGetProperty("text", out var text)
                && text.ValueKind == JsonValueKind.String)
            {
                return text.GetString()!;
            }
        }
        catch (JsonException exception)
        {
            // The message of a JsonException can quote the body: log the type only.
            logger.LogWarning("The speech-to-text server sent an invalid response ({ExceptionType})", exception.GetType().Name);
            throw Unavailable(exception);
        }

        logger.LogWarning("The speech-to-text response had no text field");
        throw Unavailable();
    }

    private static ApiException Unavailable(Exception? inner = null) => new(
        StatusCodes.Status503ServiceUnavailable,
        ErrorCodes.SttUnavailable,
        "Transcription is unavailable.",
        "The speech-to-text server could not be reached or gave an unusable answer.",
        inner);
}
