# P5 — The colleague's Caddyfile route (colleague-led, on `main`)

- **Milestone:** M9 (revision 3)
- **Status:** todo
- **Depends on:** gate "Deployment plan revision 3 approved"; the colleague agrees (deployment-plan section 8)
- **Plan sections:** `docs/deployment-plan.md` 3, 4.4, 7
- **Parallel-safe with:** P4

## Goal

The colleague's Caddy on `main` serves their app at `/` and forwards `/alt/*` to `alt-api:8080`, and `/alt` redirects to `/alt/`.

## Files

- The colleague's `deploy/Caddyfile` on `main` (their PR, not on this branch)
- `docs/tasks/P5-*.md`, `docs/status.md` (this branch: the log only)

## Out of scope

- Any other file on `main`: their compose file and workflow stay as they are.
- Merging anything from this branch into `main`.

## Acceptance criteria

- [ ] The colleague agrees: the route, both apps on the VM at once, both using the Anthropic key.
- [ ] Their PR with the section 4.4 Caddyfile is merged to `main`, and their deploy succeeds.
- [ ] Their site at `/` still works. Before P4 is deployed, `/alt/` answers 502 (no upstream) and does not break their site.

## Verification

Manual (human and colleague): the PR's deploy run on `main` succeeds; open `https://10.17.89.14/` and `https://10.17.89.14/alt/`.

## Gate

None.

## Notes

- The agent may draft the Caddyfile text and the PR description for the human to pass on. The agent does not open a PR on `main` and does not push to it.
- ⚠ VERIFY: Caddy resolves `alt-api` when a request comes in, not at startup.

## Log

### Plan
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
