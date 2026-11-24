# P6 — Side-by-side deploy and checks (human-led)

- **Milestone:** M9 (revision 3)
- **Status:** todo
- **Depends on:** P4 done and pushed; P5 merged
- **Plan sections:** `docs/deployment-plan.md` 3, 5, 6, 7
- **Parallel-safe with:** none

## Goal

Both apps run at once on the VM: the colleague's at `https://10.17.89.14/`, ours at `https://10.17.89.14/alt/`, and the checks in deployment-plan section 6 are recorded.

## Files

- `docs/tasks/P6-*.md`, `docs/status.md`
- `docker-compose.alt.yml` (only if a limit has to change after the measurements)

## Out of scope

- Changing the Ukrainian model (a new H3 decision, its own task).
- The colleague's files.

## Acceptance criteria

- [ ] The workflow run from this branch succeeds. The status step shows `alt-api` and `stt` up, and the colleague's containers still running.
- [ ] Both sites open without a certificate warning, and `/alt` redirects to `/alt/`.
- [ ] An English and a Ukrainian ticket on `/alt/`, and a ticket on `/`.
- [ ] After a Jira sign-in on `/alt/`, `vtt_jira` has `Path=/alt/api/jira` and `Secure`.
- [ ] A deploy from `main` leaves `/alt/` working (checked once).
- [ ] Recorded: `docker stats` with both apps up, and the colleague's ticket time while a Ukrainian transcription runs.
- [ ] The old `voice-to-jira_dp-keys` volume is noted as a leftover (it is not removed without the human's go-ahead).

## Verification

Manual (human): GitHub → Actions → Deploy → Run workflow → this branch; read the Status step. In the browser: developer tools → Application → Cookies, and Network.

## Gate

"Side-by-side sites work": the human confirms both sites.

## Notes

- The agent does not start the workflow and cannot reach the VM.

## Log

### Plan
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
