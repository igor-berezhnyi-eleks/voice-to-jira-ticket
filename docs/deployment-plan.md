# Deployment plan (M9)

Status: **revision 2, 2026-11-21** (human request the same day). Revision 1 (approved 2026-11-21) ran our app as a second stack on port 8443. It is replaced because port 8443 is closed and the human cannot sign in to the VM to open it or to create a secrets file. Revision 2 reuses the colleague's deployment slot.

The colleague's deployment (PR #18 on `main`: `.github/workflows/deploy.yml`, `docker-compose.prod.yml`, `deploy/Caddyfile`) runs on a self-hosted GitHub runner on the VM, builds the branch's code there and serves it through Caddy on `https://10.17.89.14/` (HTTPS is needed for the microphone). Its "Run workflow" button deploys any branch that contains these files. This branch gets its own copies of the three files, adapted to our app (speech-to-text container, different health route, our settings), so running the workflow from this branch deploys our app into the same slot.

## 1. Human decisions

| # | Question | Answer |
|---|---|---|
| H1 | Which VM? | The colleague's VM, 10.17.89.14: 2 vCPU, 8 GB RAM, 100 GB HDD, Ubuntu 26.04. (2026-11-20) |
| H2 | How does our code reach the VM? | **Through the colleague's workflow**, run by hand from this branch (Actions → Deploy → Run workflow → this branch). **Only one site at a time is fine**: deploying this branch replaces his site, deploying `main` brings his back. (2026-11-21, replaces "own workflow, own branch") |
| H3 | Ukrainian model on the VM | **Measure, then decide.** Deploy with large-v3, time it, and switch to `large-v3-turbo` or `medium` only if it is too slow (a paid re-run of the Ukrainian evaluation, with the human's go-ahead). (2026-11-20) |
| H4 | Who may use the site? | **Anyone on the corporate network**, like the colleague's site. Risks accepted for the PoC (section 7). (2026-11-20) |
| H5 | VM access | SSH reaches the VM, but the human cannot sign in, and port 8443 is closed. Everything on the VM happens through the workflow. (2026-11-21) |

## 2. Decisions

| # | Decision | Rationale |
|---|---|---|
| D21 | **Our app deploys into the colleague's slot**, using copies of his three files on this branch: same workflow name and path, same Compose project `voice-to-jira`, same port 443, same Caddy storage, same secrets file `/opt/voice-to-jira/.env`. Our copies differ only where our app needs it (section 4). One site is live at a time. | Port 443, the runner and the secrets file already work, and nothing on the VM needs a sign-in. GitHub runs the workflow file of the branch chosen in "Run workflow", so his file on `main` stays untouched. |
| D22 | **The certificate users already trust keeps working**, because the Caddy container and its storage volume (`voice-to-jira_caddy_data`) are the same. | Same project name means the same volume, so no second certificate. |
| D23 | **Open access on the corporate network (H4)**, with mitigations: a spending limit on the Anthropic key, the Jira allowlist (J9) kept, the README's "local demos only" note replaced by a "shared deployment" note listing the risks. | Same exposure as the colleague's site. A login is out of scope for the PoC. |
| D24 | **One transcription per model at a time.** Speaches keeps `WHISPER__NUM_WORKERS=1` and gets `WHISPER__CPU_THREADS=2`. Task P3 adds a limit in the API: one running request and a short waiting list per language; beyond that the API answers 503 `stt_busy` at once. | On 2 vCPU a second worker only splits the same cores. Without a limit, queued requests run into `stt_timeout` after minutes, with a message that blames the recording. |

## 3. How the slot is shared

```
 10.17.89.14 — Compose project "voice-to-jira", https://10.17.89.14/
   caddy :80 :443 ──► api :8080            (volume caddy_data: the trusted root certificate)
                        │
                        └──► stt :8000     (ours only: Speaches, volume stt-models)

 Actions → Deploy → Run workflow → branch:
   main             → his api (browser speech-to-text); our stt container is removed as an orphan
   feature/poc-v2   → our api + stt; the models volume survives his deploys, so ours restarts fast
```

- **Coordination.** Each manual run replaces the other app. A push to `main` also deploys his app automatically. Agree with the colleague when our version is up.
- **Never merge this branch into `main`** while both apps exist: `main` deploys on every push, so his app would be replaced for good. A merge from `main` into this branch must keep our versions of the three files.
- **Volumes.** `stt-models` (about 4.3 GB) and `dp-keys` are named volumes. His deploy's `--remove-orphans` removes our `stt` container but not the volumes, so the models are downloaded only once.

## 4. Files (P1)

### 4.1 `.github/workflows/deploy.yml` (our copy)

Same name, triggers (`push` to `main`, `workflow_dispatch`), `concurrency: deploy`, runner and Compose command prefix as his. Differences:

- **No `--force-recreate` for the whole stack**: it would restart `stt` and reload both models on every deploy. Instead `up -d --build --remove-orphans`, then `up -d --force-recreate --no-deps caddy` (Compose does not notice changes to the mounted Caddyfile; this is why he used the flag).
- **Health check on `/health`** (our route; his app uses `/api/health`).
- **A status step** that always runs and prints `docker compose ps`, `docker stats --no-stream`, the last lines of the `stt` log and whether the VM reaches `huggingface.co`. It replaces signing in to the VM (H5).
- Dangling images are pruned, as in his.

### 4.2 `docker-compose.prod.yml` (our copy)

- `api`: `restart: unless-stopped`, no published port, no `env_file`, and in `environment`:
  - `Claude__ApiKey: ${ANTHROPIC_API_KEY:?…}` from his secrets file. If the variable is missing, Compose stops **before** it touches any container, so his site stays up.
  - `TicketGenerator__Provider=Claude`, `Translation__Provider=Claude`.
  - `Jira__Enabled=true`, `Jira__Deployment=Server`, `Jira__ServerAuthScheme=Basic`, `Jira__BaseUrl=https://jd.eleks.com`, `Jira__AllowedHosts` `jd.eleks.com` and `*.atlassian.net` (the company host is the one in his `appsettings.json`).
  - `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true`, so the API trusts Caddy's `X-Forwarded-Proto` and sets the `Secure` flag on the Jira session cookie. This trusts the header from any sender; only Caddy can reach the API because no API port is published.
- `stt`: no published port, `WHISPER__CPU_THREADS=2`, `WHISPER__NUM_WORKERS=1`. A memory limit only after P2 measures the peak.
- `caddy`: as his (`caddy:2`, ports 80 and 443, the Caddyfile read-only, `caddy_data:/data`).

### 4.3 `deploy/Caddyfile`

Identical to his. Verified 2026-11-21 in the Caddy docs: `reverse_proxy` has no default response or read timeout (a long Ukrainian transcription is not cut off), and it sets `X-Forwarded-For` and `X-Forwarded-Proto` by default.

### 4.4 README

A "Shared deployment" section: the URL, trusting the certificate, how to deploy this branch and bring his app back, the first-start model download, the risks (D23) and where to see the status (the workflow's status step). The "Local demos only" note points to it.

## 5. Measurement (P2)

After the first deploy, without signing in to the VM:

| Measure | How | Decides |
|---|---|---|
| English and Ukrainian speed | One 1-minute recording each, warm; `durationMs` in the `/api/transcriptions` response (browser developer tools, Network tab) | `Stt:Languages:*:TimeoutSeconds` on the VM; H3 |
| Queue | Three 1-minute recordings sent at once from three browsers | P3's waiting-list size |
| RAM | The workflow's status step (`docker stats`), run again after the measurements | `stt` memory limit |
| Model download | The status step: `stt` health and log | Whether the VM can reach Hugging Face |

Laptop reference (L3): about 4 s per 10 s of English audio, 7 s on large-v3, about 4.5 GB RAM. The VM is expected to be several times slower; the numbers are recorded in P2's log, not guessed.

## 6. Tasks

| ID | Title | Files | Depends on |
|---|---|---|---|
| P0 | Deployment plan (revision 2) | this file, `docs/tasks/P*.md`, `docs/status.md`, implementation-plan section 3 | human request |
| P1 | Deployment files for the shared slot | `.github/workflows/deploy.yml`, `docker-compose.prod.yml`, `deploy/Caddyfile`, `README.md` | P0 |
| P2 | First deploy and measurements (human-led) | `docs/tasks/P2-*.md` log, `docker-compose.prod.yml` and `appsettings` timeouts only | P1, section 8 |
| P3 | Transcription busy limit (`stt_busy`) | `Features/Transcriptions/**`, `Infrastructure/ErrorCodes.cs`, web error messages (en, uk), tests | P0; size from P2 |

If P2 decides to switch the Ukrainian model, that becomes its own task.

## 7. Risks

- **Replacing the colleague's site.** A run from this branch takes his site down until `main` is deployed again. Mitigation: agree on times; bringing his back is one manual run from `main`.
- **His secrets file.** We only know it holds `ANTHROPIC_API_KEY` (his compose uses it). If it is missing, the deploy stops before touching containers. The key is his or the team's: agree that our app may spend it.
- **Open access (D23).** Anyone on the network can spend the Claude key, and their transcripts go to Claude. Mitigation: a spending limit in the Anthropic console; no transcript text in logs at Information level (already a rule).
- **Model download on an unverified network.** If the VM cannot reach Hugging Face, `stt` never becomes healthy; typing a report still works. The status step shows it.
- **CPU and RAM.** Only one app runs at a time, so our app has the whole VM. A deploy builds images on the same 8 GB while `stt` is running.
- **Speaches image is a release candidate** (`0.9.0-rc.3-cpu`), as in local runs.

## 8. Prerequisites (human)

- [x] Write access to the repository (confirmed 2026-11-21).
- [ ] The colleague agrees to share the slot, the runner and the Anthropic key in his secrets file.
- [ ] A spending limit on that key.
- [ ] This branch pushed to the repository.
