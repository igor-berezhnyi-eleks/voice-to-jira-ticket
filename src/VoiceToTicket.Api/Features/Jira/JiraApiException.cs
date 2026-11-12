using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Features.Jira;

/// <summary>An <see cref="ApiException"/> that also carries ProblemDetails extensions (field errors, retry hint).</summary>
public sealed class JiraApiException(
    int statusCode,
    string code,
    string title,
    string? detail = null,
    IReadOnlyDictionary<string, object?>? extensions = null,
    Exception? innerException = null)
    : ApiException(statusCode, code, title, detail, innerException)
{
    public IReadOnlyDictionary<string, object?> Extensions { get; } = extensions ?? new Dictionary<string, object?>();
}
