# P1 — VM deployment files and workflow

- **Milestone:** M9
- **Status:** todo
- **Depends on:** P0 approved
- **Plan sections:** `docs/deployment-plan.md` 2 (D21–D23), 3, 4
- **Parallel-safe with:** P3

## Goal

The repository contains everything needed to deploy our app on the VM as its own stack (`voice-to-ticket`, HTTPS on 8443) by pushing our deploy branch, without touching the colleague's stack.

## Files

- `docker-compose.vm.yml` (new)
- `deploy/vm/Caddyfile` (new)
- `.github/workflows/deploy-vm.yml` (new)
- `README.md` (new "Shared deployment" section; the "Local demos only" note updated)
- `docs/tasks/P1-*.md`, `docs/status.md`

## Out of scope

- `docker-compose.prod.yml`, `deploy/Caddyfile`, `.github/workflows/deploy.yml` (the colleague's), and any merge of them into our branch.
- Changes to `docker-compose.yml` that alter local runs.
- Application code (P3), timeouts and memory limits from measurements (P2).
- Pushing the branch or running the workflow (the human does that in P2).

## Acceptance criteria

- [ ] `docker compose -p voice-to-ticket -f docker-compose.yml -f docker-compose.vm.yml config` succeeds and shows: no published port on `api` and `stt`; Caddy on 8443 only; the external volume for Caddy's `/data`; `env_file` `/opt/voice-to-ticket/.env`; `WHISPER__CPU_THREADS=2` and `WHISPER__NUM_WORKERS=1` on `stt`.
- [ ] `docker compose -f docker-compose.yml config` (local) is unchanged.
- [ ] The workflow runs on `self-hosted`, on push to the deploy branch only, with its own concurrency group; it uses project `voice-to-ticket`; it recreates only Caddy; it checks `https://10.17.89.14:8443/api/health`; it prunes dangling images.
- [ ] No secret in any file; the `.env` path is outside the workspace.
- [ ] The README explains the URL, trusting the certificate, how a deploy starts, the first-start download, the risks (D23) and how to read logs.
- [ ] Every ⚠ VERIFY item in plan section 4 is checked against current docs and recorded below.

## Verification

```
docker compose -p voice-to-ticket -f docker-compose.yml -f docker-compose.vm.yml config
docker compose -f docker-compose.yml config
node scripts/check.mjs
```

Manual check for the human: read the workflow before the first push.

## Gate

None (P2 is the live check).

## Notes

- ⚠ VERIFY: Speaches variables `WHISPER__CPU_THREADS`, `WHISPER__NUM_WORKERS`; Caddy shared storage between instances; Caddy `reverse_proxy` default timeouts; whether `workflow_dispatch` needs the file on the default branch; GitHub Actions versions (`actions/checkout`) used by `ci.yml`.
- The colleague's volume name is expected to be `voice-to-jira_caddy_data` (project `voice-to-jira` + `caddy_data`); confirm on the VM in P2 before the first deploy.

## Log

### Plan
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
