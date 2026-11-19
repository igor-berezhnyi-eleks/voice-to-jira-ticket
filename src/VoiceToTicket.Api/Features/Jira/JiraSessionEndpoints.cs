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
        var deployment = settings.Deployment.ToString();
        var scheme = settings.DefaultAuthScheme(settings.Deployment).ToString();
        var serverScheme = settings.ServerAuthScheme.ToString();
        if (!settings.Enabled)
        {
            return TypedResults.Ok(new JiraStatus(false, false, null, null, deployment, scheme, serverScheme, null, null, []));
        }

        // Connected means "a valid, unexpired cookie": Jira is not called. The display name, type and sign-in come from the cookie.
        var credentials = session.Read(context);
        return TypedResults.Ok(new JiraStatus(
            true,
            credentials is not null,
            credentials?.DisplayName,
            settings.DefaultProjectKey,
            credentials?.Deployment.ToString() ?? deployment,
            credentials?.AuthScheme.ToString() ?? scheme,
            serverScheme,
            credentials?.SiteUrl,
            settings.DefaultSiteUrl,
            settings.EffectiveAllowedHosts.ToArray()));
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
        var settings = options.Value;

        // The type and sign-in the user chose; empty means the configured default. Checked before anything is sent.
        var deployment = settings.Deployment;
        if (!string.IsNullOrWhiteSpace(request.Deployment) && !JiraEnumNames.TryParse(request.Deployment, out deployment))
        {
            throw Invalid("The Jira type must be Cloud or Server.");
        }

        var scheme = settings.DefaultAuthScheme(deployment);
        if (!string.IsNullOrWhiteSpace(request.AuthScheme) && !JiraEnumNames.TryParse(request.AuthScheme, out scheme))
        {
            throw Invalid("The sign-in must be Basic or Bearer.");
        }

        if (deployment == JiraDeployment.Cloud && scheme == JiraServerAuthScheme.Bearer)
        {
            throw Invalid("Jira Cloud signs in with an email and an API token, not with a Bearer token.");
        }

        var bearer = scheme == JiraServerAuthScheme.Bearer;
        var login = request.Login?.Trim() ?? "";
        if (login.Length == 0 && !bearer)
        {
            throw Invalid("The login is required.");
        }

        // The user's address must be https and on the allowlist before anything is sent to it.
        var typed = string.IsNullOrWhiteSpace(request.SiteUrl) ? settings.DefaultSiteUrl : request.SiteUrl;
        var siteUrl = JiraSiteAddress.Resolve(typed, settings.EffectiveAllowedHosts)
            ?? throw Invalid(
                string.IsNullOrWhiteSpace(typed)
                    ? "The Jira address is required."
                    : "This Jira address is not allowed. Use an https address on a host this server allows.");

        var credentials = new JiraCredentials(bearer ? "" : login, request.Secret.Trim(), siteUrl, null, deployment, scheme);
        var user = await client.GetMyselfAsync(credentials, cancellationToken);
        session.Write(context, credentials with { DisplayName = user.DisplayName });

        // Host and type only: the path of a context-path install and the user's address are not logged.
        logger.LogInformation("Connected to Jira {JiraDeployment} at {JiraHost}", deployment, new Uri(siteUrl).Host);
        return TypedResults.Ok(new JiraSessionResponse(user.DisplayName));
    }

    private static Infrastructure.ApiException Invalid(string detail) => new(
        StatusCodes.Status400BadRequest,
        Infrastructure.ErrorCodes.Validation,
        "The request is not valid.",
        detail);

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
