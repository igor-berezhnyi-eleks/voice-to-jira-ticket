using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using VoiceToTicket.Api.Features.Translations;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Tests.Translations;

/// <summary>Language plan section 6: <c>POST /api/translations</c> through the whole HTTP pipeline, with the fake and with a stub translator.</summary>
public sealed class TranslateEndpointTests
{
    private const string Path = "/api/translations";
    private const string Ukrainian = "Кнопка Save не працює на сторінці Invoices.";
    private const string English = "The Save button does not work on the Invoices page.";

    [Fact]
    public async Task Ukrainian_text_to_English_returns_the_planned_shape()
    {
        using var body = await PostSuccessfullyAsync(new { text = Ukrainian, to = "en" });

        Assert.Equal(
            ["text", "from", "to", "model", "durationMs"],
            body.RootElement.EnumerateObject().Select(property => property.Name));
        Assert.Equal($"[en] {Ukrainian}", body.RootElement.GetProperty("text").GetString());
        Assert.Equal("uk", body.RootElement.GetProperty("from").GetString());
        Assert.Equal("en", body.RootElement.GetProperty("to").GetString());
        Assert.Equal("fake", body.RootElement.GetProperty("model").GetString());
        Assert.True(body.RootElement.GetProperty("durationMs").GetInt64() >= 0);
    }

    [Fact]
    public async Task English_text_to_Ukrainian_is_translated()
    {
        using var body = await PostSuccessfullyAsync(new { text = English, to = "uk" });

        Assert.Equal("en", body.RootElement.GetProperty("from").GetString());
        Assert.Equal("uk", body.RootElement.GetProperty("to").GetString());
        Assert.NotEqual(English, body.RootElement.GetProperty("text").GetString());
    }

    [Theory]
    [InlineData(English, "en")]
    [InlineData(Ukrainian, "uk")]
    public async Task Text_already_in_the_target_language_comes_back_unchanged(string text, string to)
    {
        using var body = await PostSuccessfullyAsync(new { text, to });

        Assert.Equal(text, body.RootElement.GetProperty("text").GetString());
        Assert.Equal(to, body.RootElement.GetProperty("from").GetString());
        Assert.Equal(to, body.RootElement.GetProperty("to").GetString());
    }

    [Fact]
    public async Task A_target_with_spaces_around_it_is_accepted()
    {
        using var body = await PostSuccessfullyAsync(new { text = English, to = " uk " });

        Assert.Equal("uk", body.RootElement.GetProperty("to").GetString());
    }

    [Theory]
    [InlineData(1)]
    [InlineData(20_000)]
    public async Task Length_limits_are_inclusive(int length)
    {
        using var body = await PostSuccessfullyAsync(new { text = new string('a', length), to = "uk" });

        Assert.Equal("uk", body.RootElement.GetProperty("to").GetString());
    }

    public static TheoryData<string, string> InvalidRequests => new()
    {
        { """{"text":"","to":"en"}""", "Text" },
        { """{"text":"   ","to":"en"}""", "Text" },
        { """{"to":"en"}""", "Text" },
        { """{"text":"hello","to":""}""", "To" },
        { """{"text":"hello","to":"  "}""", "To" },
        { """{"text":"hello"}""", "To" },
        { """{"text":null,"to":"en"}""", "Text" },
    };

