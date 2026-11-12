# J6 — Jira live check and documentation

- **Milestone:** M7
- **Status:** todo
- **Depends on:** J5
- **Plan sections:** `docs/jira-plan.md` 1, 8 (Live), 12 (open ⚠ VERIFY items), 13
- **Parallel-safe with:** none

## Goal

The integration is checked against a real Jira Cloud project by opt-in tests and a manual demo, without depending on how the project is set up. The README explains setup, what the app discovers, and the limits.

## Files

- `tests/VoiceToTicket.Api.Tests/Jira/JiraLiveTests.cs` (new)
- `README.md` (Jira section)
- `docs/jira-plan.md` (a "Checked live" note in section 1; section 12 items closed)
- `docs/tasks/J6-jira-live-check-docs.md`, `docs/status.md`

## Out of scope

- Code changes in `src/` or `web/`. A bug found here is reported, and its fix is agreed with the human first.
- Deleting issues in Jira. The human does that.

## Acceptance criteria

- [ ] `JiraLiveTests` carries `[Trait("Category","Live")]` and skips unless `VTT_RUN_LIVE=1` and `VTT_JIRA_LIVE=1`. It reads `VTT_JIRA_EMAIL`, `VTT_JIRA_API_TOKEN` and `VTT_JIRA_PROJECT` (default `SCRUM`) from the environment and runs against the real client and mapper. It:
  - discovers the project's issue types
  - takes the suggested type for each ticket type
  - fills every required field it can from the first allowed value, or skips the case naming the field when it can't
  - sets a parent when `parentTypeIds` has a match among existing issues
  - creates one issue per ticket type and links them with the default link type
  - prints the keys, never the token
- [ ] The default `dotnet test` shows the live tests as skipped, not failed.
- [ ] The human ran the live tests and the manual demo, and the log records the project style found, the keys and the result. If a second project of the other style (company- or team-managed) is available, it is run too; otherwise the log says so.
- [ ] No ⚠ VERIFY item from plan section 12 is left open. Anything not checked is stated as "not verified".
- [ ] The README Jira section covers:
  - the `Jira:*` settings, and that the type names and link type are suggestions only
  - a token without scopes
  - that the token is kept in an encrypted HttpOnly cookie, only for the session
  - Disconnect and revocation
  - what is discovered from Jira
  - the supported field kinds, and the unsupported-required-field limit
  - the "may already exist" note after a timeout
  - that this is for local demos, not a shared deployment
- [ ] `node scripts/check.mjs` passes.

## Verification

```
dotnet test
node scripts/check.mjs
```

Live, by the human (writes to Jira):

```
$env:VTT_RUN_LIVE="1"; $env:VTT_JIRA_LIVE="1"; $env:VTT_JIRA_EMAIL="<you>"; $env:VTT_JIRA_API_TOKEN="<token>"; $env:VTT_JIRA_PROJECT="SCRUM"
dotnet test --filter "Category=Live&FullyQualifiedName~Jira"
```

## Gate

**Jira integration works** (human): the live tests and the manual demo passed.

## Notes

- The agent does not set the env values or run the live tests with real credentials. The human runs them and pastes the output, which shows the keys and no token.

## Log

### Plan
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
