# J2 — Jira discovery: projects, issue types, fields, link types, search

- **Milestone:** M7
- **Status:** todo
- **Depends on:** J1
- **Plan sections:** `docs/jira-plan.md` 1, 4.1, 4.2, 4.4 (`isDefault`), 4.5, 5, 6, 7, 8
- **Parallel-safe with:** none (J3 extends the same files afterwards)

## Goal

For any project the user can create issues in, the API reports what that project allows: its issue types with a suggestion per ticket type, each type's fields as typed `JiraField`s with the parent types, the site's link types, and an issue search for the parent and link pickers. Nothing about `SCRUM` is hard-coded.

## Files

- `src/VoiceToTicket.Api/Features/Jira/JiraDiscoveryEndpoints.cs`, `CreateMetadataMapper.cs`, `IssueTypeSuggester.cs`, `JqlBuilder.cs`, `IJiraClient.cs` and `JiraClient.cs` (add the discovery calls), `Contract/*` (projects, issue types, `JiraField`, link types, search)
- `contract/jira.schema.json`, `web/src/jiraContract.ts` (regenerated)
- `tests/VoiceToTicket.Api.Tests/Jira/*` (including fixtures for a company-managed and a team-managed project, written from the spec's schemas)
- `docs/tasks/J2-jira-lookups.md`, `docs/status.md`

## Out of scope

- Create and links (J3). Frontend (J4, J5).
- Paging beyond the first page for projects (50), search results (20) and issue types (50). Fields are fully paged (see the acceptance criteria). Allowed values are capped at 200.
- Autocomplete fields (`autoCompleteUrl`), user pickers, cascading selects: they map to `unsupported`.

## Acceptance criteria

- [ ] `GET /api/jira/projects` calls `GET /rest/api/2/project/search?action=create&maxResults=50` and returns `[{key, name}]`, sorted by name.
- [ ] `GET /api/jira/projects/{key}/issue-types` calls `GET /rest/api/2/issue/createmeta/{key}/issuetypes`, leaves out subtask types, and returns `{id, name, hierarchyLevel, suggestedFor}`. `IssueTypeSuggester` is pure and tested for: a preferred name present, a different case, no preferred name (fall back to the first level-0 type), both ticket types suggesting the same type, and an empty preference list.
- [ ] `GET /api/jira/projects/{key}/issue-types/{id}/fields` reads every page of `GET /rest/api/2/issue/createmeta/{key}/issuetypes/{id}` (stopping at 500 fields with `jira_unavailable`) and calls `GET /rest/api/2/issue/createmeta/{key}/issuetypes` for the hierarchy levels. It returns `{fields, parentTypeIds}`. A stub-handler test has a required field on the second page. The page size and maximum are ⚠ VERIFY and recorded in the log. `CreateMetadataMapper` is pure and tested for:
  - every row of the plan 4.2 kind table
  - the app-filled fields being left out
  - `allowedValues` over 200 becoming `unsupported`
  - an unknown custom type becoming `unsupported`
  - `parentTypeIds` from the hierarchy (present, and empty when no higher level exists)
  - both project-style fixtures
- [ ] The create-metadata `schema` values used for each kind are checked against the spec's `JsonTypeBean` and Atlassian's field input-format docs (⚠ VERIFY) and recorded in the log with the source.
- [ ] `GET /api/jira/link-types` calls `GET /rest/api/2/issueLinkType` and returns `{name, inward, outward, isDefault}`. `isDefault` marks `Jira:DefaultLinkType` only if it exists.
- [ ] `POST /api/jira/issues/search {projectKey?, issueTypeIds?, query?}` calls `POST /rest/api/2/search/jql` (not the removed `/search`) with `fields` `summary`, `issuetype` and `status`, `maxResults` 20, and returns `[{key, summary, issueType, status}]`.
- [ ] `JqlBuilder` is pure and tested for:
  - the optional project and type clauses
  - quote and backslash escaping
  - the 100-character cap
  - the `key = …` clause only for key-shaped text
  - no text clause for empty text
  - 400 `validation` for empty text with no project
  - rejection of a project key outside `^[A-Z][A-Z0-9_]+$` or a non-numeric type id
- [ ] The `summary ~ "<q>*"` prefix behaviour is checked against the Jira Cloud JQL text-search docs (⚠ VERIFY) and recorded in the log. If prefix matching isn't supported, the builder uses `summary ~ "<q>"`.
- [ ] ⚠ VERIFY, recorded in the log: whether a `key = "<q>"` clause for a non-existent key makes Jira reject the whole query, and which text-search characters are reserved. If it rejects, the key is looked up separately with `GET /rest/api/2/issue/{key}` (404 = no hit) and the JQL keeps only the text clause. A test covers an unknown key returning the text matches, not an error.
- [ ] Search text and field values never appear in a URL. A stub-handler test asserts the request URIs.
- [ ] All endpoints return `jira_auth_required` without a session, and 404 `jira_not_configured` with `Jira:Enabled=false`. The J1 error mappings apply, and a Jira 404 for an unknown project or type gives `jira_not_found`.
- [ ] Default `dotnet test` passes offline, and `node scripts/check.mjs` passes.

## Verification

```
dotnet test --filter "FullyQualifiedName~Jira"
dotnet test
cd web && npm run gen:contract && npm run build
node scripts/check.mjs
```

Manual check for the human (optional; J6 does it fully):

- With the API running and connected (J1 check), call the issue-types and fields endpoints for `SCRUM` in Swagger. Check that the types and required fields match what Jira's own Create dialog shows.

## Gate

None.

## Notes

- Fixtures are written from the spec's schemas, not copied from a real site, so they contain no personal data.

## Log

### Plan
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
