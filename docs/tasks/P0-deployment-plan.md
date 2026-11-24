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
- 2026-11-21, revision 2, human request: "Can we change plan to reuse what my colleague has? It's ok if only one version of the site is available at a time. … Add deploy.yaml to this branch?" Port 8443 is closed and the human cannot sign in to the VM. D21 and D22 replaced (deploy into the colleague's slot). The revision is the human's own design; it is confirmed together with P1 at the hand-over.
- 2026-11-24, revision 3 draft, human request: "Would it be possible to have my colleague's app be on the root of the path, and mine be on other endpoint?" then "Draft version 3. P2 is done. And let's use /alt". H6, D25–D28 drafted; P4–P6 listed in plan section 6, task files after approval. Based on the colleague's `main` as fetched locally (`fc98cd6`): Caddyfile, compose, workflow unchanged since PR #18; their cookie is `jira_session`, their API has `MapFallbackToFile("index.html")`.
- 2026-11-24, human: "Approve, commit it". Revision 3 approved; D25–D28 added to implementation-plan section 3; task files P4–P6 created.
### Verified
- Speaches serves several models from one container; the request picks the model (Speaches README).
- faster-whisper `num_workers`: parallel calls need more workers "at the cost of increased memory usage" (faster-whisper source).
### Not verified
- Every ⚠ VERIFY item in the plan (Caddy shared storage and proxy timeout, Speaches variable names, `workflow_dispatch` on non-default branches, the colleague's volume name).
### Reviews
### Notes for the study
