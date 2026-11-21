# P1 — Deployment files for the shared slot

- **Milestone:** M9
- **Status:** done
- **Depends on:** P0 revision 2 (human request 2026-11-21: "Can we change plan to reuse what my colleague has? … Add deploy.yaml to this branch?")
- **Plan sections:** `docs/deployment-plan.md` 2 (D21–D24), 3, 4
- **Parallel-safe with:** P3

## Goal

Running Actions → Deploy → Run workflow from this branch deploys our app (API, web and speech-to-text) to `https://10.17.89.14/` in the colleague's slot, without any sign-in to the VM; a run from `main` brings his app back.

## Files

- `.github/workflows/deploy.yml` (new on this branch; our copy of his)
- `docker-compose.prod.yml` (new; our copy)
- `deploy/Caddyfile` (new; identical to his)
- `README.md` ("Shared deployment" section; the "Local demos only" note)
- `docs/tasks/P1-*.md`, `docs/status.md`

## Out of scope

- The colleague's files on `main` or `develop`, and merging `main` into this branch.
- `docker-compose.yml` (local runs stay as they are).
- Application code (P3); timeouts and memory limits from measurements (P2).
- Pushing the branch or running the workflow (the human does that).

## Acceptance criteria

- [ ] The workflow keeps his name (`Deploy`), path, triggers, concurrency group, runner, project name `voice-to-jira` and secrets file; it recreates only Caddy, checks `https://10.17.89.14/health`, always prints a status report (containers, memory, `stt` log tail, Hugging Face reachability), and prunes dangling images.
- [ ] `docker compose -p voice-to-jira -f docker-compose.yml -f docker-compose.prod.yml config` (with a dummy `ANTHROPIC_API_KEY`) shows: no published port on `api` and `stt`; Caddy on 80 and 443 with `caddy_data`; no `env_file` on `api`; the Claude, Translation, Jira and forwarded-headers settings from plan 4.2; `WHISPER__CPU_THREADS=2`, `WHISPER__NUM_WORKERS=1` on `stt`.
- [ ] Without `ANTHROPIC_API_KEY`, the same command fails with a message naming the variable (so a deploy stops before touching containers).
- [ ] `deploy/Caddyfile` is byte-identical to the colleague's on `origin/main`.
- [ ] `docker compose -f docker-compose.yml config` (local) is unchanged.
- [ ] No secret in any file.
- [ ] The README explains the URL, the certificate, deploying this branch and bringing his app back, the first-start download, the risks and the status step.

## Verification

```
docker compose -p voice-to-jira -f docker-compose.yml -f docker-compose.prod.yml config
docker compose -f docker-compose.yml config
node scripts/check.mjs
```

Manual check for the human: read the workflow; after the push, run it from this branch (P2).

## Gate

None (P2 is the live check).

## Notes

- Verified 2026-11-21 (docs): Caddy `reverse_proxy` has no default response or read timeout and sets `X-Forwarded-Proto`; ASP.NET Core enables the forwarded headers middleware when `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` (docs for 6.0–12.0) and then accepts the headers from any sender; `workflow_dispatch` needs the workflow on the default branch (his `deploy.yml` is there).
- Speaches variable names follow its documented pattern (`WHISPER__COMPUTE_TYPE`) for the documented fields `cpu_threads` and `num_workers`.

## Log

### Plan
Copy the colleague's three files from `origin/main`, then change only what our app needs: health route, no full recreate, status step, our settings, closed `stt` port. Validate with `docker compose config`.
### Decisions
- Health check on `/health`: our app has no `/api/health` (an unknown `/api` GET is 404), so his check would fail every deploy of ours.
- The key is required with `${ANTHROPIC_API_KEY:?…}`: a missing key fails interpolation before Compose changes containers, so the live site stays up.
- `actions/checkout@v4` as in his workflow (known to work on this runner), not `@v7` from `ci.yml`.
- Jira host `jd.eleks.com` from the colleague's `appsettings.json` on `main`.
### Verified
- 2026-11-21: `docker compose -p voice-to-jira -f docker-compose.yml -f docker-compose.prod.yml config` with a dummy key: `api` and `stt` have no ports, `api` has no `env_file`, all settings from plan 4.2 present, `WHISPER__CPU_THREADS=2`, `WHISPER__NUM_WORKERS=1`; volumes are `voice-to-jira_caddy_data`, `voice-to-jira_stt-models`, `voice-to-jira_dp-keys`.
- Without the key: exit 1, "required variable ANTHROPIC_API_KEY is missing a value: ANTHROPIC_API_KEY must be set in /opt/voice-to-jira/.env".
- `deploy/Caddyfile` has the same git blob hash as `origin/main:deploy/Caddyfile`.
- `docker-compose.yml` unchanged (`git diff --quiet HEAD`).
- `node scripts/check.mjs`: nothing to check (no dotnet or web changes).
### Not verified
- The workflow itself (runs only on the VM runner, after the push): P2.
- That `ASPNETCORE_FORWARDEDHEADERS_ENABLED` makes the cookie `Secure` behind Caddy (docs say it enables the middleware; checked live in P2).
- That the colleague's `/opt/voice-to-jira/.env` holds `ANTHROPIC_API_KEY` (inferred from his compose file).
- `WHISPER__CPU_THREADS` / `WHISPER__NUM_WORKERS` names are inferred from the documented pattern, not seen in Speaches' logs.
### Reviews
- 2026-11-21, reviewer: APPROVE, six minor findings. Fixed: the Status step uses plain `docker ps`/`docker logs` so it also works when Compose cannot load the files (missing key); README certificate steps credited to the colleague's instructions; the Secure-cookie claim softened until P2 checks it; README says a rerun redeploys; P0 log records revision 2. Moved to P2: check that the `stt` log in the Status step holds no transcript text. Noted: both apps tag their image `voice-to-jira-api`, so each switch rebuilds the other image (slower, not broken).
### Notes for the study
