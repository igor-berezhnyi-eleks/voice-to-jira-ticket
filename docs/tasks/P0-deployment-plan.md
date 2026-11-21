# P0 — Deployment plan

- **Milestone:** M9
- **Status:** done
- **Depends on:** human request 2026-11-20
- **Plan sections:** `docs/deployment-plan.md` (all)
- **Parallel-safe with:** none

## Goal

An approved plan for deploying the app on the shared team VM next to the colleague's app, with task files P1–P3.

## Files

- `docs/deployment-plan.md`, `docs/tasks/P*.md`, `docs/status.md`

## Out of scope

- Any code or deployment file.
- Changes to the colleague's workflow, compose override or Caddyfile.

## Acceptance criteria

- [x] The human's answers (H1–H4) are recorded in the plan.
- [x] Every task has a file list, acceptance criteria and verification.
- [x] The human approves D21–D24. On approval, D21–D24 are added to implementation-plan section 3.

## Verification

None (documents only).

## Gate

"Deployment plan approved" before P1 starts.

## Notes

- The colleague's deployment was read from `origin/main` and `origin/develop` (PR #18, last successful deploy 2026-11-19).

## Log

### Plan
Read the colleague's files, ask H1–H4, write the plan and the task files.
### Decisions
- 2026-11-21, human: "Approve, commit it". The human has write access to the repository (section 8 prerequisite done).
### Verified
- Speaches serves several models from one container; the request picks the model (Speaches README).
- faster-whisper `num_workers`: parallel calls need more workers "at the cost of increased memory usage" (faster-whisper source).
### Not verified
- Every ⚠ VERIFY item in the plan (Caddy shared storage and proxy timeout, Speaches variable names, `workflow_dispatch` on non-default branches, the colleague's volume name).
### Reviews
### Notes for the study
