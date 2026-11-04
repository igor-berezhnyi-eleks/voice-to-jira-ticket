---
name: review
description: Run the independent reviewer subagent on the current task's uncommitted changes and summarize its verdict and findings.
argument-hint: "[task ID]"
---

# Review the current task

Task: $ARGUMENTS (if empty, the task marked `in progress` or `review` in `docs/status.md`).

1. Launch the `reviewer` subagent (Agent tool, `subagent_type: "reviewer"`) with a prompt that names only the task ID, for example: `Review task T1.2.` Do not pass your own summary of the work: the reviewer must judge the repository, not your description of it.
2. When it returns, append to the task file under **Log → Reviews** one line: date, round number, verdict, number of findings by severity.
3. Show the human the verdict, the acceptance-criteria table and the findings. For each blocker or major finding, say whether you agree and what you will do. If you disagree with a finding, say why; do not silently ignore it.
