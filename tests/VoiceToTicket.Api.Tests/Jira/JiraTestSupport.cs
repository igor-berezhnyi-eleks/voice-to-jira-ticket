using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using VoiceToTicket.Api.Features.Jira;

namespace VoiceToTicket.Api.Tests.Jira;

/// <summary>A clock the test moves by hand. Only the wall clock is faked; timers are real.</summary>
public sealed class ManualTimeProvider(DateTimeOffset start) : TimeProvider
{
    private DateTimeOffset now = start;

    public override DateTimeOffset GetUtcNow() => now;

    public void Advance(TimeSpan time) => now += time;
}

/// <summary>An <see cref="IJiraClient"/> that answers from a delegate and counts calls.</summary>
public sealed class FakeJiraClient(Func<JiraCredentials, JiraUser>? respond = null) : IJiraClient
{
    public int Calls { get; private set; }

    public JiraCredentials? LastCredentials { get; private set; }

    public Task<JiraUser> GetMyselfAsync(JiraCredentials credentials, CancellationToken cancellationToken)
    {
        Calls++;
        LastCredentials = credentials;
        return Task.FromResult(respond?.Invoke(credentials) ?? new JiraUser("Ada Lovelace"));
    }
}

public sealed class FailingJiraClient(Func<Exception> failure) : IJiraClient
{
    public Task<JiraUser> GetMyselfAsync(JiraCredentials credentials, CancellationToken cancellationToken) =>
        throw failure();
}

/// <summary>Collects every formatted log message, exception text included, so a test can search them.</summary>
public sealed class LogCollector : ILoggerProvider
{
    private readonly ConcurrentQueue<string> entries = new();

    public IReadOnlyCollection<string> Entries => entries;

    public ILogger CreateLogger(string categoryName) => new Collecting(entries, categoryName);

    public void Dispose()
    {
    }

    private sealed class Collecting(ConcurrentQueue<string> entries, string category) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            var text = $"{category} [{logLevel}] {formatter(state, exception)} {exception}";
            if (state is IEnumerable<KeyValuePair<string, object?>> values)
            {
                text += " " + string.Join(" ", values.Select(value => $"{value.Key}={value.Value}"));
            }

            entries.Enqueue(text);
        }
    }
}

public sealed class CapturingLogger<T> : ILogger<T>
{
    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

    public bool IsEnabled(LogLevel logLevel) => true;

    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
    {
    }
}
