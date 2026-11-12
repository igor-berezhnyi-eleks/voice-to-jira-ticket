# J3 — Create issue in Jira (fields, parent, links)

- **Milestone:** M7
- **Status:** done
- **Depends on:** J2
- **Plan sections:** `docs/jira-plan.md` 4.3, 4.4, 4.6, 6, 7, 8
- **Parallel-safe with:** none

## Goal

`POST /api/jira/issues` creates an issue of any discovered type with the user's summary, description, extra field values and optional parent. It then adds the user's links, and returns `{key, url, warnings}`.

## Files

- `src/VoiceToTicket.Api/Features/Jira/CreateIssueEndpoint.cs`, `IssuePayloadBuilder.cs`, `IJiraClient.cs` and `JiraClient.cs` (create and link calls), `Contract/*` (create request, `FieldValue`, link request, response)
- `contract/jira.schema.json`, `web/src/jiraContract.ts` (regenerated)
- `tests/VoiceToTicket.Api.Tests/Jira/*`
- `docs/tasks/J3-jira-create-issue.md`, `docs/status.md`

## Out of scope

- Re-rendering the description on the server (D10). Re-checking the fields against the create metadata, which Jira does itself.
- Field kinds beyond plan 4.2, attachments, assignee, sprint.
- Any retry, including after a timeout.

## Acceptance criteria

- [ ] `IssuePayloadBuilder` is pure. It sets `project.key`, `issuetype.id`, `summary`, `description` (unchanged), and `parent.key` when given. It converts each `FieldValue` kind to the Jira shape in the plan 4.3 table. Each kind, and a request with no extras, has a test. The input formats are ⚠ VERIFY and recorded in the log (see J2).
- [ ] Validation uses the built-in Minimal API validation (D2: `AddValidation()` + DataAnnotations), like `GenerateTicketEndpoint`. It returns 400 `validation` for each limit in plan 4.3:
  - summary length and description length
  - more than 30 fields or 5 links
  - a reserved or malformed field id
  - a label with a space
  - a bad project, parent or link key
  - an unknown link direction
  Jira's description limit (believed 32,767) is ⚠ VERIFY and recorded in the log.
- [ ] With `Jira:Enabled=false`, the endpoint returns 404 `jira_not_configured`.
- [ ] The endpoint calls `POST /rest/api/2/issue` exactly once. A stub-handler test asserts one request, even when Jira returns 5xx or times out.
- [ ] When Jira returns 201, the app returns **200** `{key, url: "<BaseUrl>/browse/<key>", warnings: []}`. The same status is used when links fail (only `warnings` differs).
- [ ] Each link then calls `POST /rest/api/2/issueLink`, in order, with `type.name`. For direction `outward` the new issue is `outwardIssue`, and for `inward` it is `inwardIssue`, each tested. A failed link adds `{code: "jira_link_failed", issueKey}` to `warnings`, the remaining links are still tried, and the response is 200. Each failure is logged at Warning without ticket text.
- [ ] A Jira 400 or 422 on create returns 422 `jira_rejected` with Jira's `errors` (field id → message) and `errorMessages` as extensions, and a Jira 404 returns `jira_not_found`. The other statuses map as in J1.
- [ ] One Information log line per created issue, as in plan section 7. A capturing-logger test shows that the summary, description and field values are never logged.
- [ ] Default `dotnet test` passes offline, and `node scripts/check.mjs` passes.

## Verification

```
dotnet test --filter "FullyQualifiedName~Jira"
dotnet test
cd web && npm run gen:contract && npm run build
node scripts/check.mjs
```

Manual check for the human (optional here, required in J6):

- Connected through Swagger, create one issue in `SCRUM` with a priority and a label, and one link. Check it in Jira, then delete it.

## Gate

None.

## Notes

- A duplicate link request is reported as created by Jira (spec), so a repeated link is harmless, but the app does not repeat it.

## Log

### Plan

1. Tests first (offline): `IssuePayloadBuilderTests` (each kind, no extras, parent, empty description), `CreateIssueClientTests` (stub handler: URL, body, Basic header, one request on 5xx/429/timeout, 400 field errors, status map, link body, empty 201), `CreateIssueEndpointTests` (`ApiFactory` + fake client: 200 shape, link direction, link failure warning, rejection, 401, disabled, 415, each validation limit, logging).
2. Contract: `Contract/JiraIssueContract.cs` (`CreateIssueRequest` with DataAnnotations and `IValidatableObject`, `JiraIssueLinkRequest`, `JiraLinkDirection`, `CreateIssueResponse`, `JiraIssueWarning`); added to `JiraApiContract`; snapshot and `jiraContract.ts` regenerated.
3. `IssuePayloadBuilder` (pure). `IJiraClient`/`JiraClient` get `CreateIssueAsync` and `CreateLinkAsync`; `SendAsync` becomes generic so the empty link answer needs no JSON.
4. `CreateIssueEndpoint` mapped from the existing group; it reuses the discovery endpoints' `Authorize` (now `internal`).
5. Fakes in `JiraTestSupport.cs` implement the new members.

