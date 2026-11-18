# J9 — Jira address chosen by the user, checked against an allowlist

- **Milestone:** M7
- **Status:** todo
- **Depends on:** J7 approved and committed (it changes the same files); human approval of this task file
- **Plan sections:** `docs/jira-plan.md` 3 (session), 5 (configuration), 14.2; D17. **This changes a plan decision** ("BaseUrl from configuration only, no SSRF"): the human chose an allowlist on 2026-11-18, so the plan sections are updated as part of the task.
- **Parallel-safe with:** none

## Goal

The user types the Jira address (Cloud site or company Server) on the Connect panel instead of it being hardcoded in `Jira:BaseUrl`. The API only calls hosts that match an allowlist in configuration, so it cannot be pointed at arbitrary or internal hosts.

## Files

- `src/VoiceToTicket.Api/Features/Jira/**` (options, client, session, endpoints, contract)
- `src/VoiceToTicket.Api/appsettings.json`, `appsettings.Development.json`
- `contract/jira.schema.json`, `web/src/jiraContract.ts` (regenerated)
- `web/src/jira/jiraApi.ts`, `ConnectPanel.tsx`, `CreateInJiraPage.tsx` only where the site URL or status is used, and their tests
- `tests/VoiceToTicket.Api.Tests/Jira/**`
- `docs/jira-plan.md` (sections 3, 5, 14.2, D17 wording), `docs/tasks/J9-*.md`, `docs/status.md`

## Proposed design (for approval)

1. `Jira:AllowedHosts`: list of host patterns, exact (`jira.company.com`) or leading wildcard (`*.atlassian.net`). `Jira:BaseUrl` stays as an optional default shown in the panel; if set and the list is empty, it is the only allowed host (today's behaviour keeps working).
2. `POST /api/jira/session` takes `{siteUrl, login, secret}`. The server normalizes the URL (https only, no userinfo, no query or fragment, port 443 or an explicit port, lowercased host), rejects it with 400 `validation` unless the host matches the allowlist, then calls `myself` on it.
3. The site URL is stored in the encrypted session cookie with the credentials; every later call and the `/browse/KEY` link use the cookie's URL, never one from the request.
4. The HTTP client takes the base address per request (no fixed `BaseAddress`). Redirects are not followed (a redirect to another host would bypass the allowlist).
5. `GET /api/jira/status` returns `siteUrl` (connected) and `defaultSiteUrl`, plus `allowedHosts` for the hint text. Deployment (Cloud or Server) stays a global setting.
6. Connect panel: a "Jira address" field, prefilled with the default or the remembered one (the address only, in localStorage; no secrets).

## Out of scope

- Detecting Cloud versus Server from the address (still `Jira:Deployment`).
- Several sessions at once, or per-address deployment settings.
- Any Cloud or Server request shapes.

## Acceptance criteria

- [ ] A host not on the allowlist, `http://`, a URL with userinfo, or an IP-literal or `localhost` host (unless explicitly listed) is 400 `validation`, and no HTTP call is made.
- [ ] An allowed address is used for every call in the session, including create and the returned `browse` link; a different address in a later request body is ignored.
- [ ] A Jira redirect is not followed and maps to `jira_unavailable`.
- [ ] An old cookie without a site URL falls back to the configured default, or counts as no session.
- [ ] With only `Jira:BaseUrl` configured, behaviour is as before.
- [ ] The cookie and logs never contain the secret; the site URL may be logged by host only.
- [ ] Contract regenerated; web shows the address field; existing Cloud and Server tests pass except the session shape.
- [ ] `node scripts/check.mjs` passes.

## Verification

```
dotnet build
dotnet test
node scripts/check.mjs
```

Manual check for the human: connect with the Cloud site and then the company Server by typing each address; try an address off the allowlist.

## Gate

Human approval of the design above (especially points 1 and 4) before work starts.

## Notes

- Open question: should localhost be allowlistable for tests? Proposed: yes, only if listed explicitly.

## Log

### Plan
### Decisions
- 2026-11-18 (human): allowlist in configuration chosen over "any https address".
### Verified
### Not verified
### Reviews
### Notes for the study
