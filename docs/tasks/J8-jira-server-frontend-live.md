# J8 — Jira Server mode: frontend, live check and docs

- **Milestone:** M7
- **Status:** todo
- **Depends on:** J7
- **Plan sections:** `docs/jira-plan.md` 14.2, 14.5, 14.7, 14.9; 8 (Live)
- **Parallel-safe with:** none

## Goal

The Connect panel speaks the right language for each mode, and creating an issue in the company Jira Server 7.8.1 is proven live by opt-in tests and a manual demo. The README explains Server setup and its limits.

## Files

- `web/src/jira/ConnectPanel.tsx`, `web/src/jira/jiraErrorMessages.ts` and their tests
- `web/e2e/*` (Server-mode variant of the Jira flow with mocked `/api/jira/**`)
- `tests/VoiceToTicket.Api.Tests/Jira/JiraServerLiveTests.cs` (new)
- `README.md` (Jira section: Server mode)
- `docs/jira-plan.md` (section 14: ⚠ VERIFY items closed, "Checked live" note)
- `docs/tasks/J8-jira-server-frontend-live.md`, `docs/status.md`

## Out of scope

- Backend changes. A bug found here is reported and its fix agreed with the human first.
- Deleting issues in Jira (the human does that).

## Acceptance criteria

- [ ] Cloud mode: labels "Atlassian email" / "API token" and the id.atlassian.com link, as today.
- [ ] Server + Bearer (the default): "Personal access token" only, no Atlassian link, a note that the token stays only in an encrypted cookie for this session and that the VPN must be on. Server + Basic: "Username" / "Password".
- [ ] Server `jira_auth_denied` shows the Server message and, for the CAPTCHA case, the browser-login hint.
- [ ] `JiraServerLiveTests` carry `[Trait("Category","Live")]` and skip unless `VTT_RUN_LIVE=1` and `VTT_JIRA_SERVER_LIVE=1`; they read `VTT_JIRA_SERVER_URL`, `VTT_JIRA_SECRET` (and `VTT_JIRA_LOGIN` only for Basic), `VTT_JIRA_PROJECT`; they discover types, create one issue per ticket type (with an Epic Link parent if available) and one link, and print the keys, never the secret.
- [ ] The human ran the live tests and the manual demo; the log records the project, keys, auth scheme, the server version from `GET /rest/api/2/serverInfo` (the footer says 7.8.1, but Bearer tokens work), and whether a CA certificate was needed in Docker.
- [ ] README covers `Jira:Deployment`, `ServerAuthScheme`, VPN, the CA certificate step for Docker, and the password risk.
- [ ] `node scripts/check.mjs` passes.

## Verification

```
npm test
npm run e2e
dotnet test
node scripts/check.mjs
```

Live, by the human (writes to the company Jira):

```
$env:VTT_RUN_LIVE="1"; $env:VTT_JIRA_SERVER_LIVE="1"; $env:VTT_JIRA_SERVER_URL="https://<company-jira-host>"; $env:VTT_JIRA_SECRET="<token>"; $env:VTT_JIRA_PROJECT="<KEY>"
dotnet test --filter "Category=Live&FullyQualifiedName~JiraServer"
```

## Gate

"Jira Server integration works" (human, after the live check).

## Notes

## Log

### Plan
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
