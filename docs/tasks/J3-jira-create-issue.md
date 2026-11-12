# J3 — Create issue in Jira (fields, parent, links)

- **Milestone:** M7
- **Status:** todo
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
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
