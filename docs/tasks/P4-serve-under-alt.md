# P4 — Serve our app under `/alt/`

- **Milestone:** M9 (revision 3)
- **Status:** done
- **Depends on:** gate "Deployment plan revision 3 approved"
- **Plan sections:** `docs/deployment-plan.md` 2 (D25–D28), 3, 4.1–4.3, 4.5; implementation-plan 3 (D25–D28)
- **Parallel-safe with:** P5

## Goal

The app runs correctly at `/` (local) and under a path prefix set by `PathBase` (`/alt` on the VM), and this branch's deployment files run it as its own Compose project `voice-to-ticket-alt` behind the colleague's Caddy.

## Files

- `src/VoiceToTicket.Api/Program.cs`, a small options class for `PathBase` (in `Infrastructure/` or next to `Program.cs`)
- `src/VoiceToTicket.Api/Features/Jira/JiraSession.cs`
- `tests/VoiceToTicket.Api.Tests/**` (new and updated tests)
- `web/vite.config.ts`, `web/src/api.ts`, `web/src/jira/jiraApi.ts` and their tests
- `docker-compose.alt.yml` (new); `docker-compose.prod.yml` and `deploy/Caddyfile` (deleted)
- `.github/workflows/deploy.yml`
- `README.md`
- `docs/tasks/P4-*.md`, `docs/status.md`

## Out of scope

- The colleague's files on `main` (P5).
- Running the workflow (P6, human).
- Any change to `docker-compose.yml` for local runs.

## Acceptance criteria

- [ ] With `PathBase=/alt`: `GET /alt/health` is 200, `GET /alt/` serves the SPA, `/alt/api/...` routes work, and the Jira cookie has `Path=/alt/api/jira`.
- [ ] Without `PathBase`: all existing API tests pass unchanged, and the cookie keeps `Path=/api/jira`.
- [ ] The web build uses relative asset and API URLs. `npm test`, `npm run build` and `npm run e2e` pass at `/`.
- [ ] `docker-compose.alt.yml`: service `alt-api` (no ports, `PathBase: /alt`, on `default` and external `voice-to-jira_default`); `stt` with the P2 limits, on the project network only, using the external volume `voice-to-jira_stt-models`. `docker compose -p voice-to-ticket-alt -f docker-compose.alt.yml config` succeeds (with a dummy `ANTHROPIC_API_KEY`).
- [ ] `deploy.yml`: `workflow_dispatch` only, the same `concurrency: deploy`, the network check first, the health check on `/alt/health`, the status step covering both projects, no Caddy step.
- [ ] README "Shared deployment" describes `/alt/`, the order (P5 first) and the risks of revision 3.
- [ ] Every ⚠ VERIFY item below is checked against current docs, and the result is in this log.

## Verification

```
dotnet build
dotnet test
node scripts/check.mjs
```

In `web/`: `npm test`, `npm run lint`, `npm run build`, `npm run e2e`.

Optional, if Docker is available: run `docker-compose.alt.yml` locally behind a throwaway Caddy with the P5 route and open `/alt/`.

## Gate

None. The deploy and its checks are P6.

## Notes

- ⚠ VERIFY: where `UsePathBase` goes with `WebApplication` (and whether `UseRouting()` must follow it).
- ⚠ VERIFY: Vite `base: './'` in the build and the dev server (assets in `index.html`, the `/api` proxy).
- ⚠ VERIFY: Compose `extends` (what it does not copy, for example `depends_on`, and how it combines with `!reset`), if it is used instead of copying the services.
- ⚠ VERIFY: Compose adds the service name as an alias on every network the service joins (the reason for `alt-api`).

## Log

### Plan

1. API: `Infrastructure/PathBaseOptions.cs` (`PathBase`, empty or `/segment...`, no trailing slash, `ValidateOnStart`). `Program.cs` calls `UsePathBase` first when set; the explicit `UseRouting()` already follows it. `JiraSession` cookie path = `Request.PathBase + "/api/jira"`.
2. Tests first: `Features/Spa/PathBaseTests.cs` with `PathBase=/alt` (`/alt/health` 200, `/alt/` and `/alt/x` serve index.html, `/alt/assets/app.js`, `POST /alt/api/tickets`, `/alt/api/unknown` 404 problem), a Jira sign-in under `/alt/api/jira/session` with `path=/alt/api/jira`, and options validation. Existing tests stay unchanged.
3. Web: `base: './'` in `vite.config.ts`; call sites in `api.ts` and `jiraApi.ts` pass `api/...` (no leading slash), resolved by one helper against `document.baseURI` into a path, so `/` gives `/api/...` and `/alt/` gives `/alt/api/...`. New unit tests for the `/alt/` case; existing expectations stay `/api/...`.
4. `docker-compose.alt.yml` (services copied, not `extends`), delete `docker-compose.prod.yml` and `deploy/Caddyfile`, rewrite `deploy.yml`, README "Shared deployment".
5. ⚠ VERIFY: `UsePathBase` placement, Vite relative base, Compose `extends`, service-name alias per network.
### Decisions

