using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text.Json;

namespace VoiceToTicket.Api.Tests.Transcriptions;

/// <summary>
/// Plan 4.10: a synthetic fixture through the real endpoint to the real STT container.
/// Run with the container up: <c>VTT_RUN_STT=1 dotnet test --filter "Category=Stt"</c>.
/// The Development settings point <c>Stt:BaseUrl</c> at http://localhost:8000.
/// </summary>
[Trait("Category", "Stt")]
public sealed class SttSmokeTests
{
    [Theory]
    [InlineData("bug-login-crash.wav", new[] { "login", "crashes", "update", "home screen" })]
    [InlineData("feature-dark-mode.wav", new[] { "dark mode", "settings", "themes", "remembered" })]
    public async Task Fixture_transcript_contains_its_key_words(string fixture, string[] keyWords)
    {
        Assert.SkipUnless(Environment.GetEnvironmentVariable("VTT_RUN_STT") == "1", "Set VTT_RUN_STT=1 and start the stt container.");

        using var factory = new ApiFactory();
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(await File.ReadAllBytesAsync(FixturePath(fixture), TestContext.Current.CancellationToken));
        file.Headers.ContentType = MediaTypeHeaderValue.Parse("audio/wav");
        form.Add(file, "audio", fixture);

        var timer = Stopwatch.StartNew();
        using var response = await factory.CreateClient()
            .PostAsync("/api/transcriptions", form, TestContext.Current.CancellationToken);
        timer.Stop();

        var json = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Assert.True(response.IsSuccessStatusCode, json);
        using var body = JsonDocument.Parse(json);
        var text = body.RootElement.GetProperty("text").GetString()!;
        foreach (var word in keyWords)
        {
            Assert.Contains(word, text, StringComparison.OrdinalIgnoreCase);
        }

        TestContext.Current.SendDiagnosticMessage($"{fixture}: {timer.ElapsedMilliseconds} ms");
    }

    private static string FixturePath(string name)
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            var candidate = System.IO.Path.Combine(directory.FullName, "tests", "fixtures", "audio", name);
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        throw new FileNotFoundException($"Fixture {name} not found above {AppContext.BaseDirectory}.");
    }
}
