using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using VoiceToTicket.Api.Features.Transcriptions;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Tests.Transcriptions;

/// <summary>Deployment plan D24 / task P3: one transcription per language, a short waiting list, then <c>stt_busy</c>.</summary>
public sealed class TranscriptionGateTests
{
    [Fact]
    public async Task The_request_after_a_full_waiting_list_is_busy_at_once()
    {
        using var gate = CreateGate(maxWaiting: 2);
        using var running = await gate.EnterAsync("en", TestContext.Current.CancellationToken);
        var first = gate.EnterAsync("en", TestContext.Current.CancellationToken);
        var second = gate.EnterAsync("en", TestContext.Current.CancellationToken);

        var exception = await Assert.ThrowsAsync<ApiException>(() => gate.EnterAsync("en", TestContext.Current.CancellationToken));

        Assert.Equal(StatusCodes.Status503ServiceUnavailable, exception.StatusCode);
        Assert.Equal(ErrorCodes.SttBusy, exception.Code);
        Assert.False(first.IsCompleted);
        Assert.False(second.IsCompleted);
        Assert.Equal(2, gate.Waiting("en"));
    }

    [Fact]
    public async Task Waiting_requests_run_one_at_a_time_in_order()
    {
        using var gate = CreateGate(maxWaiting: 2);
        var running = await gate.EnterAsync("en", TestContext.Current.CancellationToken);
        var first = gate.EnterAsync("en", TestContext.Current.CancellationToken);
        var second = gate.EnterAsync("en", TestContext.Current.CancellationToken);

        running.Dispose();
        var firstLease = await first.WaitAsync(TimeSpan.FromSeconds(5), TestContext.Current.CancellationToken);

        Assert.False(second.IsCompleted);
        firstLease.Dispose();
        (await second.WaitAsync(TimeSpan.FromSeconds(5), TestContext.Current.CancellationToken)).Dispose();
    }

    [Fact]
    public async Task A_caller_that_cancels_while_waiting_leaves_the_list()
    {
        using var gate = CreateGate(maxWaiting: 1);
        using var running = await gate.EnterAsync("en", TestContext.Current.CancellationToken);
        using var caller = new CancellationTokenSource();
        var waiting = gate.EnterAsync("en", caller.Token);
        Assert.Equal(1, gate.Waiting("en"));

        await caller.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => waiting);
        Assert.Equal(0, gate.Waiting("en"));
        // The freed place takes a new request instead of answering busy.
        var next = gate.EnterAsync("en", TestContext.Current.CancellationToken);
        Assert.False(next.IsCompleted);
        Assert.Equal(1, gate.Waiting("en"));
    }

    [Fact]
    public async Task English_and_ukrainian_have_their_own_limits()
    {
        using var gate = CreateGate(maxWaiting: 1);
        using var english = await gate.EnterAsync("en", TestContext.Current.CancellationToken);
        _ = gate.EnterAsync("en", TestContext.Current.CancellationToken);
        await Assert.ThrowsAsync<ApiException>(() => gate.EnterAsync("en", TestContext.Current.CancellationToken));

        var ukrainian = gate.EnterAsync("uk", TestContext.Current.CancellationToken);

        Assert.True(ukrainian.IsCompletedSuccessfully);
        (await ukrainian).Dispose();
    }

    [Fact]
    public async Task Without_a_languages_list_english_has_a_gate()
    {
        using var gate = new TranscriptionGate(
            Options.Create(new SttOptions { MaxWaiting = 1 }),
            NullLogger<TranscriptionGate>.Instance);

        using var lease = await gate.EnterAsync("en", TestContext.Current.CancellationToken);

        Assert.Equal(0, gate.Waiting("en"));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Options_reject_a_non_positive_waiting_list(int maxWaiting) =>
        Assert.False(new SttOptions { MaxWaiting = maxWaiting }.IsValid());

    [Fact]
    public void The_default_waiting_list_is_two() =>
        Assert.Equal(2, new SttOptions().MaxWaiting);

    private static TranscriptionGate CreateGate(int maxWaiting) => new(
        Options.Create(new SttOptions
        {
            MaxWaiting = maxWaiting,
            Languages = new Dictionary<string, SttLanguageOptions>
            {
                ["en"] = new() { Model = "en-test", TimeoutSeconds = 30 },
                ["uk"] = new() { Model = "uk-test", TimeoutSeconds = 30 },
            },
        }),
        NullLogger<TranscriptionGate>.Instance);
}
