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
            if (ParseField(ReadString(item, "fieldId"), item) is { } field)
            {
                fields.Add(field);
            }
        }

        return fields;
    }

    /// <summary>One field as Jira describes it: a <c>fields</c> array item (Cloud) or a value of the <c>fields</c> object keyed by id (Server).</summary>
    private static CreateMetaField? ParseField(string? fieldId, JsonElement item)
    {
        if (string.IsNullOrWhiteSpace(fieldId))
        {
            return null;
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

        return new CreateMetaField(
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
            allowedCount);
    }

    /// <summary>The projects of a Server (7.8) <c>createmeta</c> answer.</summary>
    public static IReadOnlyList<JiraProject> ParseServerProjects(JsonElement root)
    {
        var projects = new List<JiraProject>();
        foreach (var item in Items(root, "projects"))
        {
            var key = ReadString(item, "key");
            var name = ReadString(item, "name");
            if (!string.IsNullOrWhiteSpace(key) && !string.IsNullOrWhiteSpace(name))
            {
                projects.Add(new JiraProject(key, name));
            }
        }

        return projects;
    }

    /// <summary>The issue types of one project in a Server <c>createmeta</c> answer. Null when the project is not in the answer.</summary>
    public static IReadOnlyList<JiraIssueTypeInfo>? ParseServerIssueTypes(JsonElement root, string projectKey)
    {
        if (FindProject(root, projectKey) is not { } project)
        {
            return null;
        }

        return ParseIssueTypes(project.TryGetProperty("issuetypes", out var types) && types.ValueKind == JsonValueKind.Array
            ? JsonSerializer.SerializeToElement(new { issueTypes = types })
            : default);
    }

    /// <summary>The create fields of one issue type in a Server <c>createmeta</c> answer (the <c>fields</c> object, keyed by field id). Null when the type is not in the answer.</summary>
    public static IReadOnlyList<CreateMetaField>? ParseServerFields(JsonElement root, string projectKey, string issueTypeId)
    {
        if (FindProject(root, projectKey) is not { } project)
        {
            return null;
        }

        foreach (var type in Items(project, "issuetypes"))
        {
            if (ReadId(type, "id") == issueTypeId)
            {
                return ServerFields(type);
            }
        }

        return null;
    }

    /// <summary>The ids of the project's types that have an Epic Name field (the Epic type, whatever it is called), subtasks left out.</summary>
    public static IReadOnlyList<string> ParseServerEpicTypeIds(JsonElement root, string projectKey)
    {
        var ids = new List<string>();
        if (FindProject(root, projectKey) is not { } project)
        {
            return ids;
        }

        foreach (var type in Items(project, "issuetypes"))
        {
            var subtask = type.TryGetProperty("subtask", out var flag) && flag.ValueKind == JsonValueKind.True;
            if (!subtask && ReadId(type, "id") is { } id && ServerFields(type).Any(field => field.SchemaCustom == CreateMetadataMapper.EpicNameCustom))
            {
                ids.Add(id);
            }
        }

        return ids;
    }

    private static List<CreateMetaField> ServerFields(JsonElement type)
    {
        var fields = new List<CreateMetaField>();
        if (type.TryGetProperty("fields", out var object_) && object_.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in object_.EnumerateObject())
            {
                if (property.Value.ValueKind == JsonValueKind.Object && ParseField(property.Name, property.Value) is { } field)
                {
                    fields.Add(field);
                }
            }
        }

        return fields;
    }

    private static JsonElement? FindProject(JsonElement root, string projectKey)
    {
        foreach (var project in Items(root, "projects"))
        {
            if (string.Equals(ReadString(project, "key"), projectKey, StringComparison.OrdinalIgnoreCase))
            {
                return project;
            }
        }

        return null;
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
