# Deployment plan (M9)

Status: **revision 3, approved 2026-11-24** (human request and approval the same day).

- Revision 1 (approved 2026-11-21) ran our app as a second stack on port 8443. Port 8443 is closed, so it was replaced.
- Revision 2 (approved 2026-11-21, done in P0–P3) deployed our app into the colleague's slot. Only one site was live at a time: a run from this branch replaced the colleague's site, and a run from `main` brought it back.
- **Revision 3** runs both apps at the same time on the same address. The colleague's app stays at `https://10.17.89.14/`. Ours moves to `https://10.17.89.14/alt/` ("alternative version"). Revision 2's measurements (P2) are kept: they are the basis for section 5.

The colleague's deployment (`main`: `.github/workflows/deploy.yml`, `docker-compose.prod.yml`, `deploy/Caddyfile`) runs on a self-hosted GitHub runner on the VM. It builds the branch's code there and serves it through Caddy on port 443 (HTTPS is needed for the microphone). It deploys on every push to `main`. In revision 3, the colleague's Caddy also forwards `/alt/` to our app. Our app runs as its own Compose project, without its own Caddy, and is deployed by this branch's copy of the workflow.

## 1. Human decisions

| # | Question | Answer |
|---|---|---|
| H1 | Which VM? | The colleague's VM, 10.17.89.14: 2 vCPU, 8 GB RAM (7.25 GiB visible to Docker, P2), 100 GB HDD, Ubuntu 26.04. (2026-11-20) |
| H2 | How does our code reach the VM? | Through the colleague's workflow, run by hand from this branch (Actions → Deploy → Run workflow → this branch). Revision 2 allowed only one site at a time; **H6 replaces that part.** (2026-11-21) |
| H3 | Ukrainian model on the VM | **Keep large-v3** (decided in P2, 2026-11-23). About 0.80 s per second of audio. |
| H4 | Who may use the site? | **Anyone on the corporate network**, like the colleague's site. Risks accepted for the PoC (section 7). (2026-11-20) |
| H5 | VM access | SSH reaches the VM, but the human cannot sign in, and only 80 and 443 are open. Everything on the VM happens through the workflows. (2026-11-21) |
| H6 | Where does each app live? | **Both apps live at once: the colleague's at `/`, ours at `/alt/`** ("alternative version"). (2026-11-24) |

## 2. Decisions

D21 and D22 are revision 2; D25–D28 replace them (approved 2026-11-24). D23 and D24 stay.

| # | Decision | Rationale |
|---|---|---|
| ~~D21~~ | ~~Our app deploys into the colleague's slot; one site is live at a time.~~ Replaced by D25–D27. | |
| ~~D22~~ | ~~Same Caddy container and storage as the colleague's.~~ Replaced by D26, which keeps the same outcome: one certificate. | |
| D23 | **Open access on the corporate network (H4)**, with mitigations: a spending limit on the Anthropic key, the Jira allowlist (J9), and the README's "shared deployment" note. | Same exposure as the colleague's site. A login is out of scope for the PoC. |
| D24 | **One transcription per model at a time** (Speaches 1 worker, 2 CPU threads) and a waiting list in the API that answers 503 `stt_busy` when it is full (P3). | On 2 vCPU a second worker only splits the same cores. |
| D25 | **Both apps on one origin, split by path.** The colleague's Caddy sends `/alt/*` to our API and everything else to the colleague's. `/alt` without the slash redirects to `/alt/`. | No DNS name and no second open port, so a path is the only way. The colleague's site is never replaced, and reviewers can compare both. |
| D26 | **The colleague's project keeps Caddy.** Ports 80 and 443, the Caddy storage volume and the trusted certificate stay in project `voice-to-jira`, deployed from `main`. Their only change is the Caddyfile route (task P5). | The colleague's site and certificate do not depend on our branch. Their deploy keeps `--force-recreate --remove-orphans` and does not touch our containers, because those are in a different project. |
| D27 | **Our app is its own Compose project, `voice-to-ticket-alt`**, from one VM-only file, `docker-compose.alt.yml`. It has no Caddy and no published ports. Our API service is named **`alt-api`** and also joins the colleague's network `voice-to-jira_default`, so their Caddy can reach it. `stt` stays on our project's own network only. Our `docker-compose.prod.yml` and `deploy/Caddyfile` are deleted. | Compose adds the service name as a DNS alias on every network a service joins. Our service named `api` on their network would collide with their `api`, and Caddy would split requests between the two apps. A separate project means neither deploy removes the other's containers as "orphans". |
| D28 | **Our app learns its path from configuration, not from the build.** The API reads `PathBase` (empty locally, `/alt` on the VM) and calls `UsePathBase`. Caddy does not strip the prefix. The web build uses relative URLs (Vite `base: './'`, API calls without a leading slash), so one image works at `/` locally and at `/alt/` on the VM. The Jira cookie's `Path` becomes `PathBase + /api/jira`. | With a stripped prefix, the API would set `Path=/api/jira`. The browser would then never send the cookie to `/alt/api/jira`, and would send it to the colleague's `/api/jira` instead. Local runs and tests keep working without a prefix. |

