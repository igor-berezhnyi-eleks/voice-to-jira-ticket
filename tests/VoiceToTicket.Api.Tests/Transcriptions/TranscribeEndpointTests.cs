using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using VoiceToTicket.Api.Features.Transcriptions;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Tests.Transcriptions;

/// <summary>Plan 4.4: <c>POST /api/transcriptions</c> through the whole HTTP pipeline with a fake <see cref="ISpeechToText"/>.</summary>
public sealed class TranscribeEndpointTests
{
    private const string Path = "/api/transcriptions";
    private const string Secret = "my-secret-transcript-words";

    [Theory]
    [InlineData("audio/webm")]
    [InlineData("audio/webm;codecs=opus")]
    [InlineData("audio/ogg")]
    [InlineData("audio/wav")]
    [InlineData("audio/mpeg")]
    [InlineData("AUDIO/WEBM")]
    public async Task Supported_audio_returns_the_transcript(string contentType)
    {
        var fake = new FakeSpeechToText(Secret);
        using var factory = CreateFactory(fake);

        using var response = await factory.CreateClient().PostAsync(Path, Form("audio", contentType, "voice.webm", 100), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        Assert.Equal(Secret, body.RootElement.GetProperty("text").GetString());
        Assert.Equal(42, body.RootElement.GetProperty("durationMs").GetInt64());
        Assert.Equal(100, fake.ReceivedBytes);
        Assert.Equal("voice.webm", fake.FileName);
        Assert.StartsWith("audio/", fake.ContentType);
        Assert.DoesNotContain(";", fake.ContentType);
    }

    [Fact]
    public async Task A_file_name_without_extension_gets_one_from_the_type()
    {
        var fake = new FakeSpeechToText("hello");
        using var factory = CreateFactory(fake);

        using var response = await factory.CreateClient().PostAsync(Path, Form("audio", "audio/ogg", "blob", 10), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("audio.ogg", fake.FileName);
    }

    [Fact]
    public async Task Silence_returns_an_empty_transcript()
    {
        using var factory = CreateFactory(new FakeSpeechToText(""));

        using var response = await factory.CreateClient().PostAsync(Path, Form("audio", "audio/wav", "a.wav", 10), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        Assert.Equal("", body.RootElement.GetProperty("text").GetString());
    }

    [Fact]
    public async Task Missing_field_is_a_validation_error()
    {
        using var factory = CreateFactory(new FakeSpeechToText("x"));

        using var response = await factory.CreateClient().PostAsync(Path, Form("other", "audio/wav", "a.wav", 10), TestContext.Current.CancellationToken);

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, ErrorCodes.Validation);
    }

    [Fact]
    public async Task Empty_file_is_a_validation_error()
    {
        using var factory = CreateFactory(new FakeSpeechToText("x"));

        using var response = await factory.CreateClient().PostAsync(Path, Form("audio", "audio/wav", "a.wav", 0), TestContext.Current.CancellationToken);

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, ErrorCodes.Validation);
    }

    [Theory]
    [InlineData("text/plain")]
    [InlineData("video/mp4")]
    [InlineData("application/octet-stream")]
    [InlineData("audio/flac")]
    public async Task Unsupported_type_is_a_validation_error(string contentType)
    {
        var fake = new FakeSpeechToText("x");
        using var factory = CreateFactory(fake);

        using var response = await factory.CreateClient().PostAsync(Path, Form("audio", contentType, "a.bin", 10), TestContext.Current.CancellationToken);

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, ErrorCodes.Validation);
        Assert.Equal(0, fake.Calls);
    }

    [Fact]
    public async Task Not_a_form_is_an_unsupported_media_type()
    {
        using var factory = CreateFactory(new FakeSpeechToText("x"));
        using var content = new StringContent("""{"audio":"x"}""", System.Text.Encoding.UTF8, "application/json");

        using var response = await factory.CreateClient().PostAsync(Path, content, TestContext.Current.CancellationToken);

        await AssertProblemAsync(response, HttpStatusCode.UnsupportedMediaType, ErrorCodes.UnsupportedMediaType);
    }

