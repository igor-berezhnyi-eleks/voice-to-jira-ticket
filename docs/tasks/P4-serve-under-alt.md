# P4 — Serve our app under `/alt/`

- **Milestone:** M9 (revision 3)
- **Status:** todo
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
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
