# P2 — First deploy and measurements (human-led)

- **Milestone:** M9
- **Status:** todo
- **Depends on:** P1 done and pushed; prerequisites in `docs/deployment-plan.md` section 8
- **Plan sections:** `docs/deployment-plan.md` 3, 5, 7, 8; H3
- **Parallel-safe with:** P3

## Goal

Our app runs at `https://10.17.89.14/` after a manual run of the Deploy workflow from this branch, the VM's real speed and memory use are recorded, and they set the VM timeouts, the memory limit and the Ukrainian model decision.

## Files

- `docker-compose.prod.yml` (timeouts and memory limit from the measurements only)
- `docs/tasks/P2-*.md`, `docs/status.md`

## Out of scope

- Changing the Ukrainian model (its own task if H3 says so).
- The colleague's files.

## Acceptance criteria

- [ ] The colleague has agreed on the time and on the use of his Anthropic key.
- [ ] The workflow run from this branch succeeds; the site opens without a certificate warning.
- [ ] The status step shows `stt` healthy (after the first model download, which may need a second run of the workflow to see).
- [ ] An English and a Ukrainian recording each give a ticket on the site.
- [ ] After connecting to Jira, the `vtt_jira` session cookie shows `Secure` in the browser's developer tools (checks `ASPNETCORE_FORWARDEDHEADERS_ENABLED` behind Caddy).
- [ ] After a transcription, the Status step's `stt` log contains no transcript text. If it does, lower Speaches' log level in `docker-compose.prod.yml` (the Actions log is readable by everyone with access to the repository).
- [ ] Recorded: `durationMs` per second of audio for English and Ukrainian (warm), the three-at-once times, the RAM from the status step.
- [ ] The VM timeouts and the `stt` memory limit are set from these numbers and redeployed.
- [ ] The human decides H3 (keep large-v3 or switch), recorded in the decision log.
- [ ] Deploying `main` again brings the colleague's site back (checked once).

## Verification

Manual (human): GitHub → Actions → Deploy → Run workflow → this branch; read the "Status" step. In the browser: developer tools → Network → `transcriptions` → Response → `durationMs`.

## Gate

"Deployed site works": the human confirms the site and the H3 decision.

## Notes

- The first start downloads about 4.3 GB of models; voice input works once `stt` is healthy. Typing a report works straight away.

## Log

### Plan
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