    [Theory]
    [MemberData(nameof(InvalidRequests))]
    public async Task A_missing_or_blank_field_is_400_validation(string json, string field)
    {
        using var response = await PostJsonAsync(json);

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, ErrorCodes.Validation);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        Assert.True(body.RootElement.GetProperty("errors").TryGetProperty(field, out _));
    }

    [Fact]
    public async Task Text_over_the_limit_is_400_validation()
    {
        using var response = await PostJsonAsync(JsonSerializer.Serialize(new { text = new string('a', 20_001), to = "en" }));

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, ErrorCodes.Validation);
    }

    [Theory]
    [InlineData("pl")]
    [InlineData("xx")]
    [InlineData("EN")]
    [InlineData("english")]
    public async Task A_language_that_is_not_configured_is_400_validation_and_nothing_is_translated(string to)
    {
        var translator = new StubTranslator(new TranslatorReply("uk", "x", "stub"));
        await using var factory = WithTranslator(translator);
        using var client = factory.CreateClient();

        using var response = await client.PostAsJsonAsync(Path, new { text = English, to }, TestContext.Current.CancellationToken);

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, ErrorCodes.Validation);
        Assert.Equal(0, translator.Calls);
    }

    [Fact]
    public async Task A_broken_json_body_is_400()
    {
        using var response = await PostJsonAsync("{not json");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_translation_that_goes_neither_to_nor_from_English_is_422_translation_pair_unsupported()
    {
        // The configured languages are en and uk, so a page cannot ask for this; the rule guards a later third language.
        await using var factory = WithTranslator(new StubTranslator(new TranslatorReply("de", "Übersetzung", "stub")), ("Stt:Languages:pl:Model", "m"), ("Stt:Languages:pl:TimeoutSeconds", "10"));
        using var client = factory.CreateClient();

        using var response = await client.PostAsJsonAsync(Path, new { text = "Hallo", to = "pl" }, TestContext.Current.CancellationToken);

        await AssertProblemAsync(response, HttpStatusCode.UnprocessableEntity, ErrorCodes.TranslationPairUnsupported);
    }

    [Fact]
    public async Task The_same_non_English_language_on_both_sides_is_returned_unchanged_not_refused()
    {
        await using var factory = WithTranslator(new StubTranslator(new TranslatorReply("pl", "changed", "stub")), ("Stt:Languages:pl:Model", "m"), ("Stt:Languages:pl:TimeoutSeconds", "10"));
        using var client = factory.CreateClient();

        using var response = await client.PostAsJsonAsync(Path, new { text = "Cześć", to = "pl" }, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        Assert.Equal("Cześć", body.RootElement.GetProperty("text").GetString());
    }

    [Fact]
    public async Task A_translator_failure_keeps_its_status_and_code()
    {
        var failure = new ApiException(StatusCodes.Status504GatewayTimeout, ErrorCodes.LlmTimeout, "The model took too long to answer.");
        await using var factory = WithTranslator(new StubTranslator(failure));
        using var client = factory.CreateClient();

        using var response = await client.PostAsJsonAsync(Path, new { text = English, to = "uk" }, TestContext.Current.CancellationToken);

        await AssertProblemAsync(response, HttpStatusCode.GatewayTimeout, ErrorCodes.LlmTimeout);
    }

    [Fact]
    public async Task The_log_has_lengths_languages_and_duration_but_never_the_text()
    {
        var logs = new CapturingLoggerProvider();
        await using var factory = new ApiFactory("Production").WithWebHostBuilder(builder =>
            builder.ConfigureLogging(logging => logging.AddProvider(logs)));
        using var client = factory.CreateClient();

        const string text = "SECRET Кнопка зберегти не працює на сторінці рахунків";
        using var response = await client.PostAsJsonAsync(Path, new { text, to = "en" }, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var entries = logs.Entries.ToArray();
        Assert.Contains(entries, entry => entry.Contains("from uk to en", StringComparison.Ordinal) && entry.Contains($"{text.Length} characters", StringComparison.Ordinal));
        Assert.DoesNotContain(entries, entry => entry.Contains("SECRET", StringComparison.Ordinal) || entry.Contains("кнопку", StringComparison.Ordinal));
    }

    [Fact]
    public async Task The_endpoint_is_documented_in_the_openapi_document()
    {
        await using var factory = new ApiFactory("Development");
        using var client = factory.CreateClient();

        var document = await client.GetStringAsync("/openapi/v1.json", TestContext.Current.CancellationToken);

        Assert.Contains("\"/api/translations\"", document, StringComparison.Ordinal);
    }

    private static async Task<JsonDocument> PostSuccessfullyAsync(object request)
    {
        await using var factory = new ApiFactory("Production");
        using var client = factory.CreateClient();

        using var response = await client.PostAsJsonAsync(Path, request, TestContext.Current.CancellationToken);

        var content = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Assert.True(response.StatusCode == HttpStatusCode.OK, $"{(int)response.StatusCode}: {content}");
        return JsonDocument.Parse(content);
    }

    private static async Task<HttpResponseMessage> PostJsonAsync(string json)
    {
        await using var factory = new ApiFactory("Production");
        using var client = factory.CreateClient();
        using var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
        return await client.PostAsync(Path, content, TestContext.Current.CancellationToken);
    }

    private static async Task AssertProblemAsync(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        Assert.Equal(code, body.RootElement.GetProperty("code").GetString());
    }

    private static WebApplicationFactory<Program> WithTranslator(StubTranslator translator, params (string Key, string Value)[] settings) =>
        new ApiFactory("Production").WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration(configuration =>
                configuration.AddInMemoryCollection(settings.ToDictionary(setting => setting.Key, setting => (string?)setting.Value)));
            builder.ConfigureTestServices(services =>
                services.AddSingleton<ITranslator>(translator));
        });

    private sealed class StubTranslator : ITranslator
    {
        private readonly TranslatorReply? _reply;
        private readonly Exception? _failure;

        public StubTranslator(TranslatorReply reply) => _reply = reply;

        public StubTranslator(Exception failure) => _failure = failure;

        public int Calls { get; private set; }

        public Task<TranslatorReply> TranslateAsync(string text, string to, CancellationToken cancellationToken)
        {
            Calls++;
            return _failure is null ? Task.FromResult(_reply!) : throw _failure;
        }
    }

    private sealed class CapturingLoggerProvider : ILoggerProvider
    {
        public ConcurrentQueue<string> Entries { get; } = new();

        public ILogger CreateLogger(string categoryName) => new CapturingLogger(Entries);

        public void Dispose()
        {
        }

        private sealed class CapturingLogger(ConcurrentQueue<string> entries) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

            public bool IsEnabled(LogLevel logLevel) => true;

            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
                entries.Enqueue($"{logLevel}: {formatter(state, exception)}");
        }
    }
}
