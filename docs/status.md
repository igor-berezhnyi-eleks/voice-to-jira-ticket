# Status

Plan: [implementation-plan.md](implementation-plan.md) · Tasks: [tasks/](tasks/) · Branch: `feature/poc-v2` (local)

## Current

- Current task: **T1.2 Ticket contract** — not started
- Waiting on human: nothing
- Prerequisites missing: Docker Desktop not running (needed from T1.5); Anthropic API key (needed from T3.2); data-policy approval (needed before T3.2)

## Gates

| Gate | After task | Status |
|---|---|---|
| Contract approved | T1.2 | open |
| Voice transcripts usable | T2.4 | open |
| Scenarios frozen (`eval-scenarios-v1` tag) | T5.1 | done (2026-11-05) |
| Prompt approved | T3.1 | open |
| Full demo flow works | T4.4 | open |
| Recommendation signed off | T5.4 | open |

## Tasks

Status values: `todo`, `in progress`, `review` (waiting for human), `done`, `blocked`.
Task files for later milestones are created from the template when the milestone starts.

| ID | Title | Status |
|---|---|---|
| T1.1 | Solution scaffold | done |
| T1.2 | Ticket contract | todo |
| T1.3 | Generate endpoint with the fake | todo |
| T1.4 | Web scaffold and both pages | todo |
| T1.5 | Docker | todo |
| T2.1 | STT container | todo |
| T2.2 | Transcription endpoint | todo |
| T2.3 | Browser recorder | todo |
| T2.4 | Manual voice check (human) | todo |
| T3.1 | Prompt | todo |
| T3.2 | Claude generator | todo |
| T3.3 | Generation error UX | todo |
| T4.1 | Editable fields | todo |
| T4.2 | Preview, copy, JSON | todo |
| T4.3 | Regenerate and back | todo |
| T4.4 | Playwright smoke test | todo |
| T5.1 | Scenarios (separate session) | done |
| T5.2 | Evaluation runner | todo |
| T5.3 | Audio path | todo |
| T5.4 | Scoring and report | todo |
| T6.1 | Demo hardening | todo |

## Decision log

Decisions made during implementation (verified ⚠ VERIFY facts, deviations approved by the human). Newest first.

- 2026-11-05 (T1.1): Tests use xUnit v3 (xunit.v3 4.0.2) on VSTest (`IsTestingPlatformApplication=false`) so `dotnet test --filter "Category!=…"` keeps working on the .NET 10 SDK.
- 2026-11-05 (T1.1): Swagger UI via `Swashbuckle.AspNetCore.SwaggerUI` (UI only) over `Microsoft.AspNetCore.OpenApi`'s `/openapi/v1.json`.
- 2026-11-05 (T1.1): Error codes via `ApiException(status, code, title, detail?)` mapped by `ProblemDetailsExceptionHandler`. Open question for the human: whether framework 404/405 ProblemDetails need a `code` (plan 4.4 "all errors").
- 2026-11-04: Harness created (CLAUDE.md, hooks, skills, reviewer agent, M1 task files).

## Session log

One line per session: date, task, outcome, anything notable about how the agent worked.

- 2026-11-04: Planning and harness (not an implementation session).
- 2026-11-05: T1.1 done. Reviewer APPROVE in round 1 (1 minor). The agent fixed the xunit.v3/MTP incompatibility itself; no human correction needed.
