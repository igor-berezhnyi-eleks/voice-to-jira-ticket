using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;
using VoiceToTicket.Api.Features.Jira.Contract;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Features.Jira;

/// <summary>What a project allows: projects, issue types, fields, link types and issue search (jira-plan section 4).</summary>
public static class JiraDiscoveryEndpoints
{
    private const int MaxHits = 20;

    public static RouteGroupBuilder MapJiraDiscoveryEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/projects", Projects).WithName("JiraProjects");
        group.MapGet("/projects/{key}/issue-types", IssueTypes).WithName("JiraIssueTypes");
        group.MapGet("/projects/{key}/issue-types/{id}/fields", Fields).WithName("JiraFields");
        group.MapGet("/link-types", LinkTypes).WithName("JiraLinkTypes");
        group.MapPost("/issues/search", Search).WithName("JiraIssueSearch").ProducesValidationProblem();
        return group;
    }

    private static async Task<Ok<JiraProject[]>> Projects(
        HttpContext context,
        IOptions<JiraOptions> options,
        JiraSession session,
        IJiraClient client,
        CancellationToken cancellationToken)
    {
        var credentials = Authorize(context, options, session);
        var projects = await client.GetProjectsAsync(credentials, cancellationToken);
        return TypedResults.Ok(projects.OrderBy(project => project.Name, StringComparer.OrdinalIgnoreCase).ToArray());
    }

    private static async Task<Ok<JiraIssueType[]>> IssueTypes(
        string key,
        HttpContext context,
        IOptions<JiraOptions> options,
        JiraSession session,
        IJiraClient client,
        CancellationToken cancellationToken)
    {
        var credentials = Authorize(context, options, session);
        RequireProjectKey(key);
        var types = CreateMetadataMapper.CreatableTypes(await client.GetIssueTypesAsync(credentials, key, cancellationToken));

        var preferred = options.Value.PreferredIssueTypes;
        var suggestion = IssueTypeSuggester.Suggest(types, preferred.BugNames, preferred.FeatureNames);
        var result = types
            .Select(type => new JiraIssueType(
                type.Id,
                type.Name,
                type.HierarchyLevel,
                new[] { (type.Id == suggestion.BugTypeId, "Bug"), (type.Id == suggestion.FeatureTypeId, "Feature") }
                    .Where(entry => entry.Item1)
                    .Select(entry => entry.Item2)
                    .ToArray()))
            .ToArray();
        return TypedResults.Ok(result);
    }

    private static async Task<Ok<JiraFieldsResponse>> Fields(
        string key,
        string id,
        HttpContext context,
        IOptions<JiraOptions> options,
        JiraSession session,
        IJiraClient client,
        CancellationToken cancellationToken)
    {
        var credentials = Authorize(context, options, session);
        RequireProjectKey(key);
        RequireNumericId(id);

        var types = await client.GetIssueTypesAsync(credentials, key, cancellationToken);
        var selected = types.FirstOrDefault(type => type.Id == id) ?? throw JiraErrors.NotFound();
        var fields = await client.GetCreateFieldsAsync(credentials, key, id, cancellationToken);

        return TypedResults.Ok(new JiraFieldsResponse(
            CreateMetadataMapper.MapFields(fields).ToArray(),
            CreateMetadataMapper.ParentTypeIds(types, selected)));
    }

    private static async Task<Ok<JiraLinkType[]>> LinkTypes(
        HttpContext context,
        IOptions<JiraOptions> options,
        JiraSession session,
        IJiraClient client,
        CancellationToken cancellationToken)
    {
        var credentials = Authorize(context, options, session);
        var types = await client.GetLinkTypesAsync(credentials, cancellationToken);
        var defaultName = options.Value.DefaultLinkType;

        // Only a type the site really has can be the default. A site with two names that differ by case marks the first.
        var defaultIndex = types.ToList().FindIndex(type => string.Equals(type.Name, defaultName, StringComparison.OrdinalIgnoreCase));
        return TypedResults.Ok(types.Select((type, index) => type with { IsDefault = index == defaultIndex }).ToArray());
    }

    private static async Task<Ok<JiraIssueHit[]>> Search(
        JiraIssueSearchRequest request,
        HttpContext context,
        IOptions<JiraOptions> options,
        JiraSession session,
        IJiraClient client,
        CancellationToken cancellationToken)
    {
        var credentials = Authorize(context, options, session);
        var query = JqlBuilder.Build(request.ProjectKey, request.IssueTypeIds, request.Query);

        var hits = new List<JiraIssueHit>();
        if (query.Key is { } issueKey && await FindByKeyAsync(client, credentials, issueKey, request, cancellationToken) is { } byKey)
        {
            hits.Add(byKey);
        }

        foreach (var hit in await client.SearchIssuesAsync(credentials, query.Jql, cancellationToken))
        {
            if (hits.Count < MaxHits && hits.All(existing => existing.Key != hit.Key))
            {
                hits.Add(hit);
            }
        }

        return TypedResults.Ok(hits.ToArray());
    }

    // The key is looked up on its own: a JQL clause for a missing key would make Jira reject the whole query.
    // A missing or hidden issue is "no hit"; the project and type filters apply to the found issue as well.
    private static async Task<JiraIssueHit?> FindByKeyAsync(
        IJiraClient client,
        JiraCredentials credentials,
        string issueKey,
        JiraIssueSearchRequest request,
        CancellationToken cancellationToken)
    {
        JiraIssueDetail? detail;
        try
        {
            detail = await client.GetIssueAsync(credentials, issueKey, cancellationToken);
        }
        catch (JiraApiException exception) when (exception.Code is ErrorCodes.JiraNotFound or ErrorCodes.JiraForbidden)
        {
            return null;
        }

        if (detail is null
            || (!string.IsNullOrWhiteSpace(request.ProjectKey)
                && !detail.Hit.Key.StartsWith(request.ProjectKey + "-", StringComparison.OrdinalIgnoreCase))
            || (request.IssueTypeIds is { Length: > 0 } typeIds && !typeIds.Contains(detail.IssueTypeId)))
        {
            return null;
        }

        return detail.Hit;
    }

    private static JiraCredentials Authorize(HttpContext context, IOptions<JiraOptions> options, JiraSession session)
    {
        if (!options.Value.Enabled)
        {
            throw JiraErrors.NotConfigured();
        }

        return session.Require(context);
    }

    private static void RequireProjectKey(string key)
    {
        if (!JqlBuilder.IsProjectKey(key))
        {
            throw Invalid("The project key is not valid.");
        }
    }

    private static void RequireNumericId(string id)
    {
        if (!JqlBuilder.IsNumericId(id))
        {
            throw Invalid("The issue type id is not valid.");
        }
    }

    private static ApiException Invalid(string detail) =>
        new(StatusCodes.Status400BadRequest, ErrorCodes.Validation, "The request is not valid.", detail);
}
