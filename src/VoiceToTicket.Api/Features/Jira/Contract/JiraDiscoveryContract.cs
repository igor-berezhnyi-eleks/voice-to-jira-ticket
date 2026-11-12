using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace VoiceToTicket.Api.Features.Jira.Contract;

public sealed record JiraProject(string Key, string Name);

/// <param name="SuggestedFor">The ticket types (<c>Bug</c>, <c>Feature</c>) this issue type is suggested for. Usually empty or one.</param>
public sealed record JiraIssueType(string Id, string Name, int HierarchyLevel, string[] SuggestedFor);

public sealed record JiraAllowedValue(string Id, string Name);

/// <summary>How the web renders and fills a field (jira-plan 4.2). <c>Unsupported</c> fields cannot be filled by this app.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<JiraFieldKind>))]
public enum JiraFieldKind
{
    [JsonStringEnumMemberName("text")] Text,
    [JsonStringEnumMemberName("textarea")] Textarea,
    [JsonStringEnumMemberName("number")] Number,
    [JsonStringEnumMemberName("date")] Date,
    [JsonStringEnumMemberName("option")] Option,
    [JsonStringEnumMemberName("options")] Options,
    [JsonStringEnumMemberName("labels")] Labels,
    [JsonStringEnumMemberName("unsupported")] Unsupported,
}

/// <param name="AllowedValues">Set for <c>option</c> and <c>options</c> only; null otherwise.</param>
public sealed record JiraField(
    string FieldId,
    string Name,
    bool Required,
    bool HasDefaultValue,
    JiraFieldKind Kind,
    JiraAllowedValue[]? AllowedValues);

/// <param name="ParentTypeIds">Issue types one hierarchy level above the chosen type. Empty: no Parent control.</param>
public sealed record JiraFieldsResponse(JiraField[] Fields, string[] ParentTypeIds);

public sealed record JiraLinkType(string Name, string Inward, string Outward, bool IsDefault);

public sealed record JiraIssueSearchRequest(
    [StringLength(50)] string? ProjectKey,
    [MaxLength(20)] string[]? IssueTypeIds,
    [StringLength(500)] string? Query);

public sealed record JiraIssueHit(string Key, string Summary, string IssueType, string Status);
