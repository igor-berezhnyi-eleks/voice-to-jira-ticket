using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace VoiceToTicket.Api.Features.Jira;

/// <summary>
/// Jira Cloud REST v2 over HTTP Basic (email + API token). No retry: a create is not idempotent and decision D2
/// excludes Polly. The timeout is enforced here, not by <see cref="HttpClient.Timeout"/>, so a timeout can be told
/// apart from the caller cancelling.
/// </summary>
public sealed class JiraClient(
    HttpClient httpClient,
    IOptions<JiraOptions> options,
    TimeProvider timeProvider,
    ILogger<JiraClient> logger) : IJiraClient
{
    public async Task<JiraUser> GetMyselfAsync(JiraCredentials credentials, CancellationToken cancellationToken)
    {
        using var document = await SendAsync(HttpMethod.Get, "rest/api/2/myself", credentials, loginCheck: true, cancellationToken);
        if (document.RootElement.ValueKind == JsonValueKind.Object
            && document.RootElement.TryGetProperty("displayName", out var name)
            && name.ValueKind == JsonValueKind.String
            && !string.IsNullOrWhiteSpace(name.GetString()))
        {
            return new JiraUser(name.GetString()!);
        }

        logger.LogWarning("Jira's answer to myself had no displayName");
        throw JiraErrors.Unavailable();
    }

    // One Jira call that expects a JSON body in the answer. Later tasks add their calls through it.
    private async Task<JsonDocument> SendAsync(
        HttpMethod method,
        string path,
        JiraCredentials credentials,
        bool loginCheck,
        CancellationToken cancellationToken)
    {
        var settings = options.Value;
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(settings.TimeoutSeconds), timeProvider);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);

        using var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Basic",
            Convert.ToBase64String(Encoding.UTF8.GetBytes($"{credentials.Email}:{credentials.ApiToken}")));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        try
        {
            using var response = await httpClient.SendAsync(request, linked.Token);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Jira answered {StatusCode} to {Method} {Path}", (int)response.StatusCode, method, path);
                throw await JiraErrors.FromResponseAsync(response, loginCheck, linked.Token);
            }

            await using var body = await response.Content.ReadAsStreamAsync(linked.Token);
            return await JsonDocument.ParseAsync(body, cancellationToken: linked.Token);
        }
        catch (OperationCanceledException) when (timeout.IsCancellationRequested && !cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning("Jira did not answer within {TimeoutSeconds} s", settings.TimeoutSeconds);
            throw JiraErrors.Timeout();
        }
        catch (HttpRequestException exception)
        {
            logger.LogWarning(exception, "Jira could not be reached");
            throw JiraErrors.Unavailable(exception);
        }
        catch (JsonException exception)
        {
            // A JsonException message can quote the body: log the type only.
            logger.LogWarning("Jira sent an invalid response ({ExceptionType})", exception.GetType().Name);
            throw JiraErrors.Unavailable(exception);
        }
    }
}
