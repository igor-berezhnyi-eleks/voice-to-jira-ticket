---
name: finish-task
description: After the human has approved a task, close it out - update the task log and status, then commit the task's changes locally.
argument-hint: "[task ID]"
disable-model-invocation: true
---

# Finish an approved task

Task: $ARGUMENTS (if empty, the task marked `review` in `docs/status.md`).

Only run this after the human has said the task is approved in this conversation. If they have not, ask.

1. Run `node scripts/check.mjs`. If it fails, stop and report; do not commit a red build.
2. In the task file: set status `done`; make sure **Log → Verified / Not verified** is accurate; add **Log → Notes for the study**: 2–4 lines on how the agent work went (what needed human correction, what the reviewer caught, what the harness caught or missed).
3. In `docs/status.md`: set the task to `done`; move **Current** to the next task; add decisions made during the task to the **Decision log**; add one line to the **Session log**; update gates if one was passed (only when the human said so).
4. Show `git status`. Stage only files in the task's file list plus `docs/status.md` and the task file. If other files changed, list them and ask.
5. Commit with message `<ID>: <task title>` and a short body listing what was built and verified, ending with the attribution trailer from the session instructions. The commit command will ask the human for permission.
6. Tell the human the next task and whether a gate or prerequisite blocks it.
