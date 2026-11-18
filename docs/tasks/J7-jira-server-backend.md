# J7 — Jira Server mode: backend

- **Milestone:** M7
- **Status:** done
- **Depends on:** J5; gate "Jira Server plan approved" (done 2026-11-17); probe done (Bearer works, Basic + token 401)
- **Plan sections:** `docs/jira-plan.md` 14 (all), and 3, 4, 6, 8, 9 as amended by 14.7
- **Parallel-safe with:** none

## Goal

With `Jira:Deployment = Server`, the existing `/api/jira/*` endpoints work against Jira Server 7.8.1: login with a personal access token (Bearer, default) or username + password (Basic, fallback), discovery from the 7.8 createmeta, search, create with an Epic Link parent, and links. Cloud mode behaves exactly as before.

## Files

- `src/VoiceToTicket.Api/Features/Jira/**` (options, client, parser, mapper hook for Epic Link, payload builder, session, errors, contract records)
- `src/VoiceToTicket.Api/appsettings.json`, `src/VoiceToTicket.Api/appsettings.Development.json` (new keys only; the human sets the company `BaseUrl`)
- `contract/jira.schema.json`, `web/src/jiraContract.ts` (regenerated only, via the snapshot test and `npm run gen:contract`)
- `web/src/jira/jiraApi.ts`, `web/src/jira/ConnectPanel.tsx`, `web/src/jira/fakeJira.ts` and their tests: **only** the rename `email/apiToken` → `login/secret` so the build stays green (labels per mode are J8)
- `tests/VoiceToTicket.Api.Tests/Jira/**`
- `docs/tasks/J7-jira-server-backend.md`, `docs/status.md`

## Out of scope

- Connect panel labels and help text per mode, README, live tests (J8).
- Cookie login (`/rest/auth/1/session`), OAuth, sub-tasks, Jira Core-specific behaviour beyond hiding the parent.
- Any change to Cloud request shapes.

## Acceptance criteria

- [ ] `Jira:Deployment` (`Cloud` default, `Server`) and `Jira:ServerAuthScheme` (`Bearer` default, `Basic`) are validated on start; an unknown value fails start.
- [ ] Server + Basic sends `Basic base64(login:secret)`; Server + Bearer sends `Bearer secret`; Cloud is unchanged. Stub-handler tests prove each.
- [ ] A Server 403 carrying `X-Seraph-LoginReason` on login maps to `jira_auth_denied` with the CAPTCHA hint; header values ⚠ VERIFY recorded in the log.
- [ ] Server discovery uses `GET /rest/api/2/issue/createmeta` (projects), `?projectKeys=` (issue types, subtasks left out) and `?projectKeys=&issuetypeIds=&expand=projects.issuetypes.fields` (fields), with fixtures written from the 7.8.0 schema. The fields object becomes the same list the Cloud mapper consumes.
- [ ] Server search posts `{jql, startAt, maxResults, fields}` to `/rest/api/2/search`; the JQL builder is reused unchanged.
- [ ] Epic Link: parent offered only when the type has a `gh-epic-link` field; `parentTypeIds` are the types with a `gh-epic-label` field; create sets `customfield_<id>: "<key>"`, the id re-read at create time; Epic Link is never an addable field. ⚠ VERIFY both `schema.custom` values from Atlassian docs.
- [ ] `POST /api/jira/session` takes `{login, secret}`; `GET /api/jira/status` returns `deployment` and `authScheme`; contract regenerated, no `any`.
- [ ] The capturing-logger test also shows no login, secret or Basic/Bearer header in any log line.
- [ ] All existing Cloud tests pass unchanged except the session field rename.
- [ ] `node scripts/check.mjs` passes.

## Verification

```
dotnet build
dotnet test
node scripts/check.mjs
```

## Gate

None after this task (J8 follows).

## Notes

- Probe result (14.6, 2026-11-17): Bearer + token → 200, Basic + username:token → 401, no certificate error. Default `ServerAuthScheme` is `Bearer`; in Bearer mode `login` is empty and the display name comes from `myself`.
- Keep `IJiraClient` as the seam; a Server implementation next to the Cloud one, chosen by `Deployment`, is fine if it keeps both small.

## Log

