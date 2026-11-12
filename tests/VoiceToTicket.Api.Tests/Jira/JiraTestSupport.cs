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

    /// <summary>The bodies sent to create, in order.</summary>
    public List<System.Text.Json.Nodes.JsonObject> Created { get; } = [];

    /// <summary>The links made, as (type, inward key, outward key).</summary>
    public List<(string Type, string Inward, string Outward)> Links { get; } = [];

    public string NextKey { get; set; } = "SCRUM-124";

    /// <summary>Set to make the create throw.</summary>
    public Func<Exception>? CreateFailure { get; set; }

    /// <summary>Called with the other end's key for each link; may throw to fail that link.</summary>
    public Action<string>? OnLink { get; set; }

    public Task<JiraCreatedIssue> CreateIssueAsync(JiraCredentials credentials, System.Text.Json.Nodes.JsonObject payload, CancellationToken cancellationToken)
    {
        Calls++;
        Created.Add(payload);
        if (CreateFailure is not null)
        {
            throw CreateFailure();
        }

        return Task.FromResult(new JiraCreatedIssue("10050", NextKey));
    }

    public Task CreateLinkAsync(JiraCredentials credentials, string typeName, string inwardKey, string outwardKey, CancellationToken cancellationToken)
    {
        Calls++;
        Links.Add((typeName, inwardKey, outwardKey));
        OnLink?.Invoke(inwardKey == NextKey ? outwardKey : inwardKey);
        return Task.CompletedTask;
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

    public Task<JiraCreatedIssue> CreateIssueAsync(JiraCredentials credentials, System.Text.Json.Nodes.JsonObject payload, CancellationToken cancellationToken) =>
        throw failure();

    public Task CreateLinkAsync(JiraCredentials credentials, string typeName, string inwardKey, string outwardKey, CancellationToken cancellationToken) =>
        throw failure();
}

/// <summary>An HTTP handler that answers from a delegate, which may wait for the cancellation token.</summary>
public sealed class LambdaHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> respond) : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
        respond(request, cancellationToken);
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
