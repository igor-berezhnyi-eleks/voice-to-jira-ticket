---
name: next-task
description: Start the next task of the Voice-to-Ticket PoC (or the task ID given as argument) and carry it through implementation, verification and review, stopping before commit for human approval.
argument-hint: "[task ID, e.g. T1.3]"
disable-model-invocation: true
---

# Start and implement the next task

Task requested: $ARGUMENTS (if empty, use the next task in `docs/status.md`: the first one not `done`, respecting the order and gates in plan section 6).

## 1. Orient

1. Read `docs/status.md`. If a gate the task depends on is still `open`, stop and tell the human which gate blocks it.
2. Find `docs/tasks/<ID>-*.md`. **If it does not exist**, create it from `docs/tasks/_template.md` using the task's entry in `docs/implementation-plan.md` section 6, then show it to the human and stop: task files for new milestones are reviewed before work starts.
3. Read the task file, the plan sections it references and `CLAUDE.md`. Read existing code only where the task touches it.
4. Set the task to `in progress` in `docs/status.md` and in the task file.

## 2. Plan

Write a short plan (5–10 lines) into the task file's **Log → Plan**: the files you will create or change, the tests you will write first, and any ⚠ VERIFY facts you must check. If the plan needs a file outside the task's list, a new dependency, or a change to a plan decision, stop and ask.

## 3. Implement

- Write the tests for the acceptance criteria first where practical, then the code.
- Keep to the file list. Small, complete steps; build often.
- For ⚠ VERIFY facts, check current documentation and record the verified value and source in **Log → Decisions**.
- New dependency: record the one-line justification in **Log → Decisions**.

## 4. Verify

1. Run every command in the task's **Verification** section and record the results (pass/fail, counts) in **Log → Verified**.
2. Anything you could not run goes in **Log → Not verified** with the reason.
3. Run `node scripts/check.mjs` and fix failures.

## 5. Review

Run the `/review` skill for this task. Fix every blocker and major finding, re-run verification, and review again (at most 3 rounds; then hand over with the open findings listed).

## 6. Hand over

- Set the task to `review` in `docs/status.md` and the task file.
- Reply to the human with: what was built, the verification results, the reviewer verdict, anything not verified, any gate the human must now pass, and the manual check they should do (from the task file).
- Do **not** commit. The human approves, then runs `/finish-task`.
