using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace VoiceToTicket.Api.Features.Jira.Contract;

/// <summary>Which end of the link the new issue is: <c>outward</c> ("new blocks X") or <c>inward</c> ("new is blocked by X").</summary>
[JsonConverter(typeof(JsonStringEnumConverter<JiraLinkDirection>))]
public enum JiraLinkDirection
{
    [JsonStringEnumMemberName("outward")] Outward,
    [JsonStringEnumMemberName("inward")] Inward,
}

public sealed record JiraIssueLinkRequest(
    [Required, StringLength(255)] string TypeName,
    JiraLinkDirection Direction,
    [Required, RegularExpression(CreateIssueRequest.IssueKeyPattern)] string IssueKey);

/// <summary>A problem that did not stop the issue from being created. <c>IssueKey</c> is the other end of the failed link.</summary>
public sealed record JiraIssueWarning(string Code, string IssueKey)
{
    /// <summary>A warning, not an error code: the issue was created, so the response is 200.</summary>
    public const string LinkFailed = "jira_link_failed";
}

public sealed record CreateIssueResponse(string Key, string Url, JiraIssueWarning[] Warnings);

/// <summary>
/// What Page 3 sends (jira-plan 4.3). Limits are checked by the built-in validation: DataAnnotations for the simple
/// ones and <see cref="Validate"/> for the field map, the field values and the link count.
/// </summary>
public sealed record CreateIssueRequest(
    [Required, RegularExpression(CreateIssueRequest.ProjectKeyPattern)] string ProjectKey,
    [Required, RegularExpression(@"^\d{1,18}$")] string IssueTypeId,
    [Required, StringLength(CreateIssueRequest.MaxSummaryLength)] string Summary,
    [Required(AllowEmptyStrings = true), StringLength(CreateIssueRequest.MaxTextLength)] string Description,
    [RegularExpression(CreateIssueRequest.IssueKeyPattern)] string? ParentKey,
    [Required] Dictionary<string, FieldValue> Fields,
    [Required] JiraIssueLinkRequest[] Links) : IValidatableObject
{
    public const string ProjectKeyPattern = "^[A-Z][A-Z0-9_]+$";
    public const string IssueKeyPattern = "^[A-Z][A-Z0-9_]+-\\d+$";
    public const int MaxSummaryLength = 255;

    /// <summary>Jira's limit for a text field is believed to be 32,767 (jira-plan 4.3); we stop a little earlier.</summary>
    public const int MaxTextLength = 32_000;
    public const int MaxFields = 30;
    public const int MaxLinks = 5;
    public const int MaxListItems = 200;
    public const int MaxLabelLength = 255;

    /// <summary>Fields this app fills itself or must not touch.</summary>
    public static readonly IReadOnlySet<string> ReservedFieldIds = new HashSet<string>(StringComparer.Ordinal)
    {
        "project", "issuetype", "summary", "description", "parent", "issuelinks", "reporter", "attachment",
    };

    private static readonly Regex IssueKeyRegex = new(IssueKeyPattern, RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex FieldIdRegex = new(@"^(customfield_\d+|[a-z][a-zA-Z]*)$", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Fields.Count > MaxFields)
        {
            yield return new($"At most {MaxFields} extra fields.", [nameof(Fields)]);
        }

        if (Links.Length > MaxLinks)
        {
            yield return new($"At most {MaxLinks} links.", [nameof(Links)]);
        }

        // The built-in validation does not look inside array elements, so each link is checked here.
        foreach (var link in Links)
        {
            if (link is null
                || string.IsNullOrWhiteSpace(link.TypeName) || link.TypeName.Length > 255
                || !Enum.IsDefined(link.Direction)
                || link.IssueKey is null || !IssueKeyRegex.IsMatch(link.IssueKey))
            {
                yield return new("A link needs a type name, a direction (outward or inward) and an issue key such as SCRUM-12.", [nameof(Links)]);
            }
        }

        foreach (var (fieldId, value) in Fields)
        {
            if (!FieldIdRegex.IsMatch(fieldId) || ReservedFieldIds.Contains(fieldId))
            {
                yield return new($"'{fieldId}' is not a field id this app can set.", [nameof(Fields)]);
            }
            else if (CheckValue(value) is { } problem)
            {
                yield return new($"The value of '{fieldId}' is not valid: {problem}", [nameof(Fields)]);
            }
        }
    }

    private static string? CheckText(string? text) =>
        text is null ? "the text is missing." : text.Length > MaxTextLength ? "the text is too long." : null;

    private static string? CheckValue(FieldValue? value) => value switch
    {
        null => "it is missing.",
        TextFieldValue { Value: var text } => CheckText(text),
        TextareaFieldValue { Value: var area } => CheckText(area),
        NumberFieldValue { Value: var number } => double.IsFinite(number) ? null : "the number is not finite.",
        DateFieldValue { Value: var date } =>
            DateOnly.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _) ? null : "the date must be YYYY-MM-DD.",
        OptionFieldValue { Id: var id } => string.IsNullOrWhiteSpace(id) || id.Length > 100 ? "the option id is empty or too long." : null,
        OptionsFieldValue { Ids: var ids } =>
            ids is null || ids.Length > MaxListItems || ids.Any(id => string.IsNullOrWhiteSpace(id) || id.Length > 100)
                ? "the option ids are missing, empty or too many."
                : null,
        LabelsFieldValue { Values: var labels } =>
            labels is null || labels.Length > MaxListItems
            || labels.Any(label => string.IsNullOrEmpty(label) || label.Length > MaxLabelLength || label.Any(char.IsWhiteSpace))
                ? "a label is empty, too long or has a space."
                : null,
        _ => "the kind is not supported.",
    };
}
