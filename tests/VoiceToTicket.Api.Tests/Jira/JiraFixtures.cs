namespace VoiceToTicket.Api.Tests.Jira;

/// <summary>
/// Create-metadata answers written from the spec's schemas (<c>PageOfCreateMetaIssueTypes</c>,
/// <c>PageOfCreateMetaIssueTypeWithField</c>, <c>JsonTypeBean</c>), not copied from a real site, so they hold no personal data.
/// </summary>
public static class JiraFixtures
{
    /// <summary>Company-managed: Epic above Story, Task and Bug; Sub-task below.</summary>
    public const string CompanyIssueTypes = """
        {"startAt":0,"maxResults":50,"total":5,"issueTypes":[
          {"id":"10000","name":"Epic","subtask":false,"hierarchyLevel":1},
          {"id":"10001","name":"Story","subtask":false,"hierarchyLevel":0},
          {"id":"10002","name":"Task","subtask":false,"hierarchyLevel":0},
          {"id":"10003","name":"Bug","subtask":false,"hierarchyLevel":0},
          {"id":"10004","name":"Sub-task","subtask":true,"hierarchyLevel":-1}
        ]}
        """;

    /// <summary>Team-managed: ids are numbers, no Story type, and "Subtask" at level -1 without the subtask flag.</summary>
    public const string TeamIssueTypes = """
        {"startAt":0,"maxResults":50,"total":4,"issueTypes":[
          {"id":10100,"name":"Epic","subtask":false,"hierarchyLevel":1},
          {"id":10101,"name":"Task","subtask":false,"hierarchyLevel":0},
          {"id":10102,"name":"Bug","subtask":false,"hierarchyLevel":0},
          {"id":10103,"name":"Subtask","hierarchyLevel":-1}
        ]}
        """;

    /// <summary>The create screen of a company-managed Bug.</summary>
    public const string CompanyBugFields = """
        {"startAt":0,"maxResults":200,"total":16,"fields":[
          {"fieldId":"project","name":"Project","required":true,"schema":{"type":"project","system":"project"},"operations":["set"],"hasDefaultValue":false},
          {"fieldId":"issuetype","name":"Issue Type","required":true,"schema":{"type":"issuetype","system":"issuetype"},"hasDefaultValue":false},
          {"fieldId":"summary","name":"Summary","required":true,"schema":{"type":"string","system":"summary"},"hasDefaultValue":false},
          {"fieldId":"description","name":"Description","required":false,"schema":{"type":"string","system":"description"},"hasDefaultValue":false},
          {"fieldId":"reporter","name":"Reporter","required":true,"schema":{"type":"user","system":"reporter"},"hasDefaultValue":false,"autoCompleteUrl":"https://jira.test/rest/api/2/user/recommend"},
          {"fieldId":"priority","name":"Priority","required":false,"schema":{"type":"priority","system":"priority"},"hasDefaultValue":true,
            "allowedValues":[{"id":"1","name":"Highest"},{"id":"3","name":"Medium"},{"id":"5","name":"Lowest"}]},
          {"fieldId":"labels","name":"Labels","required":false,"schema":{"type":"array","items":"string","system":"labels"},"hasDefaultValue":false},
          {"fieldId":"components","name":"Components","required":false,"schema":{"type":"array","items":"component","system":"components"},"hasDefaultValue":false,
            "allowedValues":[{"id":"20001","name":"Web"},{"id":"20002","name":"API"}]},
          {"fieldId":"fixVersions","name":"Fix versions","required":false,"schema":{"type":"array","items":"version","system":"fixVersions"},"hasDefaultValue":false,
            "allowedValues":[{"id":"30001","name":"1.0"}]},
          {"fieldId":"environment","name":"Environment","required":false,"schema":{"type":"string","system":"environment"},"hasDefaultValue":false},
          {"fieldId":"duedate","name":"Due date","required":false,"schema":{"type":"date","system":"duedate"},"hasDefaultValue":false},
          {"fieldId":"customfield_10016","name":"Story point estimate","required":false,"schema":{"type":"number","custom":"com.atlassian.jira.plugin.system.customfieldtypes:float","customId":10016},"hasDefaultValue":false},
          {"fieldId":"customfield_10050","name":"Severity","required":true,"schema":{"type":"option","custom":"com.atlassian.jira.plugin.system.customfieldtypes:select","customId":10050},"hasDefaultValue":false,
            "allowedValues":[{"id":"40001","value":"Minor"},{"id":"40002","value":"Major"}]},
          {"fieldId":"customfield_10051","name":"Notes","required":false,"schema":{"type":"string","custom":"com.atlassian.jira.plugin.system.customfieldtypes:textarea","customId":10051},"hasDefaultValue":false},
          {"fieldId":"customfield_10052","name":"Reviewer","required":true,"schema":{"type":"user","custom":"com.atlassian.jira.plugin.system.customfieldtypes:userpicker","customId":10052},"hasDefaultValue":false},
          {"fieldId":"customfield_10020","name":"Sprint","required":false,"schema":{"type":"array","items":"json","custom":"com.pyxis.greenhopper.jira:gh-sprint","customId":10020},"hasDefaultValue":false}
        ]}
        """;

    /// <summary>The create screen of a team-managed Task: a smaller set, with a parent, and an unknown custom type.</summary>
    public const string TeamTaskFields = """
        {"startAt":0,"maxResults":200,"total":7,"fields":[
          {"fieldId":"summary","name":"Summary","required":true,"schema":{"type":"string","system":"summary"},"hasDefaultValue":false},
          {"fieldId":"issuetype","name":"Work type","required":true,"schema":{"type":"issuetype","system":"issuetype"},"hasDefaultValue":false},
          {"fieldId":"project","name":"Space","required":true,"schema":{"type":"project","system":"project"},"hasDefaultValue":false},
          {"fieldId":"parent","name":"Parent","required":false,"schema":{"type":"issuelink","system":"parent"},"hasDefaultValue":false},
          {"fieldId":"labels","name":"Labels","required":false,"schema":{"type":"array","items":"string","system":"labels"},"hasDefaultValue":false},
          {"fieldId":"assignee","name":"Assignee","required":false,"schema":{"type":"user","system":"assignee"},"hasDefaultValue":false},
          {"fieldId":"customfield_10200","name":"Gadget","required":true,"schema":{"type":"gadget-thing","custom":"com.example:gadget","customId":10200},"hasDefaultValue":false}
        ]}
        """;
}
