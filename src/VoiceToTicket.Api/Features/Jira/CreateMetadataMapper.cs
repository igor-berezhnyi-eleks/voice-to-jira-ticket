using VoiceToTicket.Api.Features.Jira.Contract;

namespace VoiceToTicket.Api.Features.Jira;

/// <summary>Create metadata to <see cref="JiraField"/>s and parent types (jira-plan 4.2). Pure.</summary>
public static class CreateMetadataMapper
{
    public const int MaxAllowedValues = 200;

    /// <summary>Fields the app fills itself, so the user is never asked for them.</summary>
    private static readonly HashSet<string> AppFilled = new(StringComparer.Ordinal)
    {
        "project", "issuetype", "summary", "description", "parent", "issuelinks", "reporter", "attachment",
    };

    // Option-like types that cannot be sent as {"id": ...}: people, groups and two-level selects.
    private static readonly HashSet<string> NotOptions = new(StringComparer.Ordinal)
    {
        "user", "group", "option-with-child", "project", "team",
    };

    public static IReadOnlyList<JiraField> MapFields(IEnumerable<CreateMetaField> fields) =>
        fields.Where(field => !AppFilled.Contains(field.FieldId)).Select(MapField).ToList();

    public static JiraField MapField(CreateMetaField field)
    {
        var kind = KindOf(field);
        var allowed = kind is JiraFieldKind.Option or JiraFieldKind.Options
            ? field.AllowedValues?.ToArray() ?? []
            : null;
        return new JiraField(field.FieldId, field.Name, field.Required, field.HasDefaultValue, kind, allowed);
    }

    /// <summary>Non-subtask types only: the app has no subtask flow.</summary>
    public static IReadOnlyList<JiraIssueTypeInfo> CreatableTypes(IEnumerable<JiraIssueTypeInfo> types) =>
        types.Where(type => !type.Subtask && type.HierarchyLevel >= 0).ToList();

    /// <summary>The ids of the creatable types one level above <paramref name="selected"/>. Empty means no Parent control.</summary>
    public static string[] ParentTypeIds(IEnumerable<JiraIssueTypeInfo> types, JiraIssueTypeInfo selected) =>
        CreatableTypes(types).Where(type => type.HierarchyLevel == selected.HierarchyLevel + 1).Select(type => type.Id).ToArray();

    private static JiraFieldKind KindOf(CreateMetaField field)
    {
        if (field.SchemaType is null || field.HasAutoComplete)
        {
            return JiraFieldKind.Unsupported;
        }

        if (field.AllowedValueCount > MaxAllowedValues)
        {
            return JiraFieldKind.Unsupported;
        }

        var hasValues = field.AllowedValues is { Count: > 0 };
        switch (field.SchemaType)
        {
            case "string":
                // A custom field of another string type (url, text field) is plain text, a read-only one is not fillable.
                if (field.SchemaCustom is not null && field.SchemaCustom.EndsWith(":readonlyfield", StringComparison.Ordinal))
                {
                    return JiraFieldKind.Unsupported;
                }

                return field.SchemaCustom?.EndsWith(":textarea", StringComparison.Ordinal) == true || field.SchemaSystem == "environment"
                    ? JiraFieldKind.Textarea
                    : JiraFieldKind.Text;
            case "number":
                return JiraFieldKind.Number;
            case "date":
                return JiraFieldKind.Date;
            case "array":
                return field.SchemaItems switch
                {
                    "option" or "component" or "version" when hasValues => JiraFieldKind.Options,
                    "string" when field.SchemaSystem == "labels"
                        || field.SchemaCustom?.EndsWith(":labels", StringComparison.Ordinal) == true => JiraFieldKind.Labels,
                    _ => JiraFieldKind.Unsupported,
                };
            default:
                return hasValues && !NotOptions.Contains(field.SchemaType) ? JiraFieldKind.Option : JiraFieldKind.Unsupported;
        }
    }
}
