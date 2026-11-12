# J0 — Jira integration plan

- **Milestone:** M7 (Jira integration; new, human decision 2026-11-12)
- **Status:** done
- **Depends on:** T4.2 (Jira wiki renderer), T4.5 (type picker). Human decision 2026-11-12: Jira comes before T6.1b and T5.4.
- **Plan sections:** 2 (P2 row), 3 (D2, D10), 4.1, 4.4, 4.8, 6 (M6, T6.2 note); reference design in `docs/development-plan.md` Phase 6 (read only)
- **Parallel-safe with:** T6.1b (human checks only; its README and `web/src` edits must be done before J4)

## Goal

A written, approved plan for the Jira integration exists in `docs/jira-plan.md`, together with the J1–J6 task files. Every open question the code tasks would otherwise stop on has an answer: which Jira, which auth, which parent rules, what is created, how it is tested. No code is written in this task.

## State found at the start

- "Connect to Jira board" is on Page 2, disabled, tooltip "Not part of the PoC (P2)" (T4.2).
- Jira wiki rendering exists in the browser (`web/src/ticket/render/jiraWiki.ts`, D10). Per the T4.2 decision it has no missing-information section and does not escape user text.
- Igor's design (`docs/development-plan.md` Phase 6) targets Jira Server 7.8.1: session login, Epic Link for Stories, an issue link for Bugs, no retry on create. It uses MediatR, FluentValidation and Polly, which D2 rules out.
- The human has a Jira board to test against. Its product (Cloud, Server or Data Center), version and project are not recorded yet.
- The ID T6.2 is used by Upload recording, so this work gets new IDs (J0–J5 at first, J0–J6 since revision 2).

## Files

Create or change only these. Anything else: ask first.

- `docs/jira-plan.md` (new: the plan)
- `docs/tasks/J1-*.md` … `docs/tasks/J6-*.md` (new, from `_template.md`; the split is settled by proposal 10, revised in revision 2)
- `docs/implementation-plan.md`: only the P2 row in section 2, a new decision row in section 3 if proposal 11 is accepted, and the M6 T6.2 note. These are scope changes and need the human's explicit yes.
- `docs/tasks/J0-jira-plan.md`, `docs/status.md`

## Out of scope

- Any code, config, `appsettings*.json`, `docker-compose.yml` or test change.
- Storing or writing down credentials. The plan names configuration keys and where secrets go (user-secrets, env), never values. The agent does not log in to Jira itself.
- Features not in the reference design: attachments, assignee or sprint selection, labels, components, priority mapping, duplicate detection, editing an existing issue, OAuth app registration.

## Proposals (answer or say "all as proposed")

1. **Identify the instance first.** You give the product (Cloud / Server / Data Center), the version (Jira shows it in the footer or under `/rest/api/2/serverInfo`), the base URL host, the project key and the board, plus the issue type names in that project (Bug, Story, Epic or local names). The agent records everything except credentials in the plan. Everything below depends on this: Cloud and newer Data Center differ from Server 7.8 in auth and in how parents work.
2. **Auth, chosen by product** (⚠ VERIFY against the current Atlassian docs for the product you name):
   - Server 7.8: Igor's design. `POST /rest/auth/1/session` with the user's username and password, keep only `JSESSIONID` in an encrypted HttpOnly SameSite=Strict cookie, discard the password. CAPTCHA (`403` + `X-Seraph-LoginReason`) means "log in once in the Jira UI".
   - Data Center 8.14+: a personal access token the user pastes, sent as `Authorization: Bearer`, kept in the same encrypted cookie.
   - Cloud: the user's Atlassian email plus an API token, sent as Basic auth, kept in the same encrypted cookie.
   In every case the app has no login of its own. Pages 1 and 2 stay anonymous, and the credential is entered only at "Connect to Jira board". Alternative: one shared service account in config (simpler, but every issue would be reported by that account; not proposed).
