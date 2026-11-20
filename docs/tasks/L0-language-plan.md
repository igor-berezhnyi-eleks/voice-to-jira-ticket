# L0 — Languages and translation plan

- **Milestone:** M8
- **Status:** done
- **Depends on:** human request 2026-11-20
- **Plan sections:** `docs/language-plan.md` (all); implementation-plan section 3 (D13 replaced by D18–D20)
- **Parallel-safe with:** none

## Goal

An approved plan for the language selector (UI, STT and ticket language) and English↔X translation, with task files L1–L9.

## Files

- `docs/language-plan.md`, `docs/tasks/L*.md`, `docs/implementation-plan.md` (section 3: D13 note, D18–D20 rows), `docs/status.md`

## Out of scope

- Any code.

## Acceptance criteria

- [x] The human's answers (H1–H9) are recorded in the plan.
- [x] Every task has a file list, acceptance criteria and verification.
- [x] D13 is marked as replaced; D18–D20 are in section 3.

## Verification

None (documents only).

## Gate

**Language plan approved** (human). Points to confirm especially: H9 (one prompt), D19 (model detects the language, `language` field in the contract, marker stays `"Not provided"`), the pair-rule guard in D20, and the prompt change affecting English output (plan 10).

## Log

### Plan
Read implementation-plan 3, 4.4–4.8, the STT client, the prompt, the web shell and the scenario guard; asked six questions; wrote the plan from the answers.
### Decisions
- 2026-11-20 (human): H1–H8 as in plan section 1. Plan approved the same day ("Approved, commit it"), including H9.
- Ukrainian scenarios go to `eval/scenarios-uk/` because `eval/scenarios/` is guarded after `eval-scenarios-v1`.
### Verified
### Not verified
- No ⚠ VERIFY facts checked yet; they belong to L1, L3 and L6.
### Reviews
### Notes for the study
