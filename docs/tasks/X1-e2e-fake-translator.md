# X1 — Force the fake translator in the Playwright API

- **Milestone:** none (fix found during N1, outside M10)
- **Status:** done
- **Depends on:** none
- **Plan sections:** CLAUDE.md "Tests"; L6/L7 (translation, `Translation:Provider`)
- **Parallel-safe with:** N2 (different files)

## Goal

`npm run e2e` passes on the human's machine again: the API that Playwright starts uses the fake translator regardless of user-secrets, as it already does for the ticket generator.

## Files

Create or change only these (globs allowed). Anything else: ask first.

- `web/playwright.config.ts`
- `docs/tasks/X1-e2e-fake-translator.md`
- `docs/status.md`

## Out of scope

- Changing `smoke.spec.ts` expectations (the `[en] ` prefix is the fake's documented behaviour and is correct).
- Changing the translator, its selection, `appsettings*.json` or user-secrets.
- `reuseExistingServer` behaviour (a reused API is whatever the human started; see Notes).

## Acceptance criteria

- [x] The Playwright API `webServer.env` sets `Translation__Provider: 'Fake'` next to `TicketGenerator__Provider: 'Fake'`.
- [x] `npm run e2e` (in `web/`) passes fully, with no API or web server already running on 5080/5173.
- [x] `node scripts/check.mjs` passes.
- [x] The cause is recorded in this log.

## Verification

```
cd web; npm run e2e
node scripts/check.mjs
```

Manual check for the human: none.

## Gate

None.

## Notes

- `reuseExistingServer` is on outside CI: if the human's own API is already on 5080, Playwright uses it with its real providers and the env above does not apply. Stop it before `npm run e2e`.

## Log

### Plan

1. Read `playwright.config.ts`, `Features/Translations/*` and the L6/L7 logs to find why the box holds plain English.
2. Add `Translation__Provider: 'Fake'` to the API `webServer.env`.
3. Run `npm run e2e` with nothing on 5080/5173, then `node scripts/check.mjs`.

### Decisions

- Cause (Playwright environment, not the test):
  - `FakeTranslator` still prefixes `[{to}] ` (unchanged since L6, `a1dd830`), and `appsettings.json` ships `Translation:Provider=Fake`.
  - `dotnet run` uses the `Development` launch profile, so user-secrets load and override `appsettings.json`. The L7 log (2026-11-20) says the human then ran live translation with `Translation:Provider=Claude`; that setting is in the human's user-secrets (not read here, by rule).
  - `playwright.config.ts` forces only `TicketGenerator__Provider=Fake` (added in T3.2 for the same reason). L7 (`cabfcf0`) added the translate smoke step but did not force `Translation__Provider`, and its final smoke run was skipped (L7 log). So the Playwright API used the real Claude translator, which returned a real English sentence without the `[en] ` prefix.
  - Nothing was listening on 5080/5173 when this task started, so a reused server was not the cause here (though it can cause the same symptom; see Notes).
  - `ApiFactory` (xUnit) already pins the fake translator, so `dotnet test` never showed this; `scripts/check.mjs` does not run e2e.
- Fix the environment, not the expectation: the `[en] ` prefix proves the request reached the fake and kept the original text.

### Verified

- Nothing listening on 5080/5173 before the run, so Playwright started its own API with the new env.
- `npm run e2e`: 7 of 7 pass (3 `jira.spec.ts`, 4 `smoke.spec.ts`, including the translate step).
- `node scripts/check.mjs`: all checks passed (web build, test, lint).

### Not verified

- The failure was not re-run before the fix in this session (it was confirmed in N1); the user-secrets value was inferred from the L7 log, not read.
### Reviews

- Round 1 (reviewer subagent): APPROVE, no findings. It re-ran `npm run e2e` (7 of 7) and `node scripts/check.mjs` (all passed) itself.
### Notes for the study

- Every provider switch that user-secrets can flip needs to be pinned in each test host (xUnit `ApiFactory` and Playwright `webServer.env`). L6 pinned it in one host only.
- Started from another session's brief (found in N1). The cause came from reading the config and the L6/L7/T3.2 logs, not from reading user-secrets (the harness blocked even a filtered `dotnet user-secrets list`, rightly).
- The reviewer re-ran both checks and found nothing. The harness missed the bug for four days because `scripts/check.mjs` does not run e2e.
