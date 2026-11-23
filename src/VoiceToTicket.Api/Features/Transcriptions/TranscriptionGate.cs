using System.Collections.Frozen;
using System.Threading.RateLimiting;
using Microsoft.Extensions.Options;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Features.Transcriptions;

/// <summary>
/// One transcription per language at a time, with a short waiting list (deployment plan D24). Speaches runs one
/// worker, so a second request would only queue there and run into <c>stt_timeout</c>. Here it waits before the
/// timeout starts, and once the list is full the caller gets 503 <c>stt_busy</c> at once.
/// </summary>
public sealed class TranscriptionGate : IDisposable
{
    private readonly FrozenDictionary<string, ConcurrencyLimiter> limiters;
    private readonly int maxWaiting;
    private readonly ILogger<TranscriptionGate> logger;

    public TranscriptionGate(IOptions<SttOptions> options, ILogger<TranscriptionGate> logger)
    {
        var settings = options.Value;
        maxWaiting = settings.MaxWaiting;
        this.logger = logger;

        // Built once from the configured languages: the endpoint rejects any other code before it gets here.
        IEnumerable<string> codes = settings.Languages.Count > 0 ? settings.Languages.Keys : [SttOptions.DefaultLanguageCode];
        limiters = codes.ToFrozenDictionary(
            code => code,
            _ => new ConcurrencyLimiter(new ConcurrencyLimiterOptions
            {
                PermitLimit = 1,
                QueueLimit = maxWaiting,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            }),
            StringComparer.Ordinal);
    }

    /// <summary>Waits for the language's turn. Dispose the result when the transcription is over.</summary>
    /// <exception cref="ApiException">503 <c>stt_busy</c> when <c>Stt:MaxWaiting</c> requests are already waiting.</exception>
    /// <exception cref="OperationCanceledException">The caller cancelled while waiting; its place is freed.</exception>
    public async Task<IDisposable> EnterAsync(string language, CancellationToken cancellationToken)
    {
        if (!limiters.TryGetValue(language, out var limiter))
        {
            throw new InvalidOperationException($"No transcription gate for the language '{language}'.");
        }

        var lease = await limiter.AcquireAsync(1, cancellationToken);
        if (lease.IsAcquired)
        {
            return lease;
        }

        lease.Dispose();
        logger.LogWarning("Transcription is busy ({Language}): {MaxWaiting} requests are already waiting", language, maxWaiting);
        throw new ApiException(
            StatusCodes.Status503ServiceUnavailable,
            ErrorCodes.SttBusy,
            "Transcription is busy.",
            "Other recordings are being transcribed. Try again in a minute.");
    }

    /// <summary>Requests waiting for the language (not counting the one running). For logs and tests.</summary>
    public long Waiting(string language) =>
        limiters.TryGetValue(language, out var limiter) ? limiter.GetStatistics()?.CurrentQueuedCount ?? 0 : 0;

    public void Dispose()
    {
        foreach (var limiter in limiters.Values)
        {
            limiter.Dispose();
        }
    }
}
