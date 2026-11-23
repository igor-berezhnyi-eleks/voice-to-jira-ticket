using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using VoiceToTicket.Api.Features.Transcriptions;
using VoiceToTicket.Api.Infrastructure;
using VoiceToTicket.Api.Tests.Jira;

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

    [Theory]
    [InlineData("uk", "uk")]
    [InlineData("en", "en")]
    [InlineData("", "en")]
    public async Task The_language_field_is_passed_on(string field, string? expected)
    {
        var fake = new FakeSpeechToText("hello");
        using var factory = CreateFactory(fake);
        var form = Form("audio", "audio/webm", "voice.webm", 10);
        form.Add(new StringContent(field), "language");

        using var response = await factory.CreateClient().PostAsync(Path, form, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(expected, fake.Language);
    }

    [Fact]
    public async Task No_language_field_means_english()
    {
        var fake = new FakeSpeechToText("hello");
        using var factory = CreateFactory(fake);

        using var response = await factory.CreateClient().PostAsync(Path, Form("audio", "audio/webm", "voice.webm", 10), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("en", fake.Language);
    }

    [Theory]
    [InlineData("pl")]
    [InlineData("xx")]
    [InlineData("UK")]
    [InlineData("ukrainian")]
    public async Task An_unconfigured_language_is_400_and_the_server_is_not_called(string language)
    {
        var fake = new FakeSpeechToText("hello");
        using var factory = CreateFactory(fake);
        var form = Form("audio", "audio/webm", "voice.webm", 10);
        form.Add(new StringContent(language), "language");

        using var response = await factory.CreateClient().PostAsync(Path, form, TestContext.Current.CancellationToken);

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, ErrorCodes.Validation);
        Assert.Equal(0, fake.Calls);
    }

    [Fact]
    public async Task The_log_line_has_the_language_code()
    {
        var logs = new ConcurrentBag<(LogLevel Level, string Message)>();
        using var factory = new ApiFactory().WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<ISpeechToText>(new FakeSpeechToText(Secret));
                services.AddSingleton<ILoggerProvider>(new CapturingLoggerProvider(logs));
            }));
        var form = Form("audio", "audio/wav", "a.wav", 10);
        form.Add(new StringContent("uk"), "language");

        using var response = await factory.CreateClient().PostAsync(Path, form, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(logs, entry => entry.Level == LogLevel.Information && entry.Message.Contains("Transcribed") && entry.Message.Contains("uk"));
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
    public async Task A_full_waiting_list_is_503_stt_busy_and_the_server_is_not_called()
    {
        var fake = new BlockingSpeechToText();
        using var factory = CreateFactory(fake, ("Stt:MaxWaiting", "1"));
        var gate = factory.Services.GetRequiredService<TranscriptionGate>();
        var client = factory.CreateClient();
        var cancellationToken = TestContext.Current.CancellationToken;

        var running = client.PostAsync(Path, Form("audio", "audio/wav", "a.wav", 10), cancellationToken);
        await fake.Entered.Task.WaitAsync(TimeSpan.FromSeconds(10), cancellationToken);
        var waiting = client.PostAsync(Path, Form("audio", "audio/wav", "b.wav", 10), cancellationToken);
        await WaitUntilAsync(() => gate.Waiting("en") == 1);

        using var busy = await client.PostAsync(Path, Form("audio", "audio/wav", "c.wav", 10), cancellationToken);

        await AssertProblemAsync(busy, HttpStatusCode.ServiceUnavailable, ErrorCodes.SttBusy);
        Assert.Equal("application/problem+json", busy.Content.Headers.ContentType?.MediaType);
        Assert.Equal(1, fake.Calls);

        fake.Release.SetResult();
        using var first = await running;
        using var second = await waiting;
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.Equal(2, fake.Calls);
    }

    [Fact]
    public async Task A_request_cancelled_while_waiting_leaves_the_list()
    {
        var fake = new BlockingSpeechToText();
        using var factory = CreateFactory(fake, ("Stt:MaxWaiting", "1"));
        var gate = factory.Services.GetRequiredService<TranscriptionGate>();
        var client = factory.CreateClient();
        var cancellationToken = TestContext.Current.CancellationToken;
        var running = client.PostAsync(Path, Form("audio", "audio/wav", "a.wav", 10), cancellationToken);
        await fake.Entered.Task.WaitAsync(TimeSpan.FromSeconds(10), cancellationToken);
        using var caller = new CancellationTokenSource();
        var cancelled = client.PostAsync(Path, Form("audio", "audio/wav", "b.wav", 10), caller.Token);
        await WaitUntilAsync(() => gate.Waiting("en") == 1);

        await caller.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => cancelled);
        await WaitUntilAsync(() => gate.Waiting("en") == 0);
        // The freed place takes the next request instead of answering busy.
        var next = client.PostAsync(Path, Form("audio", "audio/wav", "c.wav", 10), cancellationToken);
        await WaitUntilAsync(() => gate.Waiting("en") == 1);
        fake.Release.SetResult();
        using var nextResponse = await next;
        Assert.Equal(HttpStatusCode.OK, nextResponse.StatusCode);
        Assert.Equal(2, fake.Calls);
        (await running).Dispose();
    }

    [Fact]
    public async Task A_busy_english_list_does_not_block_ukrainian()
    {
        var fake = new BlockingSpeechToText();
        using var factory = CreateFactory(fake, ("Stt:MaxWaiting", "1"));
        var gate = factory.Services.GetRequiredService<TranscriptionGate>();
        var client = factory.CreateClient();
        var cancellationToken = TestContext.Current.CancellationToken;

        var running = client.PostAsync(Path, Form("audio", "audio/wav", "a.wav", 10), cancellationToken);
        await fake.Entered.Task.WaitAsync(TimeSpan.FromSeconds(10), cancellationToken);
        var waiting = client.PostAsync(Path, Form("audio", "audio/wav", "b.wav", 10), cancellationToken);
        await WaitUntilAsync(() => gate.Waiting("en") == 1);
        var ukrainianForm = Form("audio", "audio/wav", "c.wav", 10);
        ukrainianForm.Add(new StringContent("uk"), "language");

        var ukrainian = client.PostAsync(Path, ukrainianForm, cancellationToken);
        await WaitUntilAsync(() => fake.Calls == 2);

        Assert.Equal("uk", fake.Language);
        fake.Release.SetResult();
        using var ukrainianResponse = await ukrainian;
        Assert.Equal(HttpStatusCode.OK, ukrainianResponse.StatusCode);
        (await running).Dispose();
        (await waiting).Dispose();
    }

    [Fact]
    public async Task Time_spent_waiting_does_not_count_toward_the_timeout()
    {
        // The real client against a server that takes 1.2 s per request, with a 2 s timeout. The second request
        // waits about 1.2 s and runs 1.2 s: 2.4 s in all, which only succeeds if the wait is not counted.
        var handler = new LambdaHandler(async (_, token) =>
        {
            await Task.Delay(TimeSpan.FromMilliseconds(1200), token);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"text\":\"done\"}", System.Text.Encoding.UTF8, "application/json"),
            };
        });
        using var factory = new ApiFactory().WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration(configuration => configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Stt:BaseUrl"] = "http://stt.test",
                ["Stt:Languages:en:TimeoutSeconds"] = "2",
            }));
            builder.ConfigureTestServices(services =>
                services.AddHttpClient<ISpeechToText, SpeachesClient>().ConfigurePrimaryHttpMessageHandler(() => handler));
        });
        var client = factory.CreateClient();
        var cancellationToken = TestContext.Current.CancellationToken;
        var clock = Stopwatch.StartNew();

        var responses = await Task.WhenAll(
            client.PostAsync(Path, Form("audio", "audio/wav", "a.wav", 10), cancellationToken),
            client.PostAsync(Path, Form("audio", "audio/wav", "b.wav", 10), cancellationToken));

        Assert.All(responses, response => Assert.Equal(HttpStatusCode.OK, response.StatusCode));
        Assert.True(clock.Elapsed > TimeSpan.FromSeconds(2), $"Both requests took {clock.Elapsed}; the second should have waited for the first.");
        foreach (var response in responses)
        {
            response.Dispose();
        }
    }

    [Fact]
    public async Task Get_is_not_allowed()
    {
        using var factory = CreateFactory(new FakeSpeechToText("x"));

        using var response = await factory.CreateClient().GetAsync(Path, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.MethodNotAllowed, response.StatusCode);
    }

    private static WebApplicationFactory<Program> CreateFactory(ISpeechToText speechToText, params (string Key, string Value)[] settings) =>
        new ApiFactory().WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration(configuration =>
                configuration.AddInMemoryCollection(settings.ToDictionary(setting => setting.Key, setting => (string?)setting.Value)));
            builder.ConfigureTestServices(services => services.AddSingleton(speechToText));
        });

    private static async Task WaitUntilAsync(Func<bool> condition)
    {
        var deadline = Stopwatch.StartNew();
        while (!condition())
        {
            Assert.True(deadline.Elapsed < TimeSpan.FromSeconds(10), "The condition was not met in time.");
            await Task.Delay(10, TestContext.Current.CancellationToken);
        }
    }

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

        public string? Language { get; private set; }

        public async Task<Transcription> TranscribeAsync(
            Stream audio, string fileName, string contentType, CancellationToken cancellationToken, string? language = null)
        {
            Calls++;
            Language = language;
            FileName = fileName;
            ContentType = contentType;
            using var buffer = new MemoryStream();
            await audio.CopyToAsync(buffer, cancellationToken);
            ReceivedBytes = buffer.Length;
            return _failure is null ? new Transcription(_text!, 42) : throw _failure;
        }
    }

    /// <summary>Holds every call until <see cref="Release"/> is set, like a server busy with a long recording.</summary>
    private sealed class BlockingSpeechToText : ISpeechToText
    {
        private int calls;

        public TaskCompletionSource Entered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public int Calls => Volatile.Read(ref calls);

        public string? Language { get; private set; }

        public async Task<Transcription> TranscribeAsync(
            Stream audio, string fileName, string contentType, CancellationToken cancellationToken, string? language = null)
        {
            Language = language;
            Interlocked.Increment(ref calls);
            Entered.TrySetResult();
            await Release.Task.WaitAsync(cancellationToken);
            return new Transcription("text", 1);
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
