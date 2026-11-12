using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using VoiceToTicket.Api.Features.Jira;
using VoiceToTicket.Api.Features.Jira.Contract;

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

    public IReadOnlyList<JiraProject> Projects { get; set; } = [];

    public IReadOnlyList<JiraIssueTypeInfo> IssueTypes { get; set; } = [];

    public IReadOnlyList<CreateMetaField> Fields { get; set; } = [];

    public IReadOnlyList<JiraLinkType> LinkTypes { get; set; } = [];

    public IReadOnlyList<JiraIssueHit> SearchHits { get; set; } = [];

    public Dictionary<string, JiraIssueDetail> Issues { get; } = [];

    /// <summary>Set to make <see cref="GetIssueAsync"/> throw, as a hidden issue would.</summary>
    public Func<Exception>? IssueFailure { get; set; }

    /// <summary>Set to make every discovery call throw (the login check still works, so a test can connect first).</summary>
    public Func<Exception>? Failure { get; set; }

    public List<string> SearchedJql { get; } = [];

    public List<string> LookedUpKeys { get; } = [];

    public Task<JiraUser> GetMyselfAsync(JiraCredentials credentials, CancellationToken cancellationToken)
    {
        Calls++;
        LastCredentials = credentials;
        return Task.FromResult(respond?.Invoke(credentials) ?? new JiraUser("Ada Lovelace"));
    }

    public Task<IReadOnlyList<JiraProject>> GetProjectsAsync(JiraCredentials credentials, CancellationToken cancellationToken)
    {
        Calls++;
        if (Failure is not null)
        {
            throw Failure();
        }

        LastCredentials = credentials;
        return Task.FromResult(Projects);
    }

    public Task<IReadOnlyList<JiraIssueTypeInfo>> GetIssueTypesAsync(JiraCredentials credentials, string projectKey, CancellationToken cancellationToken)
    {
        Calls++;
        if (Failure is not null)
        {
            throw Failure();
        }

        return Task.FromResult(IssueTypes);
    }

    public Task<IReadOnlyList<CreateMetaField>> GetCreateFieldsAsync(JiraCredentials credentials, string projectKey, string issueTypeId, CancellationToken cancellationToken)
    {
        Calls++;
        if (Failure is not null)
        {
            throw Failure();
        }

        return Task.FromResult(Fields);
    }

    public Task<IReadOnlyList<JiraLinkType>> GetLinkTypesAsync(JiraCredentials credentials, CancellationToken cancellationToken)
    {
        Calls++;
        if (Failure is not null)
        {
            throw Failure();
        }

        return Task.FromResult(LinkTypes);
    }

    public Task<IReadOnlyList<JiraIssueHit>> SearchIssuesAsync(JiraCredentials credentials, string jql, CancellationToken cancellationToken)
    {
        Calls++;
        if (Failure is not null)
        {
            throw Failure();
        }

        SearchedJql.Add(jql);
        return Task.FromResult(SearchHits);
    }

    public Task<JiraIssueDetail?> GetIssueAsync(JiraCredentials credentials, string issueKey, CancellationToken cancellationToken)
    {
        Calls++;
        LookedUpKeys.Add(issueKey);
        if (Failure is not null)
        {
            throw Failure();
        }

        if (IssueFailure is not null)
        {
            throw IssueFailure();
        }

        return Task.FromResult(Issues.GetValueOrDefault(issueKey));
    }
}

public sealed class FailingJiraClient(Func<Exception> failure) : IJiraClient
{
    public Task<JiraUser> GetMyselfAsync(JiraCredentials credentials, CancellationToken cancellationToken) =>
        throw failure();

    public Task<IReadOnlyList<JiraProject>> GetProjectsAsync(JiraCredentials credentials, CancellationToken cancellationToken) =>
        throw failure();

    public Task<IReadOnlyList<JiraIssueTypeInfo>> GetIssueTypesAsync(JiraCredentials credentials, string projectKey, CancellationToken cancellationToken) =>
        throw failure();

    public Task<IReadOnlyList<CreateMetaField>> GetCreateFieldsAsync(JiraCredentials credentials, string projectKey, string issueTypeId, CancellationToken cancellationToken) =>
        throw failure();

    public Task<IReadOnlyList<JiraLinkType>> GetLinkTypesAsync(JiraCredentials credentials, CancellationToken cancellationToken) =>
        throw failure();

    public Task<IReadOnlyList<JiraIssueHit>> SearchIssuesAsync(JiraCredentials credentials, string jql, CancellationToken cancellationToken) =>
        throw failure();

    public Task<JiraIssueDetail?> GetIssueAsync(JiraCredentials credentials, string issueKey, CancellationToken cancellationToken) =>
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
