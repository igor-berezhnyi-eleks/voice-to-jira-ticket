# Deployment plan (M9)

Status: **approved 2026-11-21** (gate "Deployment plan approved", task P0). Written from the human's request and answers the same day, and from the colleague's deployment on `develop`/`main` (PR #18: `.github/workflows/deploy.yml`, `docker-compose.prod.yml`, `deploy/Caddyfile`).

The goal is to run this app on the team VM (10.17.89.14) **next to** the colleague's app, not instead of it. The colleague's pipeline is reused as a pattern: a self-hosted GitHub runner on the VM, a production compose override, Caddy for HTTPS (browsers allow the microphone only on secure pages), secrets outside the repository and a health check. What differs is that our app has a speech-to-text container (Speaches, two models) and runs on the same small VM as his app.

## 1. Human decisions (2026-11-20)

| # | Question | Answer |
|---|---|---|
| H1 | Which VM? | **The same VM as the colleague's site**, 10.17.89.14: 2 vCPU, 8 GB RAM, 100 GB HDD, Ubuntu 26.04. |
| H2 | How does our code reach the VM? | **Our own workflow, deploying our own branch.** The colleague's workflow, files and site stay as they are. |
| H3 | Ukrainian model on the VM | **Measure, then decide.** Deploy with large-v3, time it on the VM, and switch to `large-v3-turbo` or `medium` only if it is too slow (that needs a paid re-run of the Ukrainian evaluation, with the human's go-ahead). |
| H4 | Who may use the site? | **Anyone on the corporate network**, like the colleague's site. The risks are accepted for the PoC (section 7). |

## 2. Decisions

| # | Decision | Rationale |
|---|---|---|
| D21 | **A separate Compose stack on the shared VM.** Project name `voice-to-ticket` (his is `voice-to-jira`), HTTPS on port **8443** (his Caddy owns 80 and 443), our own files (`docker-compose.vm.yml`, `deploy/vm/Caddyfile`, `.github/workflows/deploy-vm.yml`), secrets in `/opt/voice-to-ticket/.env`. | Different project names keep containers, networks and volumes apart, so neither deploy's `--remove-orphans` touches the other stack. Different file names mean a later merge from `main` cannot mix the two setups. Both sites are available at the same time. |
| D22 | **Our Caddy shares the colleague's Caddy storage**, so the root certificate users already trust also signs our certificate. Fallback: our own `caddy_data` volume and a second root certificate for users to trust. | Caddy instances that use the same storage share certificates and coordinate (⚠ VERIFY in the Caddy docs). Without this, every user has to install a second certificate. The cost is a dependency on his volume name. |
| D23 | **Open access on the corporate network (H4)**, with mitigations: a spending limit on the Anthropic key, the Jira allowlist (J9) kept, the README's "local demos only" note replaced by a "shared PoC deployment" note listing the risks. | Same exposure as the colleague's site. A login is out of scope for the PoC. |
| D24 | **One transcription per model at a time.** Speaches keeps `WHISPER__NUM_WORKERS=1` and gets `WHISPER__CPU_THREADS=2` (the VM's vCPUs). Task P3 adds a limit in the API: one running request and a short waiting list per language; beyond that the API answers 503 `stt_busy` at once. | On 2 vCPU a second worker only splits the same cores and makes the total slower. Without a limit, queued requests run into `stt_timeout` after minutes, with a message that blames the recording. |

## 3. How the two sites live on the VM

```
                         10.17.89.14
 ┌────────────────────────────────────────────────────────────────────┐
 │ project voice-to-jira (colleague, his deploy.yml, push to main)     │
 │   caddy  :80 :443 ──► api :8080      (browser-side STT, light)      │
 │      │ volume voice-to-jira_caddy_data  (root CA users trust)       │
 │      │                                                              │
 │ project voice-to-ticket (ours, deploy-vm.yml, push to our branch)   │
 │   caddy  :8443 ──► api :8080 ──► stt :8000 (Speaches, 2 models)     │
 │      └── same caddy storage (D22)   volumes: stt-models, dp-keys    │
 │                                                                    │
 │ one self-hosted GitHub runner (registered to the repository)       │
 └────────────────────────────────────────────────────────────────────┘
 His site:  https://10.17.89.14/        Ours:  https://10.17.89.14:8443/
```

- **One version of each app at a time.** Each deploy replaces that app's previous version. Two versions of *our* app at once are not planned: each STT container needs about 4.5 GB of RAM.
- **The colleague's "Run workflow" branch picker** deploys the chosen branch *into his slot* (project `voice-to-jira`, port 443). Our branch has no `deploy.yml`, so it cannot be picked there. That is intended: ours is deployed only by `deploy-vm.yml`.
- **The runner** runs one job at a time, so his deploys and ours wait for each other. The two workflows use different `concurrency` groups.

## 4. Files (P1)

### 4.1 `docker-compose.vm.yml` (override, used with `docker-compose.yml`)

- `api`: `ports: !reset []`, `restart: unless-stopped`, `env_file` replaced with `/opt/voice-to-ticket/.env` (required). The Ukrainian STT timeout is set from P2's measurement.
- `stt`: `ports: !reset []` (Speaches is reachable only from `api`), `WHISPER__CPU_THREADS: 2`, `WHISPER__NUM_WORKERS: 1` (⚠ VERIFY the variable names in the Speaches configuration). A memory limit is added only after P2 measures the peak, so the colleague's app keeps room.
- `caddy`: `caddy:2` (the same image as the colleague's, so the shared storage format matches), port `8443:8443`, `deploy/vm/Caddyfile` mounted read-only, `/data` on the external volume `voice-to-jira_caddy_data` (⚠ VERIFY the name with `docker volume ls` on the VM).

### 4.2 `deploy/vm/Caddyfile`

```
{
	default_sni 10.17.89.14
}

https://10.17.89.14:8443 {
	tls internal
	reverse_proxy api:8080
}
```

⚠ VERIFY: Caddy's `reverse_proxy` default response timeout. A Ukrainian transcription on the VM can take minutes, and the proxy must not cut it off before the API's own timeout.

### 4.3 `.github/workflows/deploy-vm.yml`

- Trigger: `push` to our deploy branch (proposed: `feature/poc-v2` once it is pushed). A `push` trigger works from any branch. `workflow_dispatch` (the manual button) is listed only when the workflow file is also on the default branch (⚠ VERIFY), so it is optional and needs the colleague's agreement.
- `runs-on: self-hosted`, `concurrency: { group: deploy-voice-to-ticket, cancel-in-progress: false }`.
- Steps:
  1. Checkout.
  2. `docker compose -p voice-to-ticket -f docker-compose.yml -f docker-compose.vm.yml up -d --build --remove-orphans`. No `--force-recreate` for the whole stack: that would restart `stt` and reload both models on every deploy (seconds to minutes on an HDD).
  3. `docker compose … up -d --force-recreate --no-deps caddy`, because compose does not notice changes to the mounted Caddyfile.
  4. Health check: `curl -fsS --retry 15 --retry-delay 2 --retry-connrefused https://10.17.89.14:8443/api/health`. The first deploy downloads 4.3 GB of models; the API answers before `stt` is ready, so the check does not wait for STT.
  5. `docker image prune -f`.

### 4.4 README

A "Shared deployment" section: the URL, how to trust the certificate, how a deploy is started, the first-start model download, the risks from D23, and how to read logs on the VM (`docker compose -p voice-to-ticket logs`).

## 5. Measurement on the VM (P2)

Done after the first deploy, with the real models:

| Measure | How | Decides |
|---|---|---|
| English and Ukrainian speed | One 1-minute recording each, warm, from the logged `DurationMs` | `Stt:Languages:*:TimeoutSeconds` on the VM; H3 (large-v3 or smaller) |
| Queue | Three 1-minute recordings sent at once | P3's waiting-list size |
| RAM peak | `docker stats` during the runs and during a deploy (the build also runs on the VM) | `stt` memory limit; whether both apps fit |
| Colleague's site | Opened during the runs | That ours does not make his unusable |

Reference on the laptop (L3): about 4 s per 10 s of English audio and 7 s for large-v3, about 4.5 GB RAM. The VM is expected to be several times slower; the numbers are recorded in P2's log, not guessed.

## 6. Tasks

| ID | Title | Files | Depends on |
|---|---|---|---|
| P0 | Deployment plan | this file, `docs/tasks/P*.md`, `docs/status.md` | human request |
| P1 | VM deployment files and workflow | `docker-compose.vm.yml`, `deploy/vm/Caddyfile`, `.github/workflows/deploy-vm.yml`, `README.md` | P0 approved |
| P2 | First deploy and measurements (human-led) | `docs/tasks/P2-*.md` log, `docker-compose.vm.yml` (timeouts, limits only) | P1, prerequisites in section 8 |
| P3 | Transcription busy limit (`stt_busy`) | `Features/Transcriptions/**`, `Infrastructure/ErrorCodes.cs`, web error messages (en, uk), tests | P0 approved; size from P2 |

If P2 decides to switch the Ukrainian model, that becomes its own task (config change plus a paid re-run of the Ukrainian evaluation).

## 7. Risks

- **Open access (D23).** Anyone on the network can spend the Claude key, and their transcripts go to Claude. Mitigation: a spending limit in the Anthropic console; no transcript text in logs at Information level (already a rule).
- **Shared CPU and RAM.** Our STT can slow the colleague's site, and a deploy builds images on the same 8 GB. Mitigation: P2 measures it; a memory limit on `stt`.
- **Shared Caddy storage (D22).** If the colleague renames or deletes his volume, our deploy fails. Fallback: our own volume and a second certificate.
- **Port 8443** may be blocked by the VM firewall or the network. Checked in section 8.
- **Speaches image is a release candidate** (`0.9.0-rc.3-cpu`), as in local runs.

## 8. Prerequisites (human)

- [x] Write access to the repository (confirmed 2026-11-21).
- [ ] The colleague agrees to share the VM, his Caddy storage and the runner.
- [ ] SSH access to the VM (or the colleague's help) to create `/opt/voice-to-ticket/.env` and run the checks below.
- [ ] Port 8443 open on the VM (`sudo ufw status`) and reachable from your laptop.
- [ ] The VM can reach `ghcr.io` (Speaches image) and `huggingface.co` (models).
- [ ] A spending limit on the Anthropic key used on the VM.
