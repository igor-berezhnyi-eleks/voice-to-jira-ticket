using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;
using VoiceToTicket.Api.Features.Jira.Contract;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Features.Jira;

/// <summary>Creates the reviewed ticket as a Jira issue, then its links (jira-plan 4.3 and 4.4).</summary>
public static class CreateIssueEndpoint
{
    public static RouteGroupBuilder MapCreateIssueEndpoint(this RouteGroupBuilder group)
    {
        group.MapPost("/issues", HandleAsync).WithName("JiraCreateIssue").ProducesValidationProblem();
        return group;
    }

    private static async Task<Ok<CreateIssueResponse>> HandleAsync(
        CreateIssueRequest request,
        HttpContext context,
        IOptions<JiraOptions> options,
        JiraSession session,
        IJiraClient client,
        ILogger<CreateIssueRequest> logger,
        CancellationToken cancellationToken)
    {
        var credentials = JiraDiscoveryEndpoints.Authorize(context, options, session);

        // Exactly one create call: it is not idempotent, so nothing here retries it, whatever the failure.
        var created = await client.CreateIssueAsync(credentials, IssuePayloadBuilder.Build(request), cancellationToken);

        var warnings = new List<JiraIssueWarning>();
        foreach (var link in request.Links)
        {
            // "<new> blocks X": the new issue is the outward end. "<new> is blocked by X": it is the inward end.
            var (inward, outward) = link.Direction == JiraLinkDirection.Outward
                ? (link.IssueKey, created.Key)
                : (created.Key, link.IssueKey);
            try
            {
                await client.CreateLinkAsync(credentials, link.TypeName, inward, outward, cancellationToken);
            }
            catch (JiraApiException exception)
            {
                // The issue exists, so a failed link is a warning. Keys and codes only, never ticket text.
                logger.LogWarning("The link from {Key} to {LinkedKey} failed with {Code}", created.Key, link.IssueKey, exception.Code);
                warnings.Add(new JiraIssueWarning(JiraIssueWarning.LinkFailed, link.IssueKey));
            }
        }

        logger.LogInformation(
            "Created Jira issue {Key} of type {IssueTypeId} with {FieldCount} extra fields, {LinkCount} links (parent set: {ParentSet}), {FailedLinks} failed links",
            created.Key,
            request.IssueTypeId,
            request.Fields.Count,
            request.Links.Length,
            !string.IsNullOrEmpty(request.ParentKey),
            warnings.Count);

        return TypedResults.Ok(new CreateIssueResponse(created.Key, $"{options.Value.SiteUrl}/browse/{created.Key}", warnings.ToArray()));
    }
}
