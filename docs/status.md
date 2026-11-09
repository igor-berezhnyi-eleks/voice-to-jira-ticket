# Status

Plan: [implementation-plan.md](implementation-plan.md) · Tasks: [tasks/](tasks/) · Branch: `feature/poc-v2` (local)

## Current

- Current task: **T2.2 Transcription endpoint** — not started
- Waiting on human: nothing
- Prerequisites missing: Anthropic API key (needed from T3.2); data-policy approval (needed before T3.2)

## Gates

| Gate | After task | Status |
|---|---|---|
| Contract approved | T1.2 | done (2026-11-05) |
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
| T1.2 | Ticket contract | done |
| T1.3 | Generate endpoint with the fake | done |
| T1.4 | Web scaffold and both pages | done |
| T1.5 | Docker | done |
| T2.1 | STT container | done |
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

- 2026-11-06 (T2.1): ⚠ VERIFY STT: image `ghcr.io/speaches-ai/speaches:0.9.0-rc.3-cpu` (and `-cuda` in `docker-compose.gpu.yml`), the newest published tags and a release candidate (no stable 0.9). Models download at startup via `PRELOAD_MODELS='["Systran/faster-whisper-medium.en"]'` into the named volume `stt-models` (mounted at `/home/ubuntu/.cache/huggingface/hub`). `STT_MODEL_TTL=-1` keeps the model loaded; CPU uses `WHISPER__COMPUTE_TYPE=int8`. Cold start 151 s, warm 12 s, about 3.5 s per 10 s of audio on CPU. T2.2 should send `model`, `language` and treat the response as `{"text": ...}`; the model returns lowercase text without punctuation at times.
- 2026-11-06 (T2.1): In Windows PowerShell, use `curl.exe`, not `curl` (alias for `Invoke-WebRequest`). Docs and commands given to the human must say so.
- 2026-11-05 (T1.5): SPA serving is a check in `Program.cs` after `UseRouting`, not `MapFallbackToFile`. A fallback endpoint changes API answers (`POST /api/unknown` 405, `GET /api/tickets` 404). Later endpoints need no change: anything under `/api` keeps normal routing. A client path with a file extension returns 404, as a missing asset.
- 2026-11-05 (T1.5): ⚠ VERIFY image tags: `dotnet/sdk:10.0.403`, `dotnet/aspnet:10.0.14`, `node:24.21.0-alpine`. CI actions: `checkout@v7`, `setup-dotnet@v6`, `setup-node@v7`.
- 2026-11-05 (T1.5): `.env` is optional in compose, so the Docker quick start works with the fake and no file. The container runs in Production as a non-root user, so `/swagger` there returns the SPA.
- 2026-11-05 (after T1.4, human decision): `.gitattributes` sets `* text=auto eol=lf`, so every checkout has LF whatever the machine's `core.autocrlf`, and binary files are left alone. Byte or hash comparisons of generated files such as `web/src/contract.ts` are safe, and T1.5 shell scripts get LF in the Docker build context.
- 2026-11-05 (T1.4, human decision): The fake banner stays as built: it shows only after the first response, so a first visit to Page 1 has none. This differs from D9 and plan 4.8, which place it on Page 1; the client cannot know the provider earlier without an API change. It still appears before anyone can see a fake ticket.
- 2026-11-05 (T1.4, human decision): `web/.npmrc` sets `registry=https://registry.npmjs.org/` because the global `~/.npmrc` points at a client feed that returns E401. Later tasks and the T1.5 Docker build rely on this.
- 2026-11-05 (T1.4): Client-side error codes beside the API's: `network_error` (no response) and `unexpected_response` (not in the API's format, including a 200 with no ticket). With the API stopped, the Vite proxy answers a plain-text 502, which is `unexpected_response`.
- 2026-11-05 (T1.4): Generate's 20-character minimum counts raw characters, as the API does; 20 spaces enable the button and the API's 400 is shown.
- 2026-11-05 (T1.4): `GenerateTicketResponse` is hand-written in `web/src/api.ts` from plan 4.4, because the contract snapshot covers only the ticket. `api.ts` exports the generated `TicketSchema` as `Ticket`.
- 2026-11-05 (T1.3): ⚠ VERIFY `AddValidation()`, from the ASP.NET Core 10 docs and integration tests: works on records with attributes on positional parameters, needs no csproj property, and errors go through `IProblemDetailsService`, so `code: "validation"` is added by the existing customization. Error keys use the C# member name (`errors.Transcript`, not `transcript`); left as is and pinned by a test. T1.4 should not depend on the key matching the JSON field.
- 2026-11-05 (T1.3): Whitespace-only transcripts are rejected by `[Required]`, beyond the literal length rule. Padding still counts toward the 20-character minimum.
- 2026-11-05 (T1.3): `TicketGenerator:Provider` is a string with a custom startup error and no default (D9): absent, empty or unknown fails startup. `appsettings.json` sets `Fake`.
- 2026-11-05 (T1.3): Plan 4.6 vs rule 2: the fake's description is the trimmed transcript, not `"Not provided"`. Fixed fallback texts cover transcripts with no usable title or description.
- 2026-11-05 (T1.3): `TicketType` is sent as a string in HTTP JSON through `ConfigureHttpJsonOptions` (`JsonStringEnumConverter<TicketType>`).
- 2026-11-05 (T1.2, human decision): Required fields are type, title, description for a Bug, plus acceptance criteria for a Feature. "Required" means always on the ticket: a Feature with no described criteria keeps `[]` plus a question (no invention, plan 4.3), and other detail fields stay `"Not provided"` or `[]` with a question. Rule 3 extended beyond plan 4.3: a blank `bug.*` or `feature.*` string is an error, because a gap is exactly `"Not provided"`.
- 2026-11-05 (T1.2, human decision): Rule 5 extended beyond plan 4.3: `"Not provided"` (exact match) as a list item or question text is an error, because a list with no support is `[]`.
- 2026-11-05 (T1.2, human decision): `missingInformation.field` accepts `title`, `description` and the detail fields of the ticket's type (`TicketFields`). `type` is not accepted; a question about the type uses `field: null`.
- 2026-11-05 (T1.2): ⚠ VERIFY structured outputs, from the docs (not yet by a real API call): nullable objects are accepted as type arrays (`["object", "null"]`), so the plan 4.3 fallback shape is not used. `maxLength` is not supported, so the 120-character title limit is enforced only by `TicketValidator`. The contract uses 3 union-typed and 0 optional parameters (limits: 16 and 24).
- 2026-11-05 (T1.1): Tests use xUnit v3 (xunit.v3 4.0.2) on VSTest (`IsTestingPlatformApplication=false`) so `dotnet test --filter "Category!=…"` keeps working on the .NET 10 SDK.
- 2026-11-05 (T1.1): Swagger UI via `Swashbuckle.AspNetCore.SwaggerUI` (UI only) over `Microsoft.AspNetCore.OpenApi`'s `/openapi/v1.json`.
- 2026-11-05 (T1.1): Error codes via `ApiException(status, code, title, detail?)` mapped by `ProblemDetailsExceptionHandler`. Amended the same day (human approved): every ProblemDetails gets a default `code` from its status, and `BadHttpRequestException` keeps its status instead of becoming 500. Codes added beyond plan 4.4 (later tasks and the web client should treat these as part of the code vocabulary): `not_found` (404), `method_not_allowed` (405), `payload_too_large` (413), `unsupported_media_type` (415), `http_error` (other 4xx); 400 → `validation`, other 5xx → `internal_error`. Source: `Infrastructure/ErrorCodes.cs`. Plan 4.4 not edited (protected file).
- 2026-11-04: Harness created (CLAUDE.md, hooks, skills, reviewer agent, M1 task files).

