# P2 — First deploy and measurements (human-led)

- **Milestone:** M9
- **Status:** todo
- **Depends on:** P1 done; prerequisites in `docs/deployment-plan.md` section 8
- **Plan sections:** `docs/deployment-plan.md` 5, 7, 8; H3
- **Parallel-safe with:** P3

## Goal

Our app runs at `https://10.17.89.14:8443/` next to the colleague's site, and the VM's real speed and memory use are recorded and used for the timeouts, the memory limit and the Ukrainian model decision.

## Files

- `docker-compose.vm.yml` (timeouts and memory limit from the measurements only)
- `docs/tasks/P2-*.md`, `docs/status.md`

## Out of scope

- Changing the Ukrainian model (its own task if H3 says so).
- Anything on the colleague's stack.

## Acceptance criteria

- [ ] Before the first deploy, on the VM: the colleague's Caddy volume name, port 8443 open, `ghcr.io` and `huggingface.co` reachable, `/opt/voice-to-ticket/.env` created by the human. Results in the log.
- [ ] The workflow run succeeds; the site opens on 8443 without a certificate warning on a machine that trusts the colleague's certificate.
- [ ] After `stt` is healthy, an English and a Ukrainian recording each give a ticket on the site.
- [ ] Recorded: seconds per second of audio for English and Ukrainian (warm), the three-at-once queue times, the RAM peak during transcription and during a deploy, and whether the colleague's site stays usable.
- [ ] The VM timeouts and the `stt` memory limit are set from these numbers and redeployed.
- [ ] The human decides H3 (keep large-v3 or switch), recorded in the decision log.

## Verification

Manual (human, on the VM and in the browser):

```
docker volume ls
docker compose -p voice-to-ticket ps
docker stats --no-stream
docker compose -p voice-to-ticket logs api --since 10m
```

## Gate

"Deployed site works": the human confirms the site and the H3 decision.

## Notes

- Transcription times come from the API log line "Transcribed … in {DurationMs} ms".
- The first start downloads about 4.3 GB of models; voice input works once `stt` is healthy.

## Log

### Plan
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
