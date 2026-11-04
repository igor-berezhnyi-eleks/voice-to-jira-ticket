# Harness guide

The harness is everything around the model that makes its work predictable: what it reads, what it may do, what checks it automatically, and how a human stays in control. This page explains each piece of ours, why it exists, and how it was verified. It is written for the human running the study; the agent's instructions are in `CLAUDE.md`.

## The pieces

| Piece | File(s) | Kind | What it does |
|---|---|---|---|
| Project memory | `CLAUDE.md` | Instructions | Loaded into every session: where things are, how we work, conventions, commands, the "never" list. |
| Source of truth | `docs/implementation-plan.md` | Instructions | Decisions, architecture, contract, tasks, evaluation. Stable; changes only by agreement. |
| State | `docs/status.md` | Shared memory | Current task, gates, decision log, session log. Survives between sessions. |
| Task files | `docs/tasks/T*.md`, `_template.md` | Work units | One bounded task: goal, file list, out of scope, acceptance criteria, verification, log. |
| Permissions | `.claude/settings.json` → `permissions` | Enforcement | What runs without asking, what asks, what is refused. |
| Session context hook | `.claude/hooks/session-context.mjs` (SessionStart) | Enforcement | Puts the current task and open gates into context at session start. |
| Protected-files hook | `.claude/hooks/guard-protected-files.mjs` (PreToolUse) | Enforcement | Blocks edits to generated files, frozen scenarios, the reference plan, secrets. |
| Quality gate hook | `scripts/check.mjs --hook` (Stop) | Enforcement | Before the agent ends a turn, builds and tests what changed; a failure sends it back to fix. |
| Reviewer | `.claude/agents/reviewer.md` | Subagent | Fresh-context review of a task's diff against its acceptance criteria. Read-only. |
| `/next-task` | `.claude/skills/next-task/` | Skill (you invoke) | The per-task loop: orient → plan → implement → verify → review → hand over. |
| `/review` | `.claude/skills/review/` | Skill | Runs the reviewer and logs its verdict. |
| `/finish-task` | `.claude/skills/finish-task/` | Skill (you invoke) | After your approval: update logs, commit locally. |

**Instructions vs enforcement.** CLAUDE.md, the plan and skills are *requests*: the model usually follows them, but nothing forces it. Hooks and permissions are *enforced* by Claude Code regardless of what the model decides. Put a rule in a hook when breaking it would be expensive (red build handed over, frozen exam edited); keep it as an instruction when judgement is needed.

## A typical task session

1. Start a **new session** in this folder (fresh context per task keeps the agent focused). The SessionStart hook tells it the current task.
2. Type `/next-task` (or `/next-task T1.3`).
3. The agent plans, implements, verifies and runs `/review`. You will get permission prompts for `dotnet new`, `dotnet add package`, `npm install`, `docker compose up`.
4. It hands over with results. You review the diff (the app's diff pane), do the task's manual check, and either ask for changes or say it is approved.
5. Type `/finish-task`. It updates the logs and asks permission to commit.
6. At gates (contract, voice check, scenarios, prompt, demo, recommendation) you decide before the next task starts.

For a new milestone, `/next-task` first writes the task file from the plan and stops so you can review it. That is deliberate: task files are where scope creep is cheapest to stop.

## How each enforcement piece was verified (2026-11-04)

- **Protected-files guard:** piped 11 sample inputs (Windows and relative paths, upper case, outside the project, frozen and unfrozen scenarios): all blocked/allowed as expected. Then proved live: an Edit to `docs/progress.md` in this session was blocked by the hook and the file stayed unchanged.
- **Quality gate:** tested in a throwaway repository: blocks with the failing command's output (exit 2); on the second stop (`stop_hook_active`) tells the human instead of looping; skips when nothing changed since the last green run; re-runs after an edit; `--all` ignores the cache; reports missing `node_modules`. One bug found and fixed during testing: the gate's own cache file changed the fingerprint, so the cache never hit.
- **Session context:** piped test prints the Current section, open gates, branch and uncommitted count. It runs for real only at the next session start.
- **Not yet proved live:** the Stop gate on real .NET/web code (no projects exist yet; the first task will exercise it), the SessionStart hook and the skills/subagent in a new session. Watch for them in the first T1.1 session.

## Known limits (deliberate)

- The guard watches Claude's file tools only. A shell command (`echo > file`) can still write a protected file; CLAUDE.md forbids working around a block. A stricter version would add a `Bash` PreToolUse check.
- Read-deny rules for `.env` and user-secrets stop the Read tool, not `cat` in a shell.
- The Stop gate runs build + tests, not formatting. A `dotnet format --verify-no-changes` step or a PostToolUse formatter can be added once the code exists.
- The gate is skipped when the agent stops with no changes in `src/`, `tests/` or `web/` (for example, docs-only work).
- The reviewer is the same model family as the implementer; it catches omissions and scope drift well, but shares blind spots. Your review is still the real gate.

## Lessons already visible

- **A broken hook looks exactly like a passing one.** The earlier settings had a hook that read the file path from an unexpanded `'$INPUT'`, so it never did anything and nothing reported it. Every hook here was tested with sample input before being trusted.
- **Contradictory instructions cost more than missing ones.** The earlier CLAUDE.md required both `ActionResult<T>` and `TypedResults`, and EF Core without a database. The new one lists what is *not* used, with the decision number.
- **Make "done" checkable by the agent.** Fakes for STT and Claude, synthetic audio fixtures, and a Playwright smoke test exist so the agent can verify its own work without a GPU, a key or a human speaking.

## Possible additions later

- `/eval` skill to run the evaluation (M5) and `/draft-scenarios` skill for T5.1 that forbids reading the prompt.
- A `Bash` guard for protected paths; a formatter hook.
- Per-task worktrees for the parallel lanes (T2.1, T5.1).
