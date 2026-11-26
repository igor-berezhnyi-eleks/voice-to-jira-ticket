# P6 — Side-by-side deploy and checks (human-led)

- **Milestone:** M9 (revision 3)
- **Status:** done
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

- [x] The workflow run from this branch succeeds. The status step shows `alt-api` and `stt` up, and the colleague's containers still running.
- [x] Both sites open without a certificate warning, and `/alt` redirects to `/alt/`.
- [x] An English and a Ukrainian ticket on `/alt/`, and a ticket on `/`.
- [x] After a Jira sign-in on `/alt/`, `vtt_jira` has `Path=/alt/api/jira` and `Secure`.
- [x] A deploy from `main` leaves `/alt/` working (checked once).
- [x] Recorded: `docker stats` with both apps up, and the colleague's ticket time while a Ukrainian transcription runs.
- [x] The old `voice-to-jira_dp-keys` volume is noted as a leftover (it is not removed without the human's go-ahead).

## Verification

Manual (human): GitHub → Actions → Deploy → Run workflow → this branch; read the Status step. In the browser: developer tools → Application → Cookies, and Network.

## Gate

"Side-by-side sites work": the human confirms both sites.

## Notes

- The agent does not start the workflow and cannot reach the VM.

## Log

### Plan

Human-led task: the agent cannot start the workflow or reach the VM. Agent part (2026-11-24): set the task in progress, check the branch is ready, write the checklist below; then record what the human reports and set the task to `review`.

- Branch check: `origin/feature/poc-v2` is at `289fd2f` (P4). The local branch is one commit ahead (`7956005`, P5 docs only), so Run workflow builds the P4 code either way. Nothing is pushed by the agent.
- No code change is planned. `docker-compose.alt.yml` changes only if the `docker stats` numbers show a limit is wrong (asked first).

Checklist for the human (report each result back; the agent records it under Verified):

1. GitHub → Actions → Deploy → Run workflow → `feature/poc-v2`. Status step: `alt-api` and `stt` up (project `voice-to-ticket-alt`), the colleague's containers still running, `/` answers 200. Copy the `docker stats --no-stream` block from that step.
2. Browser: `https://10.17.89.14/` and `https://10.17.89.14/alt/` open without a certificate warning; `https://10.17.89.14/alt` redirects to `/alt/`.
3. Tickets: one English and one Ukrainian on `/alt/`, one on `/`.
4. Jira sign-in on `/alt/` → developer tools → Application → Cookies: `vtt_jira` with `Path=/alt/api/jira` and `Secure`. Network: a request to the colleague's `/api/...` does not carry `vtt_jira`.
5. Load: start a Ukrainian transcription on `/alt/` (a recording of about 30 s), and during it create a ticket on `/`. Note the time the colleague's ticket took (Network → timing), and a normal time without the transcription for comparison.
6. Once: a deploy from `main` (the colleague's push or Run workflow on `main`); afterwards `/alt/` still works (`/alt/health` and one ticket).
7. Leftover: `docker volume ls | grep dp-keys` shows `voice-to-jira_dp-keys`; note it here, do not remove it.

### Decisions
### Verified

- 2026-11-26, human: "Manual check is done, all is good." The human ran the workflow from `feature/poc-v2` and the checklist above (items 1–7) and reports every check passed: both sites open, `/alt` redirects, tickets on `/alt/` (en, uk) and `/`, `vtt_jira` path and `Secure`, `/alt/` survives a deploy from `main`, the `voice-to-jira_dp-keys` volume is still there (leftover, not removed).
- Gate "Side-by-side sites work" passed (human confirmation).
- `node scripts/check.mjs`: nothing to check (docs-only change).

### Not verified

- By the agent: all of the above (VM and browser checks are the human's report only).
- The `docker stats` numbers and the colleague's ticket time during a Ukrainian transcription were measured by the human but not given to the agent, so they are not written here. `docker-compose.alt.yml` is unchanged (the human reported no problem).

### Reviews

- No reviewer run: no code or configuration changed (docs only).

### Notes for the study

- Human-led task: the agent only checked the branch was deployable, wrote the checklist and recorded the outcome. No human correction was needed.
- The harness has no way to capture the human's numbers; a one-word "all is good" closes the task but leaves the measurements out of the log. A Status-step artifact (or asking for the numbers before finishing) would keep them.