### Decisions

- **Validation of nested values:** the built-in validation does not look inside array elements or dictionary values, so `CreateIssueRequest.Validate` checks the field map (count, id pattern, reserved ids, each value) and each link (type name, defined direction, key shape). Top-level limits are DataAnnotations. Error keys are the C# member names (`Fields`, `Links`), as in T1.3.
- **Unknown link direction** (`"sideways"`) fails JSON binding and is 400 `validation`; an integer such as `7` binds to an undefined enum value and is rejected by `Enum.IsDefined`.
- **Empty description is left out of the payload** (Jira's default is empty); a non-empty one is sent unchanged. A missing `description` property is 400.
- **Description limit:** 32,000 characters in the app (plan 4.3). Text, option and label limits beyond the plan: option ids 100 characters, at most 200 option ids or labels per field, labels at most 255 characters.
- **`jira_link_failed` is a warning code, not an error code**, so it lives as `JiraIssueWarning.LinkFailed` in the contract, not in `ErrorCodes.cs` (outside this task's list). `warnings[].issueKey` is the other end of the failed link.
- A 401 on a link after a successful create is a warning, not `jira_auth_required` (the issue exists); the cookie is not cleared then.
- `Authorize` in `JiraDiscoveryEndpoints` became `internal` and `JiraSessionEndpoints` maps the new endpoint (both outside the J3 list, one line each).
- Validation runs before the session check, so an invalid body without a session is 400, not 401 (same as the search endpoint).
- Files beyond the list: `JiraSessionEndpoints.cs`, `JiraDiscoveryEndpoints.cs`, `JiraJson.cs` (in `Contract/`), `JiraTestSupport.cs`.

### Verified

⚠ VERIFY results (2026-11-12):

- **Description limit 32,767:** supported by Atlassian's KB article on the 32,767-character error (JCMA) and by community reports that the Cloud limit is not configurable (`jira.text.field.character.limit` is Server/Data Center only). No Atlassian documentation page states it directly. 32,000 keeps a margin. Single-line summary: 255 characters (community answers).
- **Input formats** (secondary sources only, Atlassian's "field input formats" page is not readable without JavaScript): labels are an array of strings; components, versions and fix versions are arrays of objects (id or name); single options and priority are `{"id": "…"}` (a name also works for priority, but the id is the safe form); multi-selects need an array even for one value. The builder sends ids only, which matches `allowedValues` from the metadata. Number and date as JSON number and `YYYY-MM-DD` string are standard. **Live check in J6.**
- Link direction rule (outward = new issue as `outwardIssue`) follows plan 4.4; the exact meaning is checked live in J6.

Results:

- `dotnet test --filter "FullyQualifiedName~Jira"`: 274 passed (new: `IssuePayloadBuilderTests`, `CreateIssueClientTests`, `CreateIssueEndpointTests` with 35 validation cases).
- `dotnet test`: Api.Tests 610 passed, 3 skipped; Evaluation 57 passed, 1 skipped.
- `cd web && npm run gen:contract && npm run build`: pass; `jiraContract.ts` has `CreateIssueRequest` with `direction: "outward" | "inward"` and field values as a union, no `any`.
- `node scripts/check.mjs`: all checks passed.

### Not verified

- Nothing ran against a real Jira site: the create and link answers, the input formats and the link direction rest on the spec and docs (J6, or the optional manual check below).
- The timeout test uses a real 1-second timeout (the client uses `TimeProvider` for the timer, which the test leaves real).

### Reviews

- 2026-11-12, round 1: APPROVE. 0 blocker, 0 major, 2 minor (empty description left out of the payload, already in Decisions; four small edits outside the file list, already declared). No fix needed.
### Notes for the study

- Task file existed from J0, so the agent went straight to the plan and built test-first in one pass; the human needed to correct nothing.
- The first run showed that the built-in validation does not look inside array elements: bad link keys, a missing link type and a numeric direction got through. The tests caught it, and the checks moved into `CreateIssueRequest.Validate`.
- Reviewer: APPROVE in round 1 (2 minor, both already in the log). The harness did not catch that the live Jira shapes, the field input formats and the link direction are unchecked; that rests on the Not verified list and J6.
