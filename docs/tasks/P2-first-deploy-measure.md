# P2 — First deploy and measurements (human-led)

- **Milestone:** M9
- **Status:** done
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

This task is human-led; the agent does not start the workflow (it takes the colleague's site down) and cannot reach the VM.

1. Human checks the prerequisites (deployment-plan section 8): the colleague agrees on the time, the slot and the Anthropic key; a spending limit is set on that key. The branch is pushed (`origin/feature/poc-v2` contains HEAD, checked 2026-11-21).
2. Human runs GitHub → Actions → Deploy → Run workflow on `feature/poc-v2` and reads the Status step. A second run may be needed after the first model download (about 4.3 GB).
3. Human does the checks in the acceptance criteria (site without certificate warning, English and Ukrainian ticket, `Secure` on `vtt_jira`, no transcript text in the `stt` log) and the measurements of deployment-plan section 5 (`durationMs` per second of audio, three-at-once times, `docker stats` RAM). Numbers go to **Verified** below.
4. Agent, on the human's numbers: sets the `stt` memory limit and the VM timeouts in `docker-compose.prod.yml` (and lowers Speaches' log level only if the log shows transcript text); the human redeploys. Files: only those in the task's list. ⚠ VERIFY: none expected; any compose key I add is checked against current docs first.
5. Human decides H3 (keep large-v3 or switch) and deploys `main` once to bring the colleague's site back; agent records both in the decision log and sets the gate.

No tests to write: no code changes until step 4.

### Decisions

- VM timeouts: English 300 s, Ukrainian 600 s (set as environment on the `api` in `docker-compose.prod.yml`; `appsettings.json` keeps the laptop values 120 and 300). Basis: a 300 s recording alone takes about 78 s and 240 s, and requests queue; P3 will cap the queue.
- `stt` memory limit 6g: 20 % above the 4.99 GiB reading, 1.2 GiB left for the rest of the VM.
- H3 (human, 2026-11-23: "Keep large-v3"): the Ukrainian model stays `Systran/faster-whisper-large-v3`. The human values Ukrainian quality over speed; the cost is about 0.80 s per s of audio.
### Verified

Human-run, 2026-11-23, on the VM (7.25 GiB RAM as seen by Docker):

| Measure | English (medium.en) | Ukrainian (large-v3) |
|---|---|---|
| One recording of about 60 s, warm | 15.6 s (about 0.26 s per s) | 48.2 s (about 0.80 s per s) |
| Three 60 s recordings at once (`durationMs` each) | 52.2, 55.0, 57.2 s | 99.6, 114.8, 129.5 s |

- Three at once: the work is serialized, about 18 s each for English and 43 s each for Ukrainian; the last of three waits about 2 to 2.5 minutes. The previous timeouts (120 s English, 300 s Ukrainian) were too short for a 300 s recording in a queue.
- `docker stats` after three Ukrainian transcriptions: `stt` 4.985 GiB (limit shown 7.25 GiB), api 60.8 MiB, caddy 39.7 MiB. This is one reading after the run, not a measured peak.
- Hugging Face check printed 307 (a redirect, so reachable); site works; no transcript text in the `stt` log (human).

### Not verified
- The compose key `mem_limit` was not checked against current docs by the agent; `docker compose config` accepts it and the human's redeploy worked.
- Peak RAM during a real transcription was not measured (one `docker stats` reading after the run).
- Human-reported, not seen by the agent: redeploy with the new timeouts and limit, `Secure` on `vtt_jira`, English and Ukrainian tickets, `main` brings the colleague's site back ("Other checks done, all is good"). No figures were given for these.
- `node scripts/check.mjs`: nothing to check (docs and compose only). No `/review` run: no code changed.
### Reviews
### Notes for the study

- Human-led task: the agent wrote the plan, explained where to find the logs and how to measure, then turned the numbers into compose settings. It did not touch the VM or the workflow.
- The old laptop timeouts (120 s English) would have failed a queued 5-minute recording; only the VM measurements showed it.
- The Stop hook had nothing to run (no dotnet or web change), so the check was the agent's own `docker compose config`.
