namespace VoiceToTicket.Api.Infrastructure;

/// <summary>
/// An expected failure that maps to a specific HTTP status and ProblemDetails <c>code</c>.
/// The <see cref="Exception.Message"/> is for logs only; <paramref name="detail"/> is safe to show to clients.
/// </summary>
public class ApiException(
    int statusCode,
    string code,
    string title,
    string? detail = null,
    Exception? innerException = null)
    : Exception($"{code}: {title}", innerException)
{
    public int StatusCode { get; } = statusCode;

    public string Code { get; } = code;

    public string Title { get; } = title;

    public string? Detail { get; } = detail;
}
