using System.Net;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using VoiceToTicket.Api.Features.Transcriptions;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Tests.Transcriptions;

/// <summary>Plan 4.10: <see cref="SpeachesClient"/> against a stub handler.</summary>
public sealed class SpeachesClientTests
{
    [Fact]
    public async Task Posts_a_multipart_request_and_returns_the_trimmed_text()
    {
        var handler = new StubHandler(async (request, _) =>
        {
            Assert.Equal(HttpMethod.Post, request.Method);
            Assert.Equal("http://stt.test/v1/audio/transcriptions", request.RequestUri!.ToString());
            var body = await request.Content!.ReadAsStringAsync();
            Assert.StartsWith("multipart/form-data", request.Content.Headers.ContentType!.MediaType);
            Assert.Contains("name=file; filename=voice.webm", body);
            Assert.Contains("Content-Type: audio/webm", body);
            Assert.Contains("AUDIO-BYTES", body);
            AssertField(body, "model", "test-model");
            AssertField(body, "language", "en");
            AssertField(body, "response_format", "json");
            return Json("""{"text": "  the app crashes  "}""");
        });

        var result = await CreateClient(handler).TranscribeAsync(Audio(), "voice.webm", "audio/webm", CancellationToken.None);

        Assert.Equal("the app crashes", result.Text);
        Assert.True(result.DurationMs >= 0);
    }

    [Fact]
    public async Task Empty_text_is_a_valid_transcript()
    {
        var client = CreateClient(new StubHandler((_, _) => Task.FromResult(Json("""{"text": ""}"""))));

        var result = await client.TranscribeAsync(Audio(), "a.wav", "audio/wav", CancellationToken.None);

        Assert.Equal("", result.Text);
    }

    [Theory]
    [InlineData(HttpStatusCode.InternalServerError)]
    [InlineData(HttpStatusCode.BadRequest)]
    [InlineData(HttpStatusCode.NotFound)]
    public async Task Error_status_is_stt_unavailable(HttpStatusCode status)
    {
        var client = CreateClient(new StubHandler((_, _) => Task.FromResult(new HttpResponseMessage(status))));

        var exception = await Assert.ThrowsAsync<ApiException>(() => Transcribe(client));

        AssertUnavailable(exception);
    }

    [Theory]
    [InlineData(HttpStatusCode.UnsupportedMediaType)]
    [InlineData(HttpStatusCode.UnprocessableEntity)]
    public async Task Undecodable_audio_is_audio_unreadable_not_stt_unavailable(HttpStatusCode status)
    {
        var body = """{"detail":"Failed to decode audio. The provided file type is not supported."}""";
        var client = CreateClient(new StubHandler((_, _) => Task.FromResult(
            new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") })));

        var exception = await Assert.ThrowsAsync<ApiException>(() => Transcribe(client));

        Assert.Equal(StatusCodes.Status422UnprocessableEntity, exception.StatusCode);
        Assert.Equal(ErrorCodes.AudioUnreadable, exception.Code);
        Assert.DoesNotContain("Failed to decode", exception.Detail);
    }

    [Theory]
    [InlineData("not json at all, secret words")]
    [InlineData("""{"other": "x"}""")]
    [InlineData("""{"text": 5}""")]
    [InlineData("""["text"]""")]
    [InlineData("")]
    public async Task Unusable_body_is_stt_unavailable_without_leaking_it(string body)
    {
        var client = CreateClient(new StubHandler((_, _) => Task.FromResult(Json(body))));

        var exception = await Assert.ThrowsAsync<ApiException>(() => Transcribe(client));

        AssertUnavailable(exception);
        Assert.DoesNotContain("secret", exception.Detail);
    }

    [Fact]
    public async Task Unreachable_server_is_stt_unavailable()
    {
        var client = CreateClient(new StubHandler((_, _) => throw new HttpRequestException("connection refused")));

        var exception = await Assert.ThrowsAsync<ApiException>(() => Transcribe(client));

        AssertUnavailable(exception);
    }

    [Fact]
    public async Task No_answer_within_the_timeout_is_stt_timeout()
    {
        var client = CreateClient(new StubHandler(async (_, token) =>
        {
            await Task.Delay(Timeout.Infinite, token);
            return Json("{}");
        }), timeoutSeconds: 1);

        var exception = await Assert.ThrowsAsync<ApiException>(() => Transcribe(client));

        Assert.Equal(StatusCodes.Status504GatewayTimeout, exception.StatusCode);
        Assert.Equal(ErrorCodes.SttTimeout, exception.Code);
    }

    [Fact]
    public async Task Caller_cancellation_is_not_reported_as_a_timeout()
    {
        using var cancellation = new CancellationTokenSource();
        var client = CreateClient(new StubHandler(async (_, token) =>
        {
            await cancellation.CancelAsync();
            await Task.Delay(Timeout.Infinite, token);
            return Json("{}");
        }));

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => client.TranscribeAsync(Audio(), "a.wav", "audio/wav", cancellation.Token));
    }

    [Theory]
    [InlineData("")]
    [InlineData("not a url")]
    [InlineData("ftp://stt:8000")]
    public void Options_reject_a_bad_base_url(string baseUrl) =>
        Assert.False(new SttOptions { BaseUrl = baseUrl }.IsValid());

    [Fact]
    public void Default_options_are_valid_and_match_the_plan()
    {
        var options = new SttOptions();

        Assert.True(options.IsValid());
        Assert.Equal("http://stt:8000", options.BaseUrl);
        Assert.Equal("en", options.Language);
        Assert.Equal(120, options.TimeoutSeconds);
    }

    [Fact]
    public void Options_reject_a_non_positive_timeout() =>
        Assert.False(new SttOptions { TimeoutSeconds = 0 }.IsValid());

    private static Task<Transcription> Transcribe(SpeachesClient client) =>
        client.TranscribeAsync(Audio(), "a.wav", "audio/wav", CancellationToken.None);

    private static void AssertUnavailable(ApiException exception)
    {
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, exception.StatusCode);
        Assert.Equal(ErrorCodes.SttUnavailable, exception.Code);
    }

    private static void AssertField(string body, string name, string value) =>
        Assert.Matches($"name={name}\\r?\\n\\r?\\n{System.Text.RegularExpressions.Regex.Escape(value)}\\r?\\n", body);

    private static MemoryStream Audio() => new(Encoding.UTF8.GetBytes("AUDIO-BYTES"));

    private static HttpResponseMessage Json(string body) =>
        new(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    private static SpeachesClient CreateClient(StubHandler handler, int timeoutSeconds = 30)
    {
        var httpClient = new HttpClient(handler)
        {
            BaseAddress = new Uri("http://stt.test/"),
            Timeout = Timeout.InfiniteTimeSpan,
        };
        var options = Options.Create(new SttOptions
        {
            BaseUrl = "http://stt.test",
            Model = "test-model",
            Language = "en",
            TimeoutSeconds = timeoutSeconds,
        });
        return new SpeachesClient(httpClient, options, TimeProvider.System, NullLogger<SpeachesClient>.Instance);
    }

    private sealed class StubHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> respond)
        : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            respond(request, cancellationToken);
    }
}
