using System.Text.Json;
using VoiceToTicket.Api.Features.Jira.Contract;

namespace VoiceToTicket.Api.Features.Jira;

/// <summary>An issue type of a project as Jira reports it (create metadata).</summary>
public sealed record JiraIssueTypeInfo(string Id, string Name, int HierarchyLevel, bool Subtask);

/// <summary>One field of the create metadata, before it is mapped to a <see cref="JiraField"/>.</summary>
/// <param name="AllowedValueCount">How many allowed values Jira sent (the list itself is kept only up to the cap).</param>
public sealed record CreateMetaField(
    string FieldId,
    string Name,
    bool Required,
    bool HasDefaultValue,
    string? SchemaType,
    string? SchemaItems,
    string? SchemaSystem,
    string? SchemaCustom,
    bool HasAutoComplete,
    IReadOnlyList<JiraAllowedValue>? AllowedValues,
    int AllowedValueCount);

/// <summary>Reads Jira's create-metadata JSON into the small models above. Anything unexpected is skipped, never guessed.</summary>
public static class CreateMetadataParser
{
    /// <summary>The page's issue types (<c>issueTypes</c>, or <c>createMetaIssueTypes</c> on older answers).</summary>
    public static IReadOnlyList<JiraIssueTypeInfo> ParseIssueTypes(JsonElement page)
    {
        var types = new List<JiraIssueTypeInfo>();
        foreach (var item in Items(page, "issueTypes", "createMetaIssueType"))
        {
            var id = ReadId(item, "id");
            var name = ReadString(item, "name");
            if (id is null || string.IsNullOrWhiteSpace(name))
            {
                continue;
            }

            var level = item.TryGetProperty("hierarchyLevel", out var levelElement) && levelElement.TryGetInt32(out var parsed) ? parsed : 0;
            var subtask = item.TryGetProperty("subtask", out var subtaskElement) && subtaskElement.ValueKind == JsonValueKind.True;
            types.Add(new JiraIssueTypeInfo(id, name, level, subtask));
        }

        return types;
    }

    /// <summary>The page's fields (<c>fields</c>, or <c>results</c>).</summary>
    public static IReadOnlyList<CreateMetaField> ParseFields(JsonElement page)
    {
        var fields = new List<CreateMetaField>();
        foreach (var item in Items(page, "fields", "results"))
        {
            var fieldId = ReadString(item, "fieldId");
            if (string.IsNullOrWhiteSpace(fieldId))
            {
                continue;
            }

            string? type = null, items = null, system = null, custom = null;
            if (item.TryGetProperty("schema", out var schema) && schema.ValueKind == JsonValueKind.Object)
            {
                type = ReadString(schema, "type");
                items = ReadString(schema, "items");
                system = ReadString(schema, "system");
                custom = ReadString(schema, "custom");
            }

            List<JiraAllowedValue>? allowed = null;
            var allowedCount = 0;
            if (item.TryGetProperty("allowedValues", out var values) && values.ValueKind == JsonValueKind.Array)
            {
                allowed = [];
                foreach (var value in values.EnumerateArray())
                {
                    allowedCount++;
                    if (allowed.Count >= CreateMetadataMapper.MaxAllowedValues)
                    {
                        continue;
                    }

                    var id = value.ValueKind == JsonValueKind.Object ? ReadId(value, "id") : null;
                    var label = value.ValueKind == JsonValueKind.Object ? ReadString(value, "name") ?? ReadString(value, "value") : null;
                    if (id is not null && !string.IsNullOrWhiteSpace(label))
                    {
                        allowed.Add(new JiraAllowedValue(id, label));
                    }
                }
            }

            fields.Add(new CreateMetaField(
                fieldId,
                ReadString(item, "name") ?? fieldId,
                item.TryGetProperty("required", out var required) && required.ValueKind == JsonValueKind.True,
                item.TryGetProperty("hasDefaultValue", out var hasDefault) && hasDefault.ValueKind == JsonValueKind.True,
                type,
                items,
                system,
                custom,
                !string.IsNullOrEmpty(ReadString(item, "autoCompleteUrl")),
                allowed,
                allowedCount));
        }

        return fields;
    }

    /// <summary>The page's <c>total</c>, or null when Jira did not send one.</summary>
    public static int? ParseTotal(JsonElement page) =>
        page.ValueKind == JsonValueKind.Object && page.TryGetProperty("total", out var total) && total.TryGetInt32(out var value) ? value : null;

    private static IEnumerable<JsonElement> Items(JsonElement page, params string[] names)
    {
        if (page.ValueKind != JsonValueKind.Object)
        {
            return [];
        }

        foreach (var name in names)
        {
            if (page.TryGetProperty(name, out var array) && array.ValueKind == JsonValueKind.Array)
            {
                return array.EnumerateArray().Where(element => element.ValueKind == JsonValueKind.Object);
            }
        }

        return [];
    }

    private static string? ReadString(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    // Ids come as strings, but older answers use numbers.
    private static string? ReadId(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value))
        {
            return null;
        }

        return value.ValueKind switch
        {
            JsonValueKind.String when !string.IsNullOrWhiteSpace(value.GetString()) => value.GetString(),
            JsonValueKind.Number => value.GetRawText(),
            _ => null,
        };
    }
}