3. **Cookie protection.** ASP.NET Core Data Protection, with keys persisted to a Docker volume so a container restart doesn't log everyone out. No server-side session store (no persistence; plan section 2). Alternative: in-memory keys (restart = log in again; acceptable for a PoC). Settled in J1.
4. **Parent rules.** Keep Igor's rules, mapped to your instance's mechanism:
   - Feature → Story under an Epic. Server/DC: the Epic Link field, id found via `GET /rest/api/2/field`. Cloud: the `parent` field. ⚠ VERIFY which one your instance accepts.
   - Bug → a Bug linked to a Story with an issue link, link type from config, default "Relates".
   The parent is optional, so creating without one is allowed.
5. **What goes into the issue.** Summary = Title. Description = exactly the Jira wiki text the preview shows (the T4.2 output, so Copy and Create match), on the REST v2 endpoint that accepts wiki strings. The missing-information questions are not added, as decided in T4.2. Project and issue type come from the form and the config map `Jira:IssueTypeMap` (Bug → Bug, Feature → Story). Alternative: a separate rendering on the server (duplicates `jiraWiki.ts`; not proposed).
6. **Rendering stays in the browser.** The browser sends the summary and the rendered description, and the server only adds project, type and parent. It does not re-render, so D10 holds unchanged. The server checks lengths (summary ≤ 255).
7. **Endpoints** (shapes are pinned in J1–J3 and exported through `gen:contract`): `POST /api/jira/session`, `DELETE /api/jira/session`, `GET /api/jira/projects`, `GET /api/jira/parents?project=&type=&q=` (Epics for a Feature, Stories for a Bug, text search), `POST /api/jira/issues` → `{ key, url, warning? }`.
8. **Errors and retries.** New `code`s with the `jira_` prefix (for example `jira_auth_required`, `jira_auth_denied`, `jira_captcha`, `jira_unavailable`, `jira_rejected` carrying Jira's field `errors`, `jira_link_failed` as a warning). No retry anywhere: the create is not idempotent, and D2 excludes Polly. A failed issue link after a successful create returns the key with a warning. Server/DC posts send `X-Atlassian-Token: no-check`. The CA certificate is configurable (`Jira:CaCertPath`) only if your instance needs it.
9. **Testing.** Default `dotnet test` stays offline: `JiraClient` is tested against a stub `HttpMessageHandler` (auth header or cookie forwarding, 401, error maps, no second POST), and the payload builder is tested as a pure function. Playwright mocks `/api/jira/*` in the browser. One opt-in test, `[Trait("Category","Live")]` behind `VTT_RUN_LIVE=1` and a separate `VTT_JIRA_LIVE=1`, creates one issue per type in your test project and prints the keys. The agent does not delete them; you remove them by hand.
10. **Task split** (each task is one session). *Superseded by revision 2: see `docs/jira-plan.md` section 10 (J1–J6, strictly in order).*
    - J1 client, options and session: options with `ValidateOnStart`, typed `HttpClient`, the auth from proposal 2, the cookie, error mapping, log-in/log-out endpoints.
    - J2 lookups: projects, parent search, field discovery.
    - J3 create: payload builder, create plus link, warnings.
    - J4 frontend: the button enabled, a login step, Page 3 (project, parent picker, Create, link to the new issue), and an expired session sending the user back to login; Playwright extended.
    - J5 live check and docs: the Live test, a README section, and a manual demo against your board.
    J1 → J2 → J3 → J4 → J5 in order; J4 can start once J1–J3 shapes are in the contract.
11. **Decision row.** *Revision 2: the P2 row and the M6 note say J0–J6, and D17 describes discovery and user edits.* Add D17 to plan section 3: "Direct Jira integration is in scope as M7 (human, 2026-11-12); credentials only at Connect; no retry; description = preview wiki text." Change the P2 row from "Not planned" to "M7 (J0–J5)" and point the M6 T6.2 note at `docs/jira-plan.md`.
12. **Logging.** Each created issue is logged at Information with key and issue type only. Summaries, descriptions, transcripts and credentials are never logged (CLAUDE.md rule for transcripts, extended to ticket text).

## Acceptance criteria

- [x] `docs/jira-plan.md` exists and covers: instance facts (no secrets), auth, cookie protection, endpoints with request and response shapes, parent rules, issue payload, error codes, configuration keys and where secrets live, testing approach, task split, risks.
- [x] Every Jira API detail in the plan that depends on product or version is marked ⚠ VERIFY or is backed by a link to the Atlassian doc it was checked against, with the date.
- [x] The plan contains nothing that D2 forbids (MediatR, Polly, FluentValidation, EF Core, Moq, FluentAssertions) and no new dependency without saying it needs approval.
- [x] J1–J6 task files exist from `_template.md`, each with a file list, out of scope, acceptance criteria and verification commands. No two tasks that may run in parallel share files, and the shared files of sequential tasks are listed. (Reworded with the human's approval, 2026-11-12.)
- [x] Plan section 2 and 3 changes are made only after the human's yes (proposal 11), and `docs/status.md` lists J0–J6 and the decision.
- [x] No credential, token, password or cookie value appears in any file.
- [x] `node scripts/check.mjs` passes (docs only; nothing else changed).

## Verification

```
node scripts/check.mjs
git status   (only the files listed above changed)
```

Manual check for the human:

- Answer proposal 1 (instance facts) before the agent writes the plan.
- Read `docs/jira-plan.md`: do the parent rules and issue types match how your board works? Is the auth one you can use (your company may block API tokens or basic auth)?
- Approve the plan and the J1–J6 split.

## Gate

**Jira plan approved** (human). J1 does not start before it.

## Notes

- Reuse Igor's design where it fits the product; the plan says where it was changed and why.
- Before writing the plan, the agent checks the auth method, the parent or Epic Link mechanism, and REST v2 wiki-string descriptions in the current Atlassian docs for the named product and version. These are ⚠ VERIFY items and are recorded in the log.
- If the board is a team-managed (next-gen) Cloud project, Epics work differently; the plan says which kind it is.

## Log

### Plan
1. Record the instance facts and the human's answers.
2. Check the Cloud-specific API facts (auth, v2 vs v3, parent vs Epic Link, search endpoint, XSRF header) in the current Atlassian docs and OpenAPI spec.
3. Write `docs/jira-plan.md`, then J1–J5 from the template.
4. Update plan sections 2, 3 and 6 (proposal 11) and `status.md`. Run `check.mjs` and the reviewer.

### Decisions
- 2026-11-12, human: proposal 1 answered. Jira **Cloud**, auth with Atlassian email + API token, board `https://olehhupalo.atlassian.net/jira/software/projects/SCRUM/boards/1` (project `SCRUM`, board 1). All other proposals accepted as proposed. Proposal 11 accepted, so the plan section 2/3 edits are made.
- Proposal 2 resolved for Cloud: HTTP Basic, classic (unscoped) tokens only. Scoped tokens need the `api.atlassian.com` gateway and are out of scope.
- Proposal 4 resolved for Cloud: `parent` field for Story → Epic (Epic Link deprecated). The Bug link is unchanged.
- Proposal 7 refined: added `GET /api/jira/status`. Session endpoints are `POST`/`DELETE /api/jira/session`. Parent search became `POST /api/jira/parents/search`, so the search text is not in a URL or the HTTP client log.
- Proposal 8 refined: no CAPTCHA case on Cloud, no `X-Atlassian-Token` (Cloud needs it only for multipart), and new codes `jira_rate_limited` and `jira_timeout`.
- Contract: Jira records get their own snapshot `contract/jira.schema.json` and generated `web/src/jiraContract.ts` (J1 file list includes `web/package.json` and the protected-files hook).

- 2026-11-12, human (revision 2): "make it general so it would work for many different cases, and users can edit or add details themselves." The plan was rewritten around discovery (create metadata, hierarchy levels, link types) and user edits on Page 3. This supersedes proposal 4 (fixed parent rules) and the type-map part of proposals 5 and 10. The summary and description become editable on Page 3, which changes proposal 5's "Copy and Create always match" into "Create is prefilled with what Copy copies". The labels, priority and components that J0 listed as out of scope are now supported as generic field kinds. The frontend is split into J4 (core) and J5 (fields, links), and the live check moved to J6. These revision-2 changes need the gate's explicit yes.
- The create-metadata shapes (`/issue/createmeta/{project}/issuetypes[/{id}]`, `FieldCreateMetadata`, `hierarchyLevel`) were checked in the Jira Cloud OpenAPI spec. The old `/issue/createmeta` is deprecated.

- 2026-11-12, human: "Approve all": the revised plan (revision 2), the D17 wording in plan section 3, and the AC4 rewording. The gate "Jira plan approved" is passed.

### Verified
- ⚠ VERIFY items are recorded in `docs/jira-plan.md` section 12, with sources, dated 2026-11-12. The Jira Cloud OpenAPI spec (`dac-static.atlassian.com/cloud/jira/platform/swagger.json`) was downloaded to the session scratchpad and read as data; it is not in the repo.

### Not verified
- Nothing about `SCRUM` needs checking by hand any more (discovered at runtime). The live tests in J6 exercise it.
- Whether `parent` → Epic works the same in a team-managed project: expected, checked live in J6.
- Token expiry range (1–365 days): third-party sources only, not relied on.
- The Atlassian API token page URL for the Connect panel link: J4.

### Reviews
- 2026-11-12, reviewer: CHANGES REQUESTED, six minor findings. Fixed: Atlassian sources linked by URL in plan §12; the description limit (32,767) and the JQL prefix search marked ⚠ VERIFY (J3, J2); validation wording aligned with D2 (`AddValidation()` + DataAnnotations) in the plan and J3; Jira 422 added to `jira_rejected` and a new `jira_not_found` (404) added to plan §6, J1 and J3; plan §10 J4 row aligned with the J4 file list (`web/src/jira/jiraErrorMessages.ts`); `Enabled=false` → 404 criterion added to J2 and J3.
- Open for the human (not changed silently): acceptance criterion 4 says no J task overlaps another's files. J1–J3 share `Features/Jira/IJiraClient.cs`, `JiraClient.cs`, `Contract/*`, the Jira schema and generated TS, and `tests/.../Jira/*`; J2 and J5 both edit `jira-plan.md` §1; all list `status.md`. The tasks run strictly in order, so the edits don't conflict. Proposed rewording: "no two tasks that may run in parallel share files; shared files of sequential tasks are listed."
- Also for the gate: refinements made after "all as proposed" are listed under Decisions (status endpoint, POST parent search, `jira_rate_limited`, `jira_timeout`, `jira_not_found`, separate Jira schema, hook edit in J1).
- 2026-11-12, reviewer (revision 2): APPROVE, with eight minor findings. Fixed: the fields metadata is read across all pages, and the hierarchy call is listed (plan §4, J2); a ⚠ VERIFY plus a fallback for an unknown key in JQL and for reserved characters (plan §4.5, J2); the create returns 200 in both cases (plan §4, J3); a configured `PreferredIssueTypes` list replaces the default (plan §5, J1); T6.1b's README and web edits must be done before J4 (status, J0 header); proposals 10 and 11 marked superseded.
- Open for the gate: D17 in plan §3 already describes revision 2 (discovery, user edits). Approving the gate approves that wording too.
### Notes for the study
- The product answer (Cloud) invalidated four parts of the reused Server 7.8 design: login, CAPTCHA, Epic Link and the XSRF header. Asking for the instance facts first (proposal 1) kept the plan from being written against the wrong API.
