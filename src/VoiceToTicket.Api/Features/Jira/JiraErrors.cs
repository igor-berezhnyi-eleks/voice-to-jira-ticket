using System.Net;
using System.Text.Json;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Features.Jira;

/// <summary>Jira status code to <see cref="ApiException"/> (jira-plan section 6).</summary>
public static class JiraErrors
{
    private const int MaxMessages = 20;
    private const int MaxMessageLength = 500;

    public static JiraApiException NotConfigured() => new(
        StatusCodes.Status404NotFound,
        ErrorCodes.JiraNotConfigured,
        "Jira is not configured.",
        "Jira integration is switched off for this server.");

    public static JiraApiException AuthRequired() => new(
        StatusCodes.Status401Unauthorized,
        ErrorCodes.JiraAuthRequired,
        "Connect to Jira first.",
        "There is no Jira session, or it has expired.");

    public static JiraApiException NotFound() => new(
        StatusCodes.Status404NotFound,
        ErrorCodes.JiraNotFound,
        "Jira could not find it.",
        "The project or issue does not exist, or your account cannot see it.");

    public static JiraApiException Timeout() => new(
        StatusCodes.Status504GatewayTimeout,
        ErrorCodes.JiraTimeout,
        "Jira did not answer in time.",
        "Jira took too long to answer.");

    public static JiraApiException Unavailable(Exception? inner = null) => new(
        StatusCodes.Status502BadGateway,
        ErrorCodes.JiraUnavailable,
        "Jira is unavailable.",
        "Jira could not be reached or gave an unusable answer.",
        innerException: inner);

    /// <param name="response">A non-success answer from Jira.</param>
    /// <param name="loginCheck">True for the call that checks a new email and token: a 401 there is <c>jira_auth_denied</c>.</param>
    /// <param name="cancellationToken">Cancels reading the body.</param>
    public static async Task<JiraApiException> FromResponseAsync(
        HttpResponseMessage response,
        bool loginCheck,
        CancellationToken cancellationToken)
    {
        switch (response.StatusCode)
        {
            case HttpStatusCode.Unauthorized when loginCheck:
                return new(
                    StatusCodes.Status401Unauthorized,
                    ErrorCodes.JiraAuthDenied,
                    "Jira did not accept this email and token.",
                    "Check the email and the API token. Use a token without scopes.");
            case HttpStatusCode.Unauthorized:
                return AuthRequired();
            case HttpStatusCode.Forbidden:
                return new(
                    StatusCodes.Status403Forbidden,
                    ErrorCodes.JiraForbidden,
                    "Jira refused this action.",
                    "Your Jira account does not have permission for this.");
            case HttpStatusCode.NotFound:
                return new(
                    StatusCodes.Status404NotFound,
                    ErrorCodes.JiraNotFound,
                    "Jira could not find it.",
                    "The project or issue does not exist, or your account cannot see it.");
            case HttpStatusCode.BadRequest:
            case HttpStatusCode.UnprocessableEntity:
                return new(
                    StatusCodes.Status422UnprocessableEntity,
                    ErrorCodes.JiraRejected,
                    "Jira rejected the request.",
                    extensions: await ReadRejectionAsync(response, cancellationToken));
            case HttpStatusCode.TooManyRequests:
                var extensions = new Dictionary<string, object?>();
                if (response.Headers.RetryAfter?.Delta is { } delta)
                {
                    extensions["retryAfterSeconds"] = (int)Math.Ceiling(delta.TotalSeconds);
                }

                return new(
                    StatusCodes.Status503ServiceUnavailable,
                    ErrorCodes.JiraRateLimited,
                    "Jira is busy.",
                    "Jira is limiting requests. Try again in a moment.",
                    extensions);
            default:
                return Unavailable();
        }
    }

    // Jira's body is {"errorMessages": [...], "errors": {"fieldId": "message"}}. Anything else is dropped.
    private static async Task<IReadOnlyDictionary<string, object?>> ReadRejectionAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string>();
        var errorMessages = new List<string>();
        try
        {
            await using var body = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var document = await JsonDocument.ParseAsync(body, cancellationToken: cancellationToken);
            if (document.RootElement.ValueKind == JsonValueKind.Object)
            {
                if (document.RootElement.TryGetProperty("errors", out var fields) && fields.ValueKind == JsonValueKind.Object)
                {
                    foreach (var field in fields.EnumerateObject().Take(MaxMessages))
                    {
                        if (field.Value.ValueKind == JsonValueKind.String)
                        {
                            errors[field.Name] = Truncate(field.Value.GetString()!);
                        }
                    }
                }

                if (document.RootElement.TryGetProperty("errorMessages", out var messages) && messages.ValueKind == JsonValueKind.Array)
                {
                    errorMessages.AddRange(messages.EnumerateArray()
                        .Where(message => message.ValueKind == JsonValueKind.String)
                        .Take(MaxMessages)
                        .Select(message => Truncate(message.GetString()!)));
                }
            }
        }
        catch (JsonException)
        {
            // An unreadable body still means "rejected"; the lists stay empty.
        }

        return new Dictionary<string, object?> { ["errors"] = errors, ["errorMessages"] = errorMessages };
    }

    private static string Truncate(string text) => text.Length <= MaxMessageLength ? text : text[..MaxMessageLength];
}
