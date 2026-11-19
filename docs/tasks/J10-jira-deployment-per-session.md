# J10 — Jira type (Cloud or Server) chosen per session

- **Milestone:** M7
- **Status:** done
- **Depends on:** J9 approved and committed (same files); human approval of this task file
- **Plan sections:** `docs/jira-plan.md` 3 (session), 5 (configuration), 14.1, 14.2; D17. **This changes a plan decision** ("Jira:Deployment and Jira:ServerAuthScheme are global configuration", sections 5 and 14.2): the human asked on 2026-11-19 to host the app once and let users connect to Cloud and Server without changing configuration. The plan sections are updated as part of the task.
- **Parallel-safe with:** none (J8 shares the Connect panel; run it after J10, see Notes)

## Goal

On the Connect panel the user picks the Jira type (Cloud, or Server / Data Center) and, for Server, how to sign in (token only, or username and password). The choice is stored in the session with the address, and every Jira call uses the session's choice. One running instance then serves Cloud and Server users at once. `Jira:Deployment` and `Jira:ServerAuthScheme` stay only as the panel's initial defaults.

## Files

- `src/VoiceToTicket.Api/Features/Jira/**` (options, credentials, session, client, errors, endpoints, contract)
- `contract/jira.schema.json`, `web/src/jiraContract.ts` (regenerated)
- `web/src/jira/jiraApi.ts`, `ConnectPanel.tsx`, `CreateInJiraPage.tsx` only where the status or Connect props are used, and their tests
- `tests/VoiceToTicket.Api.Tests/Jira/**`
- `docs/jira-plan.md` (sections 3, 5, 14.1, 14.2), `docs/tasks/J10-*.md`, `docs/status.md`

## Proposed design (for approval)

1. **Session shape.** `JiraCredentials` gains `Deployment` (`Cloud` or `Server`) and `AuthScheme` (`Basic` or `Bearer`; Cloud is always `Basic`). They live in the encrypted cookie next to `siteUrl`. Everything that reads `JiraOptions.IsServer` or `IsBearer` today (`JiraClient`, `JiraErrors.FromResponseAsync`, `JiraDiscoveryEndpoints`, `CreateIssueEndpoint`, `JiraSessionEndpoints`) reads the credentials instead. `IsServer` and `IsBearer` move to `JiraCredentials`.
2. **Connect request.** `POST /api/jira/session` takes `{siteUrl, deployment, authScheme, login, secret}`. `deployment` and `authScheme` are optional: an empty value means the configured default. The server validates them: unknown values are 400 `validation`; Cloud with `Bearer` is 400 `validation`; `Bearer` needs no login, every other combination needs one. As in J9, later calls never take them from a request.
3. **Old cookies** (J9 and earlier) have neither value and get the configured `Jira:Deployment` and `Jira:ServerAuthScheme`, so existing sessions keep working.
4. **Configuration.** `Jira:Deployment` (default `Cloud`) and `Jira:ServerAuthScheme` (default `Bearer`) are the defaults shown in the panel and used for old cookies. They no longer decide anything for a session that has its own values. Validation is unchanged.
5. **Status.** `GET /api/jira/status` returns `deployment` and `authScheme` of the session when connected, and the configured defaults otherwise. The web uses them to pre-select the panel.
6. **Connect panel.**
   - A "Jira type" choice (Cloud, Server / Data Center). For Server a second choice, "Sign in with": Token or Username and password.
   - Labels follow the choice: Cloud shows "Atlassian email" and "API token" with the Atlassian token link. Server with a token shows only "Personal access token" (no login field). Server with a password shows "Username" and "Password". The help text names the right thing for each.
   - The type is guessed from the address as the user types: a host ending `.atlassian.net` selects Cloud, anything else Server. A guess never overrides a choice the user has made by hand. The server does not use the guess.
   - The last used type and sign-in are remembered with the address in localStorage (no secrets).
7. **No detection from Jira.** The app does not call `serverInfo` to decide the type (anonymous access is often off, it adds a request and it cannot tell Bearer from Basic).

## Out of scope

- Detecting the type from the server's answer.
- A deployment setting per allowlist entry.
- New Cloud or Server request shapes, and any change to the allowlist rules from J9.
- The live check against the company server, and the README section (J8).

## Acceptance criteria

