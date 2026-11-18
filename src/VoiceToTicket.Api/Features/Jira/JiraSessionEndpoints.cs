using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;
using VoiceToTicket.Api.Features.Jira.Contract;

namespace VoiceToTicket.Api.Features.Jira;

public static class JiraSessionEndpoints
{
    /// <summary>The group that every Jira endpoint joins, so they share the path and the tag.</summary>
    public static RouteGroupBuilder MapJiraEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/jira").WithTags("Jira");

        group.MapGet("/status", Status).WithName("JiraStatus");
        group.MapPost("/session", Connect).WithName("JiraConnect").ProducesValidationProblem();
        group.MapDelete("/session", Disconnect).WithName("JiraDisconnect");
        group.MapJiraDiscoveryEndpoints();
        group.MapCreateIssueEndpoint();

        return group;
    }

    private static Ok<JiraStatus> Status(HttpContext context, IOptions<JiraOptions> options, JiraSession session)
    {
        var settings = options.Value;
        var (deployment, scheme) = (settings.Deployment.ToString(), settings.IsBearer ? "Bearer" : "Basic");
        if (!settings.Enabled)
        {
            return TypedResults.Ok(new JiraStatus(false, false, null, null, deployment, scheme));
        }

        // Connected means "a valid, unexpired cookie": Jira is not called. The display name comes from the cookie.
        var credentials = session.Read(context);
        return TypedResults.Ok(new JiraStatus(true, credentials is not null, credentials?.DisplayName, settings.DefaultProjectKey, deployment, scheme));
    }

    private static async Task<Ok<JiraSessionResponse>> Connect(
        JiraSessionRequest request,
        HttpContext context,
        IOptions<JiraOptions> options,
        IJiraClient client,
        JiraSession session,
        ILogger<JiraSession> logger,
        CancellationToken cancellationToken)
    {
        RequireEnabled(options);

        var login = request.Login?.Trim() ?? "";
        if (login.Length == 0 && !options.Value.IsBearer)
        {
            throw new Infrastructure.ApiException(
                StatusCodes.Status400BadRequest,
                Infrastructure.ErrorCodes.Validation,
                "The request is not valid.",
                "The login is required.");
        }

        var credentials = new JiraCredentials(options.Value.IsBearer ? "" : login, request.Secret.Trim());
        var user = await client.GetMyselfAsync(credentials, cancellationToken);
        session.Write(context, credentials with { DisplayName = user.DisplayName });

        logger.LogInformation("Connected to Jira");
        return TypedResults.Ok(new JiraSessionResponse(user.DisplayName));
    }

    private static NoContent Disconnect(HttpContext context, IOptions<JiraOptions> options, JiraSession session)
    {
        RequireEnabled(options);
        session.Clear(context);
        return TypedResults.NoContent();
    }

    private static void RequireEnabled(IOptions<JiraOptions> options)
    {
        if (!options.Value.Enabled)
        {
            throw JiraErrors.NotConfigured();
        }
    }
}