- ⚠ VERIFY `UsePathBase` (learn.microsoft.com, aspnetcore-9.0 "Routing"): `UsePathBase` is listed among middleware that runs before `UseRouting` to change what routing sees; with `WebApplication`, middleware added before an explicit `UseRouting()` runs before route matching. The docs do not state a hard rule or the pass-through of other paths. Result: `UsePathBase` is the first middleware, followed (via the existing middleware) by the explicit `UseRouting()`. Checked in code: with the explicit `UseRouting()` removed, `PathBaseTests` still passed (20/20), so this .NET 10 `WebApplication` also re-runs routing after `UsePathBase`; the explicit call stays as the documented order.
- ⚠ VERIFY Vite relative base (vite.dev "Shared options → base", "Building → Relative base"): `base: './'` is for embedded deployment and makes all generated URLs relative to each file. Checked in the build: `dist/index.html` references `./assets/index-*.js` and `./assets/index-*.css`; no `url(/...)` in CSS. The dev server still serves at `/` and the `/api` proxy works (`npm run e2e` 9/9 via the dev server).
- ⚠ VERIFY Compose `extends` (docs.docker.com "Extend your Compose files", "services → extends"): referenced resources (volumes, networks, links, `volumes_from`, `depends_on`) are not imported; `!reset` is not described there (the merge page returned 404). Result: **not used**. `docker-compose.alt.yml` copies the two services, so it reads on its own and needs no `!reset`.
- ⚠ VERIFY service-name alias (docs.docker.com "container-spec → networks"): `use_service_name_alias` "controls whether the service name is registered as an alias of the service's containers on the network. It defaults to `true`", per network; services on the same external network reach each other by service name. Confirms naming ours `alt-api`.
- Web URLs: the call sites pass `api/...` without a leading slash (D28). One helper, `apiPath` in `api.ts`, resolves it against `document.baseURI` and passes the resulting path (`/api/...` at `/`, `/alt/api/...` under `/alt/`) to `fetch`. Same result as handing `fetch` the relative URL, but the existing tests that stub `fetch` by `/api/...` stay unchanged (no component tests outside the file list had to change), and the new tests cover `/alt/`.
- `PathBase` is a top-level key (`PathBase`, environment `PathBase`), validated at start: empty, or starting with `/`, no trailing slash, no `//`, `?`, `#` or `\`.
- No new dependency.

### Verified

- `dotnet build`: succeeded, 0 warnings.
- `dotnet test`: Api.Tests 947 passed, 10 skipped (the trait-gated Stt/Live tests, as before); Evaluation 78 passed, 1 skipped. New `PathBaseTests` 20/20: `/alt/health` 200; `/alt/` and `/alt/some/client/path` serve index.html; `/alt/assets/app.js`; `POST /alt/api/tickets` (Fake); `/alt/api/unknown` 404 `not_found`, `GET /alt/api/tickets` and `POST /alt/health` 405; Jira sign-in and sign-out under `/alt/api/jira/session` set `path=/alt/api/jira`; `PathBase` validation and failure at start. Existing tests unchanged, including `path=/api/jira` in `JiraEndpointTests`.
- `npm test`: 31 files, 513 tests passed (new: `apiPath` at `/` and `/alt/`, all three API calls and three Jira calls under `/alt/`).
- `npm run lint`: clean. `npm run build`: succeeded (the existing >500 kB chunk warning); relative asset URLs in `dist/index.html`.
- `npm run e2e`: 9/9 passed at `/`.
- `docker compose -p voice-to-ticket-alt -f docker-compose.alt.yml config` with `ANTHROPIC_API_KEY=dummy`: exit 0; `alt-api` on `default` and `edge` (`voice-to-jira_default`, external), no ports; `stt` on `default` only, `mem_limit` 6g, 2 threads, 1 worker; volume `voice-to-jira_stt-models` external; `voice-to-ticket-alt_dp-keys` new. Without the key: exit 1 (the deploy stops before touching containers).
- `node scripts/check.mjs`: all checks passed.

### Not verified

- The optional local Docker run behind a throwaway Caddy: Docker Desktop's engine was not running on this machine (`dockerDesktopLinuxEngine` pipe missing). The image itself is unchanged apart from the web build; the route is checked on the VM in P6.
- The workflow itself (runs in P6, human-led).
### Reviews

- 2026-11-24, round 1: CHANGES REQUESTED; 0 blocker, 1 major (README certificate command held a vertical-tab byte instead of the backslash in `<path>\voice-to-jira-root.crt`; fixed), 0 minor.
- 2026-11-24, round 2: APPROVE; 0 findings.
### Notes for the study

- One pass, no questions to the human: the plan settled the design (D25–D28). The one design choice made in the task, resolving `api/...` against `document.baseURI` in one helper, kept every existing test that stubs `fetch` by `/api/...` unchanged and inside the file list.
- The reviewer caught a real regression the tests could not: a Python heredoc turned `\v` in the README certificate command into a vertical-tab byte. The same slip then repeated in the task log. Lesson: write paths with backslashes through a script file or Edit, never through an escaped string.
- A mutation check (removing `UseRouting()`) showed the docs-based ordering rule is not required on .NET 10; recorded rather than overstated. The optional Docker check could not run (engine off); the human did the manual check.