    [Fact]
    public async Task Malformed_multipart_body_is_a_validation_error()
    {
        using var factory = CreateFactory(new FakeSpeechToText("x"));
        using var content = new StringContent("--nope\r\ngarbage with no closing boundary", System.Text.Encoding.UTF8);
        content.Headers.ContentType = MediaTypeHeaderValue.Parse("multipart/form-data; boundary=expected");

        using var response = await factory.CreateClient().PostAsync(Path, content, TestContext.Current.CancellationToken);

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, ErrorCodes.Validation);
    }

    [Fact]
    public async Task File_over_the_limit_is_payload_too_large()
    {
        var fake = new FakeSpeechToText("x");
        using var factory = CreateFactory(fake);

        using var response = await factory.CreateClient()
            .PostAsync(Path, Form("audio", "audio/wav", "big.wav", (int)TranscribeEndpoint.MaxAudioBytes + 1), TestContext.Current.CancellationToken);

        await AssertProblemAsync(response, HttpStatusCode.RequestEntityTooLarge, ErrorCodes.PayloadTooLarge);
        Assert.Equal(0, fake.Calls);
    }

    [Fact]
    public async Task File_at_the_limit_is_accepted()
    {
        var fake = new FakeSpeechToText("x");
        using var factory = CreateFactory(fake);

        using var response = await factory.CreateClient()
            .PostAsync(Path, Form("audio", "audio/wav", "big.wav", (int)TranscribeEndpoint.MaxAudioBytes), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData(StatusCodes.Status503ServiceUnavailable, ErrorCodes.SttUnavailable)]
    [InlineData(StatusCodes.Status504GatewayTimeout, ErrorCodes.SttTimeout)]
    [InlineData(StatusCodes.Status422UnprocessableEntity, ErrorCodes.AudioUnreadable)]
    public async Task Stt_failures_map_to_their_code(int status, string code)
    {
        using var factory = CreateFactory(new FakeSpeechToText(new ApiException(status, code, "failed")));

        using var response = await factory.CreateClient().PostAsync(Path, Form("audio", "audio/wav", "a.wav", 10), TestContext.Current.CancellationToken);

        await AssertProblemAsync(response, (HttpStatusCode)status, code);
    }

    [Fact]
    public async Task Transcript_text_is_never_logged_at_information_or_above()
    {
        var logs = new ConcurrentBag<(LogLevel Level, string Message)>();
        using var factory = new ApiFactory().WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<ISpeechToText>(new FakeSpeechToText(Secret));
                services.AddSingleton<ILoggerProvider>(new CapturingLoggerProvider(logs));
            });
        });

        using var response = await factory.CreateClient().PostAsync(Path, Form("audio", "audio/wav", "a.wav", 10), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(logs, entry => entry.Level == LogLevel.Information && entry.Message.Contains("Transcribed"));
        Assert.DoesNotContain(logs, entry => entry.Level >= LogLevel.Information && entry.Message.Contains(Secret));
    }

    [Fact]
    public async Task Get_is_not_allowed()
    {
        using var factory = CreateFactory(new FakeSpeechToText("x"));

        using var response = await factory.CreateClient().GetAsync(Path, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.MethodNotAllowed, response.StatusCode);
    }

    private static WebApplicationFactory<Program> CreateFactory(ISpeechToText speechToText) =>
        new ApiFactory().WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services => services.AddSingleton(speechToText)));

    private static MultipartFormDataContent Form(string field, string contentType, string fileName, int length)
    {
        var file = new ByteArrayContent(new byte[length]);
        file.Headers.ContentType = MediaTypeHeaderValue.Parse(contentType);
        return new MultipartFormDataContent { { file, field, fileName } };
    }

    private static async Task AssertProblemAsync(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        Assert.Equal(code, body.RootElement.GetProperty("code").GetString());
    }

    private sealed class FakeSpeechToText : ISpeechToText
    {
        private readonly string? _text;
        private readonly Exception? _failure;

        public FakeSpeechToText(string text) => _text = text;

        public FakeSpeechToText(Exception failure) => _failure = failure;

        public int Calls { get; private set; }

        public long ReceivedBytes { get; private set; }

        public string FileName { get; private set; } = "";

        public string ContentType { get; private set; } = "";

        public async Task<Transcription> TranscribeAsync(
            Stream audio, string fileName, string contentType, CancellationToken cancellationToken)
        {
            Calls++;
            FileName = fileName;
            ContentType = contentType;
            using var buffer = new MemoryStream();
            await audio.CopyToAsync(buffer, cancellationToken);
            ReceivedBytes = buffer.Length;
            return _failure is null ? new Transcription(_text!, 42) : throw _failure;
        }
    }

    private sealed class CapturingLoggerProvider(ConcurrentBag<(LogLevel Level, string Message)> logs) : ILoggerProvider
    {
        public ILogger CreateLogger(string categoryName) => new CapturingLogger(logs);

        public void Dispose()
        {
        }

        private sealed class CapturingLogger(ConcurrentBag<(LogLevel Level, string Message)> logs) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

            public bool IsEnabled(LogLevel logLevel) => true;

            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
                logs.Add((logLevel, formatter(state, exception)));
        }
    }
}