- [ ] A Cloud session and a Server session (token or password) can exist in the same running instance, on the same configuration. Each uses its own request shapes and its own auth header (Cloud and Server Basic: `Basic base64(login:secret)`; Server Bearer: `Bearer secret`).
- [ ] The session's type, not the configuration, decides every Jira call: with `Jira:Deployment=Cloud` configured, a Server session still uses the 7.8 calls, and the other way round.
- [ ] Cloud with `Bearer`, an unknown `deployment` or `authScheme`, or a missing login where one is needed is 400 `validation`, no Jira call and no cookie.
- [ ] A request without `deployment` and `authScheme` uses the configured defaults (today's behaviour).
- [ ] An old cookie without the new values gets the configured defaults; a later request body cannot change them.
- [ ] Error mapping follows the session: a 401 on the login check gives the Server wording for a Server session and the Cloud wording for Cloud, whatever the configuration says.
- [ ] Status returns the session's values when connected and the defaults otherwise.
- [ ] The Connect panel shows the right fields and help for each type and sign-in, guesses the type from the address without overriding a manual choice, and sends `deployment` and `authScheme`. No secret is stored in the browser.
- [ ] Existing Cloud and Server tests pass except those that set the type by configuration only; they are changed to set it on the session, and the change is listed in the log.
- [ ] Contract regenerated; `node scripts/check.mjs` passes.

## Verification

```
dotnet build
dotnet test
node scripts/check.mjs
```

Manual check for the human: with one running instance, connect to the Cloud site, disconnect, connect to the company Server with a token, then try the Server again with the wrong sign-in choice and read the message. No configuration change or restart between them (the allowlist must contain both hosts).

## Gate

Human approval of the design above (especially points 1, 2 and 6) before work starts.

## Notes

- Open question: for Server, should the panel default to Token (the configured `ServerAuthScheme=Bearer`) or follow the configuration? Proposed: follow the configuration, so an existing setup looks the same.
- Open question: remembered type per address, or one last choice? Proposed: per address, so a user with both a Cloud site and the company Server gets the right choice for each.
- J8 (Server frontend, live check, docs) planned Server labels in the Connect panel. J10 now does the panel; J8 should be reduced to the live check and the README once J10 is approved. Tell me, and `docs/status.md` and plan 14.8 are updated.
- Tests that fake the type through `JiraOptions` (`JiraServerTests`, parts of the client and discovery tests) will change; none may be weakened.
- Risk: the session carries more state. Mitigation: values are validated on connect and on every cookie read (unknown values make the cookie no session).

## Log

### Plan

Design approved by the human on 2026-11-19, with open questions 4 and 5 as proposed (Server sign-in default follows `Jira:ServerAuthScheme`; type and sign-in remembered per address) and J8 reduced to the live check and the README.

1. `JiraCredentials` gets `Deployment` and `AuthScheme` (defaults Cloud / Basic), plus `IsServer` and `IsBearer`. `JiraOptions.IsServer`/`IsBearer` are removed, so the compiler finds every place that used them.
2. `JiraSession` stores both values as names in the cookie. Missing values mean the configured defaults (old cookies). Unknown values, Cloud with Bearer, or Basic without a login make the cookie no session.
3. `JiraSessionRequest` gets `deployment` and `authScheme` (strings, checked by the endpoint). `JiraStatus` returns the session's values when connected and the defaults otherwise, plus `defaultServerAuthScheme` so the panel can follow the configuration when the user switches to Server (see Decisions).
4. `JiraClient`, `JiraErrors`, `JiraDiscoveryEndpoints`, `CreateIssueEndpoint` read the credentials.
5. Tests first: new `JiraSessionTypeTests` (connect validation, mixed sessions on one instance, old cookie, status, error wording per session); change the existing tests that set the type through `JiraOptions` to set it on the credentials or the connect request.
6. Web: regenerate the contract; `connectJira` sends `deployment` and `authScheme`; `ConnectPanel` gets the type and sign-in choice, the labels, the guess from the address and the per-address memory; `CreateInJiraPage` passes the status values. Tests in `ConnectPanel.test.tsx` and `jiraApi.test.ts`.
7. Docs: `jira-plan.md` 3, 5, 14.1, 14.2, 14.8; `status.md` (J10 and J8 rows).
No ⚠ VERIFY facts: no new Jira call or header shape.
### Decisions

- **`defaultServerAuthScheme` added to status** (small contract addition beyond point 5). Without it the panel cannot start Server on `Jira:ServerAuthScheme` when the configured default is Cloud (open question 4, answered "follow the configuration"). It is the configured value, never the session's.
- **Session values are enum names** in the cookie, parsed by name, any case, never as numbers (`JiraEnumNames.TryParse`). The connect request takes the same names as strings, so an unknown value is a 400 `validation` from the endpoint rather than a binding failure.
- **On cookie read** (not only on connect), Cloud with Bearer and Basic without a login make the cookie no session (plan Notes, risk mitigation).
- **`JiraOptions.IsServer` and `IsBearer` removed**, replaced by `JiraOptions.DefaultAuthScheme(deployment)`; `IsServer`/`IsBearer` are now on `JiraCredentials`. Removing them let the compiler find every place the configuration used to decide.
- **Panel start order:** the type and sign-in remembered for the address, else the guess from the address, else the status values (the session's, or the configured defaults). A choice by hand stops the address from changing them for the rest of that panel.
- **Server sign-in failure in the panel:** the general `jira_auth_denied` text names an email and an API token, which is wrong for Server. The panel shows "Jira did not accept this token / username and password", the server's detail, and a hint to try the other "Sign in with" choice. `jiraErrorMessages.ts` is unchanged (outside the file list).
- **Tests changed (not weakened):** `JiraServerTests` client tests now set the type on the credentials and configure the opposite type, so they also prove that configuration does not decide (`CreateClient(configured, …)`, `Opposite`). The header theory was renamed `The_authorization_header_follows_the_session`. The endpoint tests in that class still set the type by configuration and now act as the "configured defaults" tests; `A_bearer_login_needs_only_the_secret…` expects the Server/Bearer values on the credentials. `Defaults_are_cloud_and_bearer…` checks `DefaultAuthScheme` instead of the removed `IsBearer`. Web: `connectJira` takes one request object; its test and the page's status fixture gained the new fields.
- No ⚠ VERIFY facts: no new Jira call or header shape. No new dependency.

### Verified

- `dotnet build`: succeeded, 0 warnings.
- `dotnet test`: Api.Tests 773 passed, 3 skipped (the existing Live/Stt traits); Evaluation 57 passed, 1 skipped.
  - New `JiraSessionTypeTests` (19 cases): connect validation (Cloud+Bearer, unknown or numeric type and sign-in, missing login: 400 `validation`, no call, no cookie); defaults when the request has no values; Cloud, Server Bearer and Server Basic sessions in one instance, each with its own calls and header (real `JiraClient` against a stub handler); the session's type deciding the search call against the opposite configuration, both ways; the 401 wording following the chosen type; an old cookie getting the configured defaults and ignoring `deployment`/`authScheme` in a later body; status with and without a session.
  - New `JiraSessionTests` cases: a Server session reads back; an old cookie gets the configured defaults; unknown or impossible cookie values are no session.
- Contract: `UPDATE_SNAPSHOTS=1` schema test run, then `npm run gen:contract`; `JiraSchemaTests` pass without the flag.
- Web: `npm test` (Jira files 136 passed, including 10 new Connect panel tests and 1 new jiraApi test), `npm run build`, `npm run lint`.
- `node scripts/check.mjs`: all checks passed.

### Not verified

- Not checked in the browser: the preview config starts only the web dev server, and the Connect panel needs the API running with Jira enabled. The behaviour is covered by the component tests; the human's manual check covers the real panel.
- No live check against Cloud or the company Server (J6 and J8).
- The human approved by running `/finish-task`; the result of the manual check (Cloud, then Server, then the wrong sign-in) was not reported in the session.

### Reviews

- 2026-11-19, round 1: APPROVE; 0 blocker, 0 major, 0 minor.

### Notes for the study

- The design gate worked as intended: the agent listed the gate and the three open questions, and the human answered them in one line before any code was written.
- Removing `JiraOptions.IsServer`/`IsBearer` let the compiler find every place where configuration decided the type; the existing client tests were made stricter by configuring the opposite type.
- One small contract addition (`defaultServerAuthScheme`) went beyond the approved design; it was logged as a decision and the reviewer accepted it. The reviewer found nothing else.
- Shell friction cost time: one heredoc edit failed to parse and a stray `cat` blocked a command until it was stopped. The Edit tool was more reliable. The browser check was skipped because the preview config has no API server.