### Plan
Tests first (stub HTTP handler, fixtures written from the 7.8.0 createmeta schema), then code:
1. `JiraOptions`: `Deployment` (Cloud|Server) and `ServerAuthScheme` (Bearer|Basic) enums, `IsDefined` checks in `IsValid`; unknown value fails start.
2. `JiraCredentials(Login, Secret, DisplayName)`; `JiraSession` cookie payload renamed (login may be empty in Bearer mode, secret never).
3. `JiraClient`: auth header per mode; Server branches for projects, issue types, fields (7.8 createmeta, fields object parsed by new `CreateMetadataParser` methods into `CreateMetaField`), `POST /search`; new `GetEpicTypeIdsAsync` (Server only, Cloud returns empty) on `IJiraClient`.
4. `JiraErrors.FromResponseAsync`: Server 401 text and 403 + `X-Seraph-LoginReason` / `X-Authentication-Denied-Reason` on login → `jira_auth_denied` with the CAPTCHA hint.
5. Epic Link: mapper hides `gh-epic-link` fields; Fields endpoint computes `parentTypeIds` from epic types on Server; Create endpoint re-reads the type's fields to find the Epic Link id and `IssuePayloadBuilder` writes `customfield_<id>` instead of `parent`.
6. Contract: `JiraSessionRequest(Login, Secret)`, `JiraStatus` + `Deployment`, `AuthScheme`; snapshot and `npm run gen:contract`; web rename `email/apiToken` → `login/secret` only.
7. appsettings: new keys (defaults only; no company URL).
⚠ VERIFY: Seraph header values and the two `schema.custom` values (web search, see Decisions).

### Decisions
- ⚠ VERIFY Seraph headers (secondary sources only; Atlassian pages found were KB articles and tickets, no reference page): a refused login (CAPTCHA) is `X-Seraph-LoginReason: AUTHENTICATION_DENIED` or `AUTHENTICATED_FAILED`, and a CAPTCHA also sends `X-Authentication-Denied-Reason: CAPTCHA_CHALLENGE; login-url=...`. The app treats a Server 403 on the login check with either header as `jira_auth_denied` (HTTP 401 to the browser) with the hint "Log in to Jira in the browser once, then try again." Sources: https://jira.atlassian.com/browse/CONFSERVER-96013, https://support.atlassian.com/jira-align/kb/connector-captcha_challenge-error-on-jira-align-connector/, https://community.atlassian.com/t5/Jira-Core-questions/CAPTCHA-issue-while-loggin-in-jira-atlassian-com-with-REST-API/qaq-p/288840. J8's live check should confirm.
- ⚠ VERIFY `schema.custom`: Epic Link `com.pyxis.greenhopper.jira:gh-epic-link`, Epic Name `com.pyxis.greenhopper.jira:gh-epic-label` (community threads and JSWCLOUD-10340; no reference page). Epic Link's schema is reported as `type: array, items: string` although it holds one key, so detection uses `custom` only, never `type`. The create value is the parent key as a string. Confirm live in J8.
- One `JiraClient` branches on `Deployment` (small branches) instead of a second class; the seam `IJiraClient` gained `GetEpicTypeIdsAsync` (Server only, Cloud returns empty).
- `Jira:Deployment` and `ServerAuthScheme` are enums; `IsValid` rejects undefined (numeric) values; a non-name value fails at binding. Both fail start through `ValidateOnStart`.
- `POST /api/jira/session`: `login` is optional in the contract; the endpoint requires it unless Server + Bearer, where any login sent is ignored and stored as empty. `status.authScheme` is `Basic` for Cloud and Server Basic, `Bearer` for Server Bearer.
- Old session cookies (with `email`/`apiToken`) read as no session, so users reconnect once.
- Server `GET /search` is not used; search posts `{jql, startAt, maxResults, fields}` to `/rest/api/2/search`. Server issue types keep the `subtask` flag and `hierarchyLevel` 0; subtasks are hidden by the existing `CreatableTypes`. The Fields endpoint on Server drops the selected type from the parent list.
- Outside the file list: `web/src/jira/CreateInJiraPage.test.tsx` (status fixture gained `deployment`, `authScheme` so the build stays green).

### Verified
- `dotnet build`: pass, 0 warnings. `dotnet test`: 643 passed, 3 skipped (API tests); 57 passed, 1 skipped (evaluation). New file `JiraServerTests.cs`: auth header per mode, login errors and CAPTCHA headers, 7.8 createmeta fixtures, search body, Epic Link discovery and payload, status, session rules, log check.
- `node scripts/check.mjs --all`: build, test, npm build, npm test, lint all pass.
- Snapshot `contract/jira.schema.json` and `web/src/jiraContract.ts` regenerated (`login`, `secret`, `deployment`, `authScheme`).
### Not verified
- Nothing run against a live Jira (Server or Cloud); the 7.8 answer shapes rest on the REST reference. J8 does the live check.
- `npm run e2e` not run (the existing Jira e2e mocks the status without the new fields).
### Reviews
### Notes for the study
- Built test-first in one pass from the task file; the full suite was green on the first run after the code compiled. The agent used a script file for multi-line edits after a heredoc failed in the shell tool.
- The reviewer found no code defects. Its one major finding was a mistake of attribution: it counted the human's already-pending web redesign as J7 work. The reviewer reads the whole working tree, so unrelated uncommitted work makes its scope check noisy; committing other work first would avoid this.
- The Seraph header values and the Epic `schema.custom` values rest on secondary sources only (no Atlassian reference page was found); the harness marks them ⚠ VERIFY for J8's live check.
- The human approved after asking for a related change (user-typed Jira address), which became a new task, J9, rather than growing J7.
