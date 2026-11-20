# J6 — Jira live check and documentation

- **Milestone:** M7
- **Status:** done
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

1. `JiraLiveTests.cs` (new), modelled on `JiraServerLiveTests`: through `ApiFactory` and the session cookie, so the whole API is exercised. Two `[Trait("Category","Live")]` facts skip unless `VTT_RUN_LIVE=1` and `VTT_JIRA_LIVE=1`. Env: `VTT_JIRA_EMAIL`, `VTT_JIRA_API_TOKEN`, `VTT_JIRA_PROJECT` (default `SCRUM`), and `VTT_JIRA_SITE_URL` (default `https://olehhupalo.atlassian.net`, from plan section 1; not a secret).
2. Test 1: connect as Cloud (Basic), assert the project is listed; discover types, one suggested for Bug and one for Feature (skip naming the type when none is suggested). Test 2 (writes): per ticket type read the fields; fill each required field without a default from its first allowed value; skip the case naming the field if a required field cannot be filled; if `parentTypeIds` is non-empty search an existing parent among them and use it; create Feature, then Bug linked to it with the default link type; assert no warnings; print keys and URLs only.
3. The test never prints the email or token (`ToString` of the settings is overridden; assertion messages carry only app error bodies).
4. README: Jira section already covers Cloud/Server choice, settings, cookie. Add what is missing from AC: token without scopes and revocation, what is discovered, the supported field kinds, the "may already exist" note, local demo only. The Cloud live test command goes next to the Server one.
5. `docs/jira-plan.md`: the "Checked live" note in section 1 and section 12 closures wait for the human's live run, so I write them only after the results are reported; until then they stay open and the log says "not verified".
6. No file outside the list, no new dependency, no ⚠ VERIFY check from docs (the open items are settled by the live run).
### Decisions

- Two live facts instead of one: discovery only (writes nothing) and create (writes two issues and one link). The discovery run is a safe first step for the human.
- Both cases are prepared before anything is written, so a required field the app cannot fill (or a missing suggested type) skips the create test naming it and leaves Jira untouched.
- `VTT_JIRA_SITE_URL` was added beside the three variables in the task (default `https://olehhupalo.atlassian.net`, the non-secret site from plan section 1), so the test can run against another site.
- The README Cloud text (token without scopes, revocation, discovery, field kinds, timeout, local only) is new; the Cloud/Server panel and settings text came from J8/J10. The "scoped token does not work against the site address" sentence rests on plan section 12 (Atlassian support page and a third-party issue), not on a live check.
- No new dependency; no file outside the list.
### Verified

- 2026-11-20 `dotnet test`: Api.Tests 773 passed, 7 skipped (the 2 new Cloud live tests among them, shown as skipped); `node scripts/check.mjs`: all checks passed.
- 2026-11-20 negative run with both live flags, `https://jira.example.invalid` and a dummy email and token: both tests fail at connect with 502 `jira_unavailable`; the dummy email and token appear 0 times in the output.
### Not verified

- 2026-11-20 human: "Manual test on the app works. Let's skip powershell check." The manual demo on the app is reported as passed; the automated live tests were not run by the human (AC3 is met only by the manual demo). Project style, issue keys and the result of the demo were not reported, so they are not recorded here. No second project of the other style was run.
- Plan section 12 items and the section 1 "Checked live" note were not written (AC4): there is no live-test output to close them from. They stay open in the plan.
- The agent-side items below were already listed and are unchanged:

- Everything against a real Jira Cloud: the live run (AC3), the manual demo, a second project of the other style, and the gate. They need the human's email and token; the agent does not run them.
- Plan section 12 items (AC4) and the section 1 "Checked live" note are not written yet: they need the live result (`parent` accepted for every hierarchy pair, field input formats, link direction). Until then they stay open.
- Whether a scoped token fails against the site address (README sentence rests on documentation).
### Reviews

- 2026-11-20 round 1: APPROVE for the agent-side work; 0 blocker, 0 major, 1 minor (README claim about scoped tokens rests on documentation; softened to say so). AC3 and AC4 wait for the human's live run.
### Notes for the study

- The agent-side work (tests, README) took one pass; the reviewer approved in round 1 and its one minor, an undocumented claim about scoped tokens, was softened.
- The live tests have never run against a real Jira Cloud: the human tested by hand in the app and skipped them, as with J8. The plan section 12 closures and the "Checked live" note therefore stay open.
- Harness: the Stop gate and the reviewer cannot see live behaviour; both marked the human-only criteria as not verified instead of passing them.