## 3. How the two apps share the VM

```
 10.17.89.14 :443  (Caddy, project "voice-to-jira", from main)
   /alt   → 308 redirect to /alt/
   /alt/* → alt-api:8080  (project "voice-to-ticket-alt", from feature/poc-v2) ──► stt:8000
   /*     → api:8080      (project "voice-to-jira", the colleague's app)

 networks:  voice-to-jira_default      = caddy, api, alt-api
            voice-to-ticket-alt_default = alt-api, stt
 volumes:   voice-to-jira_caddy_data (certificate, the colleague's)
            voice-to-jira_stt-models (4.3 GB of models from revision 2; ours, reused as external)
            voice-to-ticket-alt_dp-keys (new)

 Actions → Deploy → Run workflow → branch:
   main (or a push to main) → rebuilds the colleague's app and Caddy; ours keeps running
   feature/poc-v2           → rebuilds our app; the colleague's keeps running
```

- **Order.** P5 (the colleague's Caddyfile on `main`) comes first. Until then, `/alt/` has no route and our health check fails.
- **Dependency.** Our project joins `voice-to-jira_default`, so the colleague's stack must be up when ours deploys. Our workflow checks this first and stops with a clear message if the network is missing. If our stack is down, only `/alt/` fails (502); the colleague's site is not affected.
- **Never merge this branch into `main`.** Our `deploy.yml` would replace theirs.
- **Workflow file.** Ours stays at `.github/workflows/deploy.yml`, named "Deploy", because GitHub shows "Run workflow" only for workflows that also exist on the default branch. A run from a branch uses that branch's copy of the file. Confirmed in practice by P2.
- **Same secrets file.** Ours still reads `ANTHROPIC_API_KEY` from `/opt/voice-to-jira/.env`.

## 4. Changes

### 4.1 Our app (P4)

- **API:** a `PathBase` setting. If it is not empty, `app.UsePathBase(PathBase)` runs first. The SPA rewrite and static files keep seeing the path without the prefix, so they do not change. The Jira cookie path becomes `context.Request.PathBase + "/api/jira"`. ⚠ VERIFY: where `UsePathBase` must go with `WebApplication` (the docs say routing has to come after it, which may need an explicit `UseRouting()`).
- **Web:** Vite `base: './'`. Every API call in `web/src/api.ts` and `web/src/jira/jiraApi.ts` uses a relative URL (`api/tickets`), so it resolves against `/alt/` on the VM and `/` locally. Unit tests that expect `/api/...` URLs are updated to match. This changes what they expect; it does not weaken them. ⚠ VERIFY: how Vite builds and serves with a relative `base` (assets in `index.html`, the dev server, the `/api` proxy).
- **Tests:** API tests with `PathBase=/alt`: `/alt/health` is 200, `/alt/` serves the SPA, the Jira cookie has `Path=/alt/api/jira`. Without `PathBase`, the existing tests stay green and the cookie keeps `Path=/api/jira`. `npm run e2e` keeps running at `/`.

### 4.2 `docker-compose.alt.yml` (P4, replaces our `docker-compose.prod.yml`)

- `alt-api`: built from `src/VoiceToTicket.Api/Dockerfile`, `restart: unless-stopped`, no ports, no `env_file`. Gets all the environment of today's prod override (the Claude key from the secrets file, providers, Jira, `ASPNETCORE_FORWARDEDHEADERS_ENABLED`, VM timeouts 300 s and 600 s), plus `PathBase: /alt`, `DataProtection__KeysPath: /keys` and `Stt__BaseUrl: http://stt:8000`. Networks: `default` and `edge` (`external: true`, `name: voice-to-jira_default`).
- `stt`: as in `docker-compose.yml` plus the VM settings (`mem_limit: 6g`, `WHISPER__CPU_THREADS=2`, `WHISPER__NUM_WORKERS=1`), no ports. The models volume is `external: true`, `name: voice-to-jira_stt-models` (left over from revision 2), so the models are not downloaded again.
- It may reuse `docker-compose.yml` through `extends` instead of copying it. ⚠ VERIFY which keys `extends` does not carry over (for example `depends_on`) and how `!reset` combines with it.

### 4.3 Our `.github/workflows/deploy.yml` (P4)

- Same name and path. **Only `workflow_dispatch`**: the `push: main` trigger is removed.
- Same `concurrency: deploy` group as the colleague's, so the two apps never build at the same time on 8 GB.
- `COMPOSE` = `docker compose -p voice-to-ticket-alt -f docker-compose.alt.yml --env-file /opt/voice-to-jira/.env`.
- Steps:
  1. Check that `voice-to-jira_default` exists.
  2. `up -d --build --remove-orphans`. The Caddy restart step is gone.
  3. Health check on `https://10.17.89.14/alt/health`.
  4. The status step, for both projects: containers, `docker stats`, the `stt` log, Hugging Face.
  5. Prune dangling images.

### 4.4 The colleague's `deploy/Caddyfile` on `main` (P5, a PR by or with the colleague)

```
https://10.17.89.14 {
	tls internal
	redir /alt /alt/ 308
	handle /alt/* {
		reverse_proxy alt-api:8080
	}
	handle {
		reverse_proxy api:8080
	}
}
```

The global block (`default_sni`) is unchanged. Their compose file and workflow do not change. ⚠ VERIFY: Caddy resolves `alt-api` when a request comes in, not at startup, so Caddy starts and serves `/` while our stack is down.

### 4.5 README (P4)

The "Shared deployment" section is updated with the new URL (`/alt/`), the order (P5 first), the fact that both apps run at once, how to read the status, and the risks below.

## 5. Resources with both apps

From P2 (2026-11-23): our `stt` used 4.99 GiB (limit 6g), our API 61 MiB, Caddy 40 MiB, out of 7.25 GiB. The colleague's API has no speech-to-text in the container, so we expect about 100 MiB; this is not measured yet. Expected steady use is about 5.3 GiB. That leaves about 1 GiB for a Docker build, which P2 showed is enough with `stt` running.

CPU: a Ukrainian transcription takes both vCPUs for about 0.8 s per second of audio. During it, the colleague's requests (mostly waiting on Claude) and builds get slower. P6 measures this once.

## 6. Tasks

| ID | Title | Files | Depends on |
|---|---|---|---|
| P0–P3 | Revision 2 (done) | | |
| P4 | Serve our app under `/alt/` | API `PathBase` (`Program.cs`, a small options class), `Features/Jira/JiraSession.cs`, `web/vite.config.ts`, `web/src/api.ts`, `web/src/jira/jiraApi.ts`, their tests, API tests, `docker-compose.alt.yml` (new), `docker-compose.prod.yml` and `deploy/Caddyfile` (deleted), `.github/workflows/deploy.yml`, `README.md` | revision 3 approved |
| P5 | The colleague's Caddyfile route (colleague-led, on `main`) | the colleague's `deploy/Caddyfile` | revision 3 approved, the colleague agrees |
| P6 | Side-by-side deploy and checks (human-led) | `docs/tasks/P6-*.md` log; `docker-compose.alt.yml` only if a limit has to change | P4, P5 |

P6 checks:

- Both sites open without a certificate warning.
- `/alt` redirects to `/alt/`.
- An English and a Ukrainian ticket on `/alt/`, and a ticket on `/`.
- After a Jira sign-in on `/alt/`, `vtt_jira` has `Path=/alt/api/jira` and `Secure`, and is not sent to `/api/...`.
- A push or run on `main` leaves `/alt/` working.
- `docker stats` with both apps up.
- The colleague's ticket time while a Ukrainian transcription runs.

## 7. Risks

- **The colleague's `main` must change (P5).** It is their repository branch and their PR. Until it merges, `/alt/` does not exist. Mitigation: the change is one Caddyfile route, and their site behaves as before when our stack is down.
- **Coupling to the colleague's network name.** `voice-to-jira_default` exists only while their stack is up and keeps its name only while their project is called `voice-to-jira`. A `docker compose down` on their side fails to remove the network while `alt-api` is attached to it. Mitigation: our workflow checks the network first; a shared named network would need a change to their compose file, which we avoid for now.
- **One origin.**
  - `localStorage` is shared. Our keys are `vtt.*`. `eleks-ui-theme-mode` is used by both apps, so the light/dark choice carries over between them. Accepted.
  - The colleague's `jira_session` cookie (path `/`) is also sent to `/alt/`. Our API ignores it. Ours (D28) is never sent to their app.
  - Microphone permission covers both apps.
- **Shared RAM and CPU (section 5).** A build on either side runs next to `stt` at about 5 GiB. If a build runs out of memory, the fix is a lower `stt` limit or `medium` for Ukrainian; the Ukrainian model would be a new H3 decision.
- **One Anthropic key, two apps.** Both apps spend the key in the colleague's secrets file. The spending limit (section 8) covers both.
- **Old volume.** `voice-to-jira_dp-keys` from revision 2 stays as a small leftover. Users sign in to Jira again once.
- **Open access (D23)** and the **Speaches release candidate** stay as in revision 2.

## 8. Prerequisites (human)

- [x] Write access to the repository (confirmed 2026-11-21).
- [x] This branch pushed to the repository; revision 2 deployed and measured (P2, 2026-11-23).
- [x] Revision 3 approved (D25–D28), 2026-11-24; implementation-plan section 3 updated.
- [ ] The colleague agrees: the `/alt/` route on `main` (P5), both apps running on the VM at once, and both using the Anthropic key.
- [ ] A spending limit on that key, sized for two apps.