## Session log

One line per session: date, task, outcome, anything notable about how the agent worked.

- 2026-11-04: Planning and harness (not an implementation session).
- 2026-11-05: T1.1 done. Reviewer APPROVE in round 1 (1 minor). The agent fixed the xunit.v3/MTP incompatibility itself; no human correction needed. Amended after a human question: default error codes for all ProblemDetails, BadHttpRequestException no longer becomes 500 (review round 2 APPROVE).
- 2026-11-05: T1.2 done, contract gate passed. Reviewer APPROVE in rounds 1 and 2 (2 and 3 minor); it found a validator crash on null list items by probing inputs. The human set the required fields; the agent checked them against plan 4.3 and FEATURE-03 and asked before changing anything. Two validator rules extended by human decision. The last rule 5 change had no review round. Schema not yet tried against the real API.
- 2026-11-05: T1.3 done. Reviewer APPROVE in round 1 (no findings). Tests caught a wrong assumption about the validation error key; pinned and logged. The human asked for exact steps for the Swagger check, ran it and confirmed all three responses were correct.
- 2026-11-05: T1.4 done. Reviewer APPROVE in round 1 (3 minor: 2 fixed with no second round, 1 decided by the human). Its `npm ci` deleted most of `web/node_modules` because the agent's Vite server had outlived being stopped; repaired, no tracked files affected. The human chose the public npm registry and kept the banner as built. The human ran the manual check: everything as expected.
- 2026-11-06: T1.5 done (same session as T1.4, against the one-task-per-session rule, because the human invoked it there). Reviewer CHANGES REQUESTED in round 1 (1 major: unknown routes returned 405 for non-GET methods, missed by GET-only tests), APPROVE in round 2. The fix replaced the fallback endpoint and removed a quirk the agent had planned to ask the human to accept. The human ran the manual check: everything ok. CI not run until the branch is pushed.
- 2026-11-09: T2.1 done. Reviewer APPROVE in round 1 (1 minor); it could not run Docker, so the cold start and transcripts rest on the agent's logs and the human's check. The human's manual check found the README `curl` command failing in PowerShell (alias); fixed to `curl.exe`. The model's cold download needed no manual step.
