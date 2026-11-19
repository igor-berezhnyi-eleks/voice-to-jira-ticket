# J8 — Jira Server mode: live check and docs

- **Milestone:** M7
- **Status:** todo
- **Depends on:** J7, J10 (approved and committed)
- **Plan sections:** `docs/jira-plan.md` 3 (type per session, J10), 14.2, 14.5, 14.8, 14.9; 8 (Live)
- **Parallel-safe with:** none
- **Scope reduced 2026-11-19 (human decision, with the J10 approval):** the Connect panel labels, help text and Server sign-in messages moved to J10. J8 is the live check against the company server and the README.

## Goal

Creating an issue in the company Jira Server is proven live, by opt-in tests and a manual demo on one running instance that also serves Cloud. The README explains Server setup, choosing the type in the Connect panel, and the limits.

## Files

- `tests/VoiceToTicket.Api.Tests/Jira/JiraServerLiveTests.cs` (new)
- `README.md` (Jira section: Server, type per session)
- `docs/jira-plan.md` (section 14: ⚠ VERIFY items closed, "Checked live" note)
- `docs/tasks/J8-jira-server-frontend-live.md`, `docs/status.md`

## Out of scope

- Backend and frontend changes, the Connect panel included (J10). A bug found here is reported and its fix agreed with the human first.
- A Server variant of the Playwright flow (the panel is covered by the J10 component tests).
- Deleting issues in Jira (the human does that).

## Acceptance criteria

- [ ] `JiraServerLiveTests` carry `[Trait("Category","Live")]` and skip unless `VTT_RUN_LIVE=1` and `VTT_JIRA_SERVER_LIVE=1`. They read `VTT_JIRA_SERVER_URL`, `VTT_JIRA_SECRET`, `VTT_JIRA_AUTH_SCHEME` (`Bearer` by default, or `Basic`), `VTT_JIRA_LOGIN` (only for Basic) and `VTT_JIRA_PROJECT`. They use a Server session (`deployment` and `authScheme` on the credentials, as since J10), not configuration, to choose the type.
- [ ] The live tests discover projects and types, create one issue per ticket type (with an Epic Link parent if available) and one link, and print the keys, never the secret or the login.
- [ ] The human ran the live tests and the manual demo. The log records the project, the keys, the sign-in used, the server version from `GET /rest/api/2/serverInfo` (the footer says 7.8.1, but Bearer tokens work), and whether a CA certificate was needed in Docker.
- [ ] Manual demo on one running instance, with no configuration change or restart: connect to Cloud, disconnect, connect to the company Server with a token, create an issue.
- [ ] README covers:
  - choosing Cloud or Server and the sign-in in the Connect panel;
  - `Jira:Deployment` and `Jira:ServerAuthScheme` as defaults only;
  - `Jira:AllowedHosts` with both the Cloud and the Server host;
  - the VPN, the CA certificate step for Docker, and the password risk of Basic sign-in.
- [ ] The ⚠ VERIFY items of plan section 14 that the live run settles are closed in the plan, with the date.
- [ ] `node scripts/check.mjs` passes.

## Verification

```
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

- Removed from this task by the 2026-11-19 reduction: the Connect panel labels and help per mode, the Server `jira_auth_denied` and CAPTCHA wording in the panel (all done in J10), and the mocked Server e2e variant.
- The VPN note is in the README, not the panel (the panel was finished in J10). If the human wants it in the panel too, that is a small frontend change to agree first.

## Log

### Plan
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
