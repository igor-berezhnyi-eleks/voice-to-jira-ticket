# J9 — Jira address chosen by the user, checked against an allowlist

- **Milestone:** M7
- **Status:** done
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
1. Tests first (API): new `JiraSiteAddressTests` (normalize + allowlist: https only, userinfo, query/fragment, port, case, IP literal, `localhost`, wildcard needs a label before the suffix, no match for look-alikes), `JiraOptionsTests` (`AllowedHosts`, default-only fallback, startup validation), `JiraSessionTests` (site URL in cookie, old cookie falls back to the default or is no session, site no longer allowed = no session), `JiraEndpointTests` (400 and no Jira call for bad addresses, later body address ignored, status shape, `browse` link uses the session address), client test (absolute address per request, redirect = `jira_unavailable`, no auto-redirect on the handler).
2. API: new `JiraSiteAddress.cs`; `JiraOptions` (`AllowedHosts`, `DefaultSiteUrl`, validation; `SiteUrl` replaced); `JiraCredentials` gets `SiteUrl`; `JiraSession` stores and re-checks it; `JiraClient` builds the absolute URL from `credentials.SiteUrl` (no `BaseAddress`), `AddJira` turns off auto-redirect; `JiraSessionEndpoints` + `JiraContract` (request `siteUrl`, status `siteUrl`/`defaultSiteUrl`/`allowedHosts`); `CreateIssueEndpoint` link from the session address. Config: `AllowedHosts` in `appsettings.json` (empty) and Development (`*.atlassian.net`).
3. `npm run gen:contract`; web: `connectJira(siteUrl, login, secret)`, an address field in `ConnectPanel` (default or remembered address from localStorage key `vtt.jira.siteUrl`, no secrets), tests; fakeJira/CreateInJiraPage only where the status shape is used.
4. Docs: jira-plan sections 3, 5, 14.2 and D17 wording; status.md.
No outside-list files, no new dependency, no ⚠ VERIFY facts expected (URL parsing is .NET `Uri`; redirect behaviour is `HttpClientHandler.AllowAutoRedirect`, which the tests pin).
### Decisions
- 2026-11-18 (human): allowlist in configuration chosen over "any https address".
- `JiraCredentials` is now `(Login, Secret, SiteUrl, DisplayName?)`; `SiteUrl` is always a normalized, allowlisted address from the cookie, so no client or endpoint can use a request's address. `JiraClient` builds `{SiteUrl}/{path}` per request; the typed client has no `BaseAddress` and its primary handler is `SocketsHttpHandler { AllowAutoRedirect = false }` (`JiraServiceCollectionExtensions.CreateHttpHandler`, pinned by a test). A 3xx falls into the existing default mapping, `jira_unavailable`.
- Allowlist: exact host or `*.suffix` (needs a label before the suffix, so `atlassian.net` and `x.atlassian.net.evil.com` do not match). Matching is on the host only; port and path are free (a Server with a context path works). IP literals and `localhost` match only when listed exactly (a bracketed IPv6 host cannot be listed: patterns reject brackets, so it is never allowed) (the answer to the open question: yes, explicit only). A malformed entry (`*`, scheme, port, path, mid-name wildcard) fails startup; blank entries are ignored. Rejected input also: `?`, `#`, `@`, backslash, over 2048 characters.
- Startup: with Jira enabled, `BaseUrl` or `AllowedHosts` is required; a `BaseUrl` whose host is not on a configured allowlist fails startup. Empty allowlist = the `BaseUrl` host only, so `Jira:BaseUrl` alone behaves as before. `JiraOptions.SiteUrl` is replaced by `DefaultSiteUrl`.
- Cookie: `siteUrl` added to the payload. An old cookie without one gets `DefaultSiteUrl`, or is no session without a default; a stored site that is no longer allowed is no session (re-checked on every read).
- Session request: `siteUrl` is optional and empty means the default; no address and no default is 400 `validation`. Disallowed or malformed is 400 `validation`, no Jira call, no cookie. Status adds `siteUrl`, `defaultSiteUrl`, `allowedHosts` (the effective list). The connect log names the host only.
- Web: the address is remembered in `vtt.jira.siteUrl` after a successful connect (address only, try/catch), prefilled from it, else from `defaultSiteUrl`. `getJiraStatus` fills missing address fields with null/[] so an older server answer or partial mock does not crash the panel (this kept `App.test.tsx` and `e2e/jira.spec.ts`, outside the file list, unchanged).
- `appsettings.json` and `appsettings.Development.json` are unchanged: putting `AllowedHosts` in Development leaked into every test host (they load Development) and made `BaseUrl`-only tests invalid, and the Development `BaseUrl` already allows its own host. Docker or the company server needs `Jira__AllowedHosts__0=...` in `.env` (documented in jira-plan section 5). `docs/implementation-plan.md` D17 does not mention the base URL, so it was not edited; the changed rule is in jira-plan section 3.
- 2026-11-19: after the first real use, `JiraClient` now logs the HTTP status and content type (never the body) when Jira's answer is not JSON, with a test.
- 2026-11-19: edited `tests/VoiceToTicket.Api.Tests/ApiFactory.cs` (outside the file list; the Stop gate failed without it). The human set `Jira:AllowedHosts` and `Jira:Deployment=Server` in user-secrets for the company Jira, and the test hosts load Development settings and user-secrets, so every Jira endpoint test failed at startup validation. `ApiFactory` now forces `Deployment=Cloud`, `ServerAuthScheme=Bearer` and blank `AllowedHosts` entries 0-7 (blank entries are ignored), so tests no longer depend on the developer's secrets.
### Verified
- After the `ApiFactory` fix: `dotnet test` with the Stop gate's filter: Api.Tests 745 passed, Evaluation 57 passed, with the human's company-Jira secrets present.
- `dotnet build`: 0 warnings, 0 errors. `dotnet test`: Api.Tests 745 passed, 3 skipped (live/stt categories); Evaluation 57 passed, 1 skipped.
- `node scripts/check.mjs`: build, test, `npm run build`, `npm run test` (366), `npm run lint` all PASS.
- Contract regenerated (`UPDATE_SNAPSHOTS=1`, `npm run gen:contract`).
- The human connected the app to the company Jira Server (`jd.eleks.com`) with a token after adding it to `Jira:AllowedHosts` (user-secrets). Not run by the agent.
### Not verified
- Nothing run by the agent against a live Jira (Cloud or Server). The Cloud site and the off-allowlist message were not reported as checked by the human. `npm run e2e` not run; `check.mjs` does not run it.
- The first company-Jira connect failed with `jira_unavailable` (HTML body on a 2xx answer) and then worked after an API restart; the cause is a likely stale Cloud-mode configuration, not confirmed.
### Reviews
- 2026-11-18, round 1: APPROVE, 0 blocker, 0 major, 2 minor (appsettings files in the list but unchanged, explained in Decisions; IPv6 `[::1]` not allowlistable, fails closed, log wording corrected).
### Notes for the study
- The human's first real connect hit two things the offline tests could not: the allowlist had no entry for the company host, and a connect that failed on an HTML answer gave no clue why. Both were fixed with config advice plus a log line; the design held up.
- User-secrets set for the real site leaked into the test hosts and failed the Stop gate (the same class of leak as `Provider=Claude` in T3.2); `ApiFactory` now pins the Jira settings. The harness caught it, the agent fixed it and logged an out-of-list edit.
- The reviewer approved in round 1 and caught only minor points; it did not catch that real secrets would break the tests, since it ran with none.
- The agent asked before a design change (per-session deployment) and wrote J10 for approval instead of widening J9.
