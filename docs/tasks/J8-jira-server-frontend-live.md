# J8 — Jira Server mode: live check and docs

- **Milestone:** M7
- **Status:** done
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

1. `JiraServerLiveTests.cs` (new): two `[Trait("Category","Live")]` facts that skip unless `VTT_RUN_LIVE=1` and `VTT_JIRA_SERVER_LIVE=1`. They host the API through `ApiFactory` with `Jira:Enabled=true` and only the server host on `Jira:AllowedHosts`; `Jira:Deployment` stays `Cloud` (pinned by `ApiFactory`), so Server comes only from the session request (`deployment=Server`, `authScheme` from `VTT_JIRA_AUTH_SCHEME`).
2. Test 1 (server facts): `GET /rest/api/2/serverInfo` without credentials through `IHttpClientFactory`; prints version, build number and deployment type.
3. Test 2 (end to end through the app's endpoints): connect → projects (the project must be listed) → issue types (one suggested for Bug and one for Feature) → fields per type (required fields without a default get a test value; an unsupported required field fails with its name) → if `parentTypeIds` is non-empty, search an existing Epic and use it as the Epic Link parent → link types (default or first) → create the Feature issue, then the Bug linked to it → no warnings → print keys and links. Never prints the secret or the login.
4. A non-empty `parentTypeIds` proves both `schema.custom` values (Epic Link and Epic Name) of 14.4; a created issue with a parent proves the Epic Link payload.
5. `README.md`: new "Jira" section (Cloud and Server, type and sign-in in the Connect panel, defaults, allowlist with both hosts, VPN, CA certificate in Docker, Basic password risk, live tests); the stale "no Jira connection" limit is corrected.
6. `docs/jira-plan.md` 14: close the ⚠ VERIFY items after the human's live run (dates and values from the log).
7. No file outside the list, no new dependency. ⚠ VERIFY facts here are settled by the human's live run, not by docs.
### Decisions

- Live tests go through the whole API (`ApiFactory` + session cookie), not `JiraClient` directly, so the session choice of type (J10) and the endpoints are what is proven. `Jira:Deployment` stays `Cloud` (pinned by `ApiFactory`); the only allowed host is the server's.
- The Epic `schema.custom` values (14.4) are checked through the app: a non-empty `parentTypeIds` for the Feature type needs both the Epic Link field on that type and an Epic type with Epic Name. A Story created with a parent proves the Epic Link payload. No Epic is created: the test uses the first existing Epic it finds, or creates without a parent and says so.
- Required fields without a default get a fixed test value per kind; a required unsupported field fails the test with its name (that is what a user would see as the blocking notice).
- `serverInfo` is called directly (no credentials sent) through `IHttpClientFactory`; it is not an app endpoint.
- README CA step: not verified against official .NET docs (search found only secondary sources). Chosen because it needs no root in the container: one combined PEM bundle (image roots + company CA) via `SSL_CERT_FILE`, which OpenSSL reads. Whether the company server needs it at all, and whether it works, is for the human's Docker run.
- No new dependency; no file outside the list.
### Verified

- 2026-11-20 `dotnet test`: Api.Tests 773 passed, 5 skipped (incl. the 2 new live tests); Evaluation 57 passed, 1 skipped.
- 2026-11-20 `node scripts/check.mjs`: all checks passed.
- 2026-11-20 negative run with the live flags against `https://jira.example.invalid` and a dummy secret: both tests fail as expected (`No such host`; `POST /api/jira/session: 502 jira_unavailable`), which shows a Server session with Bearer passes the app's validation with `Jira:Deployment=Cloud`; the dummy secret appears 0 times in the output.
### Not verified

- The live run against the company Jira Server (needs the VPN and the human's token): AC3, the gate. Project, keys, sign-in, `serverInfo` version and the CA answer are to be recorded here by the human.
- The manual demo (AC4): connect to Cloud, Disconnect, connect to the company Server with a token, create an issue, on one running instance.
- The README CA certificate step in Docker.
- Plan 14 ⚠ VERIFY items (AC6): only the server version is closed (7.8.1, build 78001). The CAPTCHA header values, the Epic `schema.custom` values and the Docker CA need stay open; the plan says so with the date.
- AC2/AC3: the create-issues live test failed (401 at connect) and was not retried, by the human's decision.
- 2026-11-20 live run 1 (human, on the VPN): `Server_info_reports_the_version` passed: `serverInfo` version=7.8.1, buildNumber=78001, deploymentType=Server. So the server really is 7.8.1, and the Bearer token from the 14.6 probe must come from an add-on (7.8 has no personal access tokens). `Creates_one_issue_…` failed at `POST /api/jira/session` with 401 `jira_auth_denied`, the plain-401 branch (detail "Check the username and password, or the token."), not the CAPTCHA/Seraph 403 branch. So Jira answered 401 to `GET /rest/api/2/myself` with the header the app sent. Cause not known. No issues were created by the test.
- 2026-11-20 human: gate "Jira Server integration works" passed ("Jira Server integration works /finish-task").
- 2026-11-20 **human decision:** "Let's cut this check, the app works and this is the most important thing." The 401 diagnosis and the automated end-to-end live run are dropped. The human confirms the app works against the company Jira Server. `JiraServerLiveTests` stays (it skips by default); its create test has not passed live. Not recorded, because the human did not report them: project, issue keys, sign-in used in the app, Docker CA answer.

### Reviews

- 2026-11-20 round 1: APPROVE; 0 blocker, 0 major, 0 minor. AC3, AC4, AC6 wait for the human's live run.
### Notes for the study

- The code and README took one pass; the reviewer approved in round 1 with no findings and correctly marked the human-only criteria (AC3, AC4, AC6) as not verified, not passed.
- The live run was the real test: serverInfo settled the version question (7.8.1, so the token is an add-on's), but connecting failed with a plain 401 that the earlier curl probe did not predict. The human cut the diagnosis and passed the gate on their own use of the app ("the app works"). The automated proof of create, Epic Link and links is therefore missing, and the log says so.
- Harness: the Stop gate and check.mjs cannot see live-only failures; the gate's value depends on the human's judgement, which here overrode the planned evidence.
