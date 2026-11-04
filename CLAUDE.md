# Voice-to-Ticket PoC

A browser tool that turns a spoken bug report or feature request into a structured ticket (Bug or Feature) that a developer reviews and copies into Jira. It is a proof of concept: the deliverable is a working demo **plus** an evaluation-based Go / Conditional Go / No-Go recommendation.

## Where things are

- `docs/implementation-plan.md` — **source of truth**: scope, decisions (D1–D15), architecture, contract, task list, evaluation design. Read the sections your task references; do not deviate from section 3 without asking.
- `docs/status.md` — current task, gates, decision log. Update it when a task changes state.
- `docs/tasks/` — one file per task (`T1.1-….md`), created from `docs/tasks/_template.md`.
- `docs/harness-guide.md` — how this harness works (hooks, skills, reviewer).
- `docs/development-plan.md` and `docs/progress.md` are an **earlier plan kept for reference only**. Do not follow or edit them.

## How we work

- One task per session. Start with `/next-task`; finish with `/finish-task` after the human approves.
- Per task: read the task file → short plan in its log → implement → run its verification commands → `/review` (reviewer subagent) → fix → hand over to the human. Commit only after approval.
- Stay inside the task's file list. If you need a file outside it, a new dependency, or a change to a decision, stop and ask.
- Never weaken or skip a test to make it pass. If a check cannot run (no Docker, no API key), say so in the task log as "not verified".
- Facts marked **⚠ VERIFY** in the plan (image tags, model ids, SDK shapes) must be checked against current docs, not recalled from memory. Record the verified value in the task log.
- Before writing code that calls Claude, load the `claude-api` skill.

## Commands

- Build: `dotnet build` · Test: `dotnet test` · One test class: `dotnet test --filter "FullyQualifiedName~ClassName"`
- Run API: `dotnet run --project src/VoiceToTicket.Api/VoiceToTicket.Api.csproj`
- Web (in `web/`): `npm run dev` · `npm run build` · `npm test` · `npm run lint` · `npm run gen:contract` · `npm run e2e`
- Docker: `docker compose up --build` (app on http://localhost:5080)
- All quality checks for what changed: `node scripts/check.mjs` (add `--all` to run everything)

Do not invent other build scripts.

## Layout

`src/VoiceToTicket.Api/Features/<Feature>/` (one API project, feature folders) · `tests/VoiceToTicket.Api.Tests/` · `tests/VoiceToTicket.Evaluation/` · `web/` (React + Vite + TS) · `contract/ticket.schema.json` (generated) · `eval/` (scenarios, results; `eval/audio/` is git-ignored).

## C# conventions

- File-scoped namespaces; primary constructors for DI; nullable and implicit usings on; no `#region`.
- `ILogger<T>` for logging; `IOptions<T>` with `ValidateOnStart` for configuration.
- Inject `TimeProvider`; never `DateTime.Now` / `DateTime.UtcNow`.
- `IHttpClientFactory`; never `new HttpClient()`.
- Every async method takes and passes a `CancellationToken`.
- Minimal API endpoints return `TypedResults`. Errors go through one `IExceptionHandler` that returns ProblemDetails with a `code` extension.
- Not used in this project (decision D2): MediatR, Mapster, Polly, FluentValidation, EF Core, repositories, Moq, FluentAssertions.
- Never log transcript text at Information level or above.

## TypeScript conventions

- `strict` on; no `any` in API types. `web/src/contract.ts` is generated — change the C# records and run `npm run gen:contract`.
- No router, state library or UI kit (decision D3).

## Tests

- Default `dotnet test` must pass offline: no Docker, network or API key.
- Tests that need the STT container, a real Claude call or the evaluation carry `[Trait("Category", "Stt" | "Live" | "Evaluation")]` **and** skip unless their env flag is set (`VTT_RUN_STT=1`, `VTT_RUN_LIVE=1`, `VTT_RUN_EVALUATION=1`). Evaluation runs cost money: never run them unless the task says so.
- Test real behaviour (contracts, error mapping, edge cases), not implementation details. Prefer hand-written fakes.

## Hooks you will notice

- **Stop gate:** when you finish a turn with uncommitted changes, `scripts/check.mjs` builds and tests the changed areas. If it fails, you are told why; fix it or report the failure honestly.
- **Protected files:** edits to generated files, frozen evaluation scenarios, the reference plan and secret files are blocked. Do not work around a block with shell commands; ask the human.
- **Session start:** the current task and open gates from `docs/status.md` are added to your context.

## Never

Commit secrets · edit `.env` or user-secrets · tune the prompt against scenarios that are not frozen · read `eval/scenarios/` while writing the prompt (T3.1) · mark a task done with failing or skipped checks without saying so · push or force-push.
