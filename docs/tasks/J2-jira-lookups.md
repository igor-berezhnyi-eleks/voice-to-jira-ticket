# J2 — Jira discovery: projects, issue types, fields, link types, search

- **Milestone:** M7
- **Status:** done
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

1. Tests first (all offline): `IssueTypeSuggesterTests`, `JqlBuilderTests`, `CreateMetadataMapperTests` (pure, with a company-managed and a team-managed JSON fixture parsed by `CreateMetadataParser`), `JiraDiscoveryClientTests` (stub handler: paths, paging, request URIs hold no search text, no retry), `JiraDiscoveryEndpointTests` (`ApiFactory` + a fake client: 401 without a session, 404 when disabled, the endpoints' shapes, key lookup separate from the JQL).
2. Contract: `Contract/JiraDiscoveryContract.cs` (project, issue type, `JiraField` with a `kind` enum, fields response, link type, search request and hit). Added to `JiraApiContract`; snapshot and `jiraContract.ts` regenerated.
3. Client: `IJiraClient` and `JiraClient` get `GetProjectsAsync`, `GetIssueTypesAsync`, `GetCreateFieldsAsync` (all pages, 200 per page, cap 500), `GetLinkTypesAsync`, `SearchIssuesAsync`, `GetIssueAsync`; `SendAsync` gets an optional JSON body. `CreateMetadataParser` reads the create-metadata JSON into small models.
4. Pure helpers: `IssueTypeSuggester`, `CreateMetadataMapper`, `JqlBuilder`. Endpoints in `JiraDiscoveryEndpoints.cs`, mapped from the existing `MapJiraEndpoints` group (one small edit to `JiraSessionEndpoints.cs`, which J1 created).
5. `FakeJiraClient` and `FailingJiraClient` in `JiraTestSupport.cs` implement the new members.
6. ⚠ VERIFY facts recorded below. Run the verification commands, then `/review`.

### Decisions

- **Key lookup is separate from the JQL** (the ⚠ VERIFY outcome below). `JqlBuilder` returns `{Jql, Key}`; `Key` is set only for key-shaped text, and the JQL holds only the text clause. This changes the wording of the criterion "the `key = …` clause only for key-shaped text" to "the key is returned for key-shaped text only"; the plan 4.5 fallback was anticipated. The endpoint looks the key up with `GET /rest/api/2/issue/{key}?fields=summary,issuetype,status`, treats `jira_not_found` and `jira_forbidden` as no hit, applies the project and type filters to the hit itself, and puts it first.
- Text-search characters: backslash and quote are escaped (plan); the other reserved characters (`+ - & | ! ( ) { } [ ] ^ ~ * ? :`) are replaced by a space, because a stray `*` or `?` would turn into a wildcard and the Atlassian note says escaped special characters are unreliable. The 100-character cap applies after cleaning. Text that is empty after cleaning counts as empty.
- Search is bounded by design: Jira's search needs a restriction, so a search with no project and no usable text is 400 `validation`.
- Optional fields beyond the criteria: allowed values' display name is `name`, else `value` (options use `value`).

- Files beyond the task list (same feature folder, no new dependency): `Features/Jira/CreateMetadataParser.cs` (the JSON-to-model reader and the two small models), `Contract/JiraDiscoveryContract.cs` (list entry `Contract/*`), `JiraErrors.NotFound()`, one line in `JiraSessionEndpoints.cs` that maps the discovery endpoints into the same group, `JiraJson.cs` (the contract record gains the new types), and the test files `JiraFixtures.cs` and four test classes. `JiraTestSupport.cs` fakes implement the new client members.
- `JiraFieldKind` is a C# enum with `[JsonStringEnumMemberName]` values and a `JsonStringEnumConverter<T>` on the type, so the API and the exported schema both use `text`, `textarea`, …; `json2ts` types it as a string union. `suggestedFor` is `string[]` (`"Bug"`/`"Feature"`).
- Link types: the client returns `isDefault: false` and the endpoint sets it, so the client does not know the configuration. A site with two link types differing only by case marks the first.
- Fields endpoint calls `issuetypes` first (the hierarchy and a `jira_not_found` for an id the project does not have) and then the fields; two Jira calls plus the pages.
- Project key and type id in a path must match `^[A-Z][A-Z0-9_]+$` and digits; otherwise 400 `validation` before Jira is called.

### Verified

⚠ VERIFY results (2026-11-12). Source for the first four: the Jira Cloud OpenAPI spec `https://dac-static.atlassian.com/cloud/jira/platform/swagger.json` (downloaded, parsed).

- Create-metadata fields endpoint (`GET /rest/api/2/issue/createmeta/{project}/issuetypes/{id}`): `startAt` default 0, `maxResults` default **50**, maximum **200**; response `{startAt, maxResults, total, fields}` (the spec also lists a duplicate `results`). The app asks for 200 per page and reads until `startAt + count >= total`. The issue-types endpoint has the same paging (default 50, max 200) and the field `issueTypes`. Project search: default 50, maximum 100.
- `schema` values (`JsonTypeBean`: `type`, `items`, `system`, `custom`, `customId`, `configuration`): the spec defines the shape and the custom type strings seen in the spec text (`...customfieldtypes:textarea`, `:float`, `:select`, `:multiselect`, `:multicheckboxes`, `:radiobuttons`, `:labels`, `:datepicker`, `:datetime`, `:userpicker`, `:cascadingselect`, `:textfield`, `:url`, `:readonlyfield` …). The mapper keys on `type` and `items` (plus `system` `environment` and `labels`, and custom ending `:textarea`, `:labels`, `:readonlyfield`), never on custom ids. Atlassian's "field input formats" page could not be read (the page needs JavaScript), so the rest of the table in jira-plan 4.2 rests on the spec and on documented Jira behaviour; **input formats are re-checked in J3** and live in J6. Unknown values map to `unsupported`, so a wrong guess cannot become a wrong kind.
- Enhanced search `POST /rest/api/2/search/jql`: body `{jql, fields[], maxResults (default 50)}`; the GET variant's description says the query must be **bounded** (a restriction such as `project = X`; `order by key desc` alone is unbounded). Response `{issues, nextPageToken, isLast}`. The builder always has a project or text clause, and the endpoint answers 400 otherwise.
- `summary ~ "<q>*"`: prefix wildcard is documented (Atlassian text-search syntax, `summary ~ "magic*"`), wildcards must be inside the quotes. Source: Atlassian "Search syntax for text fields" (found through search; the Cloud page was not fetchable). Reserved characters per that page: `+ - & | ! ( ) { } [ ] ^ ~ * ? \ :`.
- Unknown key in JQL: Jira answers **400** when a query names an issue key that does not exist (Atlassian KB on 400 errors from the search API; community reports, JRACLOUD-36802 describes the OR case). Behaviour is reported as inconsistent, so the key lookup is separate (`GET issue/{key}`, 404 or 403 = no hit) and the JQL has no `key =` clause. Not tested against a live site (J6).

Results:

- `dotnet test --filter "FullyQualifiedName~Jira"`: pass (new J2 tests: `IssueTypeSuggesterTests`, `JqlBuilderTests`, `CreateMetadataMapperTests`, `JiraDiscoveryClientTests`, `JiraDiscoveryEndpointTests`; the J1 tests still pass).
- `dotnet test`: Api.Tests 535 passed, 3 skipped; Evaluation 57 passed, 1 skipped.
- `cd web && npm run gen:contract && npm run build`: pass; `web/src/jiraContract.ts` has `JiraField.kind` as a string union and no `any`.
- `node scripts/check.mjs`: all checks passed (build, test, web build, web test, lint).
### Not verified

- Nothing was run against a real Jira site (no credentials in this session): the response shapes come from the spec, so the live shapes of `createmeta`, `project/search`, `issueLinkType` and `search/jql` are checked in J6, or earlier by the human's optional manual check below.
- Atlassian's field-input-format docs (see Verified).
### Reviews

- 2026-11-12, round 1: APPROVE. 0 blocker, 0 major, 2 minor. Minor 1 (path validation ran before the session check) fixed with a test, not re-reviewed; minor 2 (reworded key criterion, unverified live docs) is already in Decisions and Not verified.
### Notes for the study

- The task file was already written and approved in J0, so the agent went straight to the plan and built in one pass. Nothing needed human correction.
- The Atlassian doc pages are JavaScript-rendered and WebFetch returned nothing; the agent switched to the OpenAPI spec and a web search and logged what stayed unverified, instead of recalling values from memory.
- Test bugs surfaced by the first run (connect counted as a Jira call, scalar config binding to an array, a bare `{}` failing validation first) were fixed in tests, not by weakening assertions. The reviewer caught one real ordering gap (path validation before the session check), fixed with a test.
- The harness did not catch that the live Jira shapes are unchecked; that rests on the Not verified list and J6.
