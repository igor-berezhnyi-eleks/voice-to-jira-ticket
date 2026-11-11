using System.Net;
using Microsoft.Extensions.Options;

namespace VoiceToJira.Api.Features.Jira;

public static class JiraEndpoints
{
    public static IEndpointRouteBuilder MapJiraEndpoints(this IEndpointRouteBuilder routes)
    {
        var jira = routes.MapGroup("/jira");
        jira.MapPost("/login", LoginAsync).WithName("JiraLogin").WithSummary("Check the user's Atlassian email + API token and keep them in an encrypted cookie.");
        jira.MapPost("/logout", Logout).WithName("JiraLogout");
        jira.MapGet("/boards", BoardsAsync).WithName("JiraBoards");
        jira.MapGet("/parents", ParentsAsync).WithName("JiraParents").WithSummary("Epics (Feature) or Stories (Bug) of a project.");
        jira.MapGet("/issue-types", IssueTypesAsync).WithName("JiraIssueTypes").WithSummary("Issue types of a project and the one matching the Bug/Feature mapping.");
        jira.MapPost("/issues", CreateIssueAsync).WithName("JiraCreateIssue");
        return routes;
    }

    private static async Task<IResult> LoginAsync(
        LoginRequest request, JiraClient client, JiraSession session, HttpContext context, CancellationToken cancellationToken)
    {
        var email = request.Email?.Trim() ?? string.Empty;
        var apiToken = request.ApiToken?.Trim() ?? string.Empty;
        var errors = new Dictionary<string, string[]>();
        if (!JiraCredentials.TryNormalizeBaseUrl(request.BaseUrl, out var baseUrl))
        {
            errors["baseUrl"] = ["Enter your Jira Cloud site, for example https://your-site.atlassian.net."];
        }

        if (email.Length == 0)
        {
            errors["email"] = ["The email is empty."];
        }

        if (apiToken.Length == 0)
        {
            errors["apiToken"] = ["The API token is empty."];
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var credentials = new JiraCredentials(baseUrl, email, apiToken);
        try
        {
            var name = await client.GetDisplayNameAsync(credentials, cancellationToken);
            session.Write(context, credentials);
            return TypedResults.Ok(new { displayName = name });
        }
        catch (JiraException ex)
        {
            return ex.StatusCode is 401 or 403
                ? TypedResults.Problem(title: "Jira login failed.", detail: "Jira rejected the email or API token.", statusCode: StatusCodes.Status401Unauthorized)
                : Failure(ex);
        }
    }

    private static IResult Logout(JiraSession session, HttpContext context)
    {
        session.Clear(context);
        return TypedResults.NoContent();
    }

    private static Task<IResult> BoardsAsync(
        string? name, JiraClient client, JiraSession session, HttpContext context, CancellationToken cancellationToken) =>
        WithJiraAsync(session, context, async credentials => TypedResults.Ok(await client.GetBoardsAsync(credentials, name, cancellationToken)));

    private static Task<IResult> ParentsAsync(
        string? projectKey, string? type, string? q, JiraClient client, JiraSession session, IOptions<JiraOptions> options, HttpContext context,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(projectKey) || type is not ("Bug" or "Feature"))
        {
            return Task.FromResult<IResult>(TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["projectKey"] = ["projectKey is required and type must be Bug or Feature."],
            }));
        }

        // A Feature (Story) hangs under an Epic; a Bug is linked to a Story.
        var parentType = type == "Feature" ? "Epic" : options.Value.IssueType("Feature");
        return WithJiraAsync(session, context, async credentials =>
            TypedResults.Ok(await client.SearchParentsAsync(credentials, projectKey.Trim(), parentType, q, cancellationToken)));
    }

    private static Task<IResult> IssueTypesAsync(
        string? projectKey, string? type, JiraClient client, JiraSession session, IOptions<JiraOptions> options, HttpContext context,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(projectKey) || type is not ("Bug" or "Feature"))
        {
            return Task.FromResult<IResult>(TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["projectKey"] = ["projectKey is required and type must be Bug or Feature."],
            }));
        }

        return WithJiraAsync(session, context, async credentials =>
        {
            var available = await client.GetIssueTypesAsync(credentials, projectKey.Trim(), cancellationToken);
            var wanted = options.Value.IssueType(type);
            var suggested = available.FirstOrDefault(name => name.Equals(wanted, StringComparison.OrdinalIgnoreCase));
            return TypedResults.Ok(new IssueTypeChoices(available, suggested));
        });
    }

    private static Task<IResult> CreateIssueAsync(
        CreateIssueRequest request, JiraClient client, JiraSession session, IOptions<JiraOptions> options, ILogger<JiraClient> logger,
        HttpContext context, CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        if (request.Type is not ("Bug" or "Feature"))
        {
            errors["type"] = ["The type must be Bug or Feature."];
        }

        if (string.IsNullOrWhiteSpace(request.Title))
        {
            errors["title"] = ["The title is empty."];
        }

        if (string.IsNullOrWhiteSpace(request.Description))
        {
            errors["description"] = ["The description is empty."];
        }

        if (string.IsNullOrWhiteSpace(request.ProjectKey))
        {
            errors["projectKey"] = ["Pick a board first."];
        }

        if (errors.Count > 0)
        {
            return Task.FromResult<IResult>(TypedResults.ValidationProblem(errors));
        }

        var parentKey = string.IsNullOrWhiteSpace(request.ParentKey) ? null : request.ParentKey.Trim();
        var isFeature = request.Type == "Feature";
        var issue = new NewIssue(
            request.ProjectKey!.Trim(),
            string.IsNullOrWhiteSpace(request.IssueType) ? options.Value.IssueType(request.Type!) : request.IssueType.Trim(),
            request.Title!.Trim(),
            request.Description!,
            isFeature ? parentKey : null,
            isFeature ? null : parentKey);

        return WithJiraAsync(session, context, async credentials =>
        {
            var created = await client.CreateIssueAsync(credentials, issue, cancellationToken);
            logger.LogInformation("Jira issue {Key} created by {Email}.", created.Key, credentials.Email);
            return TypedResults.Ok(created);
        });
    }

    // Runs a Jira call with the cookie credentials; maps Jira failures to ProblemDetails.
    private static async Task<IResult> WithJiraAsync(
        JiraSession session, HttpContext context, Func<JiraCredentials, Task<IResult>> call)
    {
        if (session.Read(context) is not { } credentials)
        {
            return TypedResults.Problem(title: "Not connected to Jira.", detail: "Log in to Jira first.", statusCode: StatusCodes.Status401Unauthorized);
        }

        try
        {
            return await call(credentials);
        }
        catch (JiraException ex) when (ex.StatusCode == (int)HttpStatusCode.Unauthorized)
        {
            session.Clear(context);
            return TypedResults.Problem(title: "Jira session expired.", detail: "Log in to Jira again.", statusCode: StatusCodes.Status401Unauthorized);
        }
        catch (JiraException ex)
        {
            return Failure(ex);
        }
    }

    private static IResult Failure(JiraException ex)
    {
        if (ex.StatusCode == (int)HttpStatusCode.BadRequest && ex.Errors.Count > 0)
        {
            // Jira field ids are shown under the form field with the same meaning (summary → title).
            return TypedResults.ValidationProblem(ex.Errors.ToDictionary(e => e.Key == "summary" ? "title" : e.Key, e => new[] { e.Value }));
        }

        var status = ex.StatusCode == (int)HttpStatusCode.GatewayTimeout ? StatusCodes.Status504GatewayTimeout : StatusCodes.Status502BadGateway;
        return TypedResults.Problem(title: "Jira request failed.", detail: ex.Message, statusCode: status);
    }
}
