# Status

Plan: [implementation-plan.md](implementation-plan.md) · Tasks: [tasks/](tasks/) · Branch: `feature/poc-v2` (local)

## Current

- Current task: **T5.3 Audio path** (task file not yet created; none blocked)
- Waiting on human: nothing (proposed: a small task to allow one retry on `llm_invalid_output`, changing D15)
- Prerequisites missing: none

## Gates

| Gate | After task | Status |
|---|---|---|
| Contract approved | T1.2 | done (2026-11-05) |
| Voice transcripts usable | T2.4 | done (2026-11-10) |
| Scenarios frozen (`eval-scenarios-v1` tag) | T5.1 | done (2026-11-05) |
| Prompt approved | T3.1 | done (2026-11-10) |
| Full demo flow works | T4.4 | done (2026-11-10) |
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
| T2.2 | Transcription endpoint | done |
| T2.3 | Browser recorder | done |
| T2.4 | Manual voice check (human) | done |
| T3.1 | Prompt | done |
| T3.2 | Claude generator | done |
| T3.3 | Generation error UX | done |
| T4.1 | Editable fields | done |
| T4.2 | Preview, copy, JSON | done |
| T4.3 | Regenerate and back | done |
| T4.4 | Playwright smoke test | done |
| T5.1 | Scenarios (separate session) | done |
| T5.2 | Evaluation runner | done |
| T5.3 | Audio path | todo |
| T5.4 | Scoring and report | todo |
| T6.1 | Demo hardening | todo |

## Decision log

Decisions made during implementation (verified ⚠ VERIFY facts, deviations approved by the human). Newest first.

- 2026-11-11 (T5.2): first evaluation run done (`eval/results/20261111-1244/`, both models). From here the prompt tuning rule applies: any prompt change is logged and followed by a full re-run; tuning rounds so far: 0.
- 2026-11-11 (T5.2): `tests/VoiceToTicket.Evaluation` runs every scenario per model, one call at a time, no retries; 1 + 3 repeats for AMBIGUOUS-01, NOISY-01, MIXED-01 (19 calls per model). Opt-in: skipped unless `VTT_RUN_EVALUATION=1`; settings `VTT_EVAL_MODELS` and `VTT_EVAL_SCENARIOS`; key from the API user-secrets or `Claude__ApiKey`. Results are committed under `eval/results/<yyyyMMdd-HHmm>/` with scenario hash, prompt hash and commit. Trap search covers all ticket text, and a hit only inside a question is flagged `onlyInQuestions`. `20261111-1237` is a one-call pipeline check, kept for reference. First run: Sonnet 19/19 valid; Haiku 18/19 (BUG-04 `llm_invalid_output`). Open proposal: one retry on `llm_invalid_output` with first-attempt validity recorded (changes D15).
- 2026-11-10 (T4.4, human decision: all five proposals): `@playwright/test` 1.65.0 (devDependency, Chromium only; ⚠ VERIFY done by running). `npm run e2e` in `web/` starts the API (Fake forced, port 5080) and `npm run dev` (5173) through Playwright's `webServer`, reusing running servers outside CI. Two tests in `web/e2e/smoke.spec.ts`: a Bug flow through Back and a short Feature check. `check.mjs` does not run e2e. Chromium on Windows reads clipboard text with CRLF; the spec normalises it. "Full demo flow works" gate passed: the human ran the voice demo for a Bug and a Feature.
- 2026-11-10 (T4.3, human decision): Regenerate lives in `TicketPage` (it calls `generateTicket` with the page's transcript, shows progress and errors in place, and keeps the edits on failure; `App` passes `transcript` and `onRegenerated`). "Edited" means the read-out through `editedTicket` differs from the seeded one (`editState.ts`, `hasEdits`), so whitespace, blank rows and text typed back are not edits. Regenerate asks with an inline panel ("Regenerating replaces your edits with a new ticket. Continue?", Replace / Cancel) when there are edits; Back asks too ("Going back discards your edits to this ticket. Continue?", Discard / Cancel), which goes beyond the plan, where only Regenerate asks. Retry uses the Regenerate path, so it asks again if there are edits. Error messages and the Retry rule are Page 1's (`describeGenerationError`). A running request is aborted when the page unmounts. Edits typed while a request runs are replaced on success (not blocked).
- 2026-11-10 (T4.2, human decision): Copy and the preview contain only the ticket's field text, with no missing-information section in either format (the panel on Page 2 still lists the questions); this overrides the plan's T4.2 wording. A blank field or empty list prints `Not provided`; Jira wiki output is not escaped; line breaks are kept. The preview is a read-only textarea (what Copy writes) and, in Jira wiki mode, `JiraWikiView` shows an approximate rendering (wiki `h1`/`h2` as `h3`/`h4`, React elements only). `editedTicket.ts` is the read-out T4.1 asked for (trim, blank text becomes `Not provided`, blank rows dropped, no row ids) and also holds `ticketSections`. Save as JSON uses `ticket-<type>-<yyyyMMdd-HHmmss>.json` in local time. No clipboard fallback: a failure shows a message.
- 2026-11-10 (T4.1, human decision): Page 2 edits live in `TicketPage` state (seeded per response; T4.3 may lift it). A field counts as not provided when its trimmed text is blank or exactly `Not provided`, or a list has no non-blank item; the UI shows "Needs content" plus a tint. Blank list rows are kept while editing and T4.2 must drop them (and strip the client-side row ids) when reading the ticket out. Missing-information questions stay visible after their field is filled; a question is a focus button only when its field belongs to the ticket's type. The title gets a hint past 120 characters, no limit. `App.test.tsx` was updated for the editable title (outside the file list).
- 2026-11-10 (T3.3, human decision): Page 1 maps errors in `web/src/errorMessages.ts`. No Retry button after `llm_refused` (edit the transcript instead) or `validation`; Retry for the other `llm_*` codes, `network_error` and `unexpected_response`. Messages never show codes, statuses or server text, except `validation`, which keeps the server's length message. `llm_unavailable` also covers a rejected key, so its message claims no cause. Generate stays visible beside Retry.
- 2026-11-10 (T3.2): `Provider=Claude` is valid; `Claude:*` settings (`ApiKey`, `Model` `claude-sonnet-5-5`, `Effort` `medium`, `MaxTokens` 16000, `TimeoutSeconds` 60) are validated at start only when Claude is chosen. One real call confirmed the exported schema, adaptive thinking, `effort` and the beta refusal fallback (`server-side-fallback-2026-07-01`, `fallbacks: default`, sent for Sonnet 5.5 and Opus 5.5 only) are accepted; this closes the T1.2 "not yet tried against the real API" caveat. New error codes: `llm_refused` 422, `llm_invalid_output` 502, `llm_truncated` 502, `llm_unavailable` 503 (SDK/HTTP failures, bad key), `llm_timeout` 504. No retry on an invalid ticket (D15). `GenerationResult.Model` is the configured model, not the API echo. `ApiFactory` forces `Provider=Fake`, so user-secrets cannot change test results. Docker needs no compose change (`env_file: .env`, variables `TicketGenerator__Provider` and `Claude__ApiKey`). Unusable transcripts get no special handling (human decision A); the evaluation decides.
- 2026-11-10 (T3.1, human decision): "Prompt approved" gate passed. `TicketPrompt.System` (ten numbered rule sections matching plan 4.7, plus a `## Fields` list) is a constant in `Features/Tickets/Claude/TicketPrompt.cs`; `TicketPrompt.UserMessage(transcript)` wraps the transcript in `<transcript>` tags and rewrites a closing tag inside it to `<\/transcript>`. Human choices: no worked example in the prompt, rule 6 (expected result only if said) stays strict for the first evaluation run, "description in one to three sentences" kept. From now on any prompt change after the first evaluation run is logged and followed by a full re-run (plan section 8). T3.2 sends `System` as the system prompt and `UserMessage` as the user message.
- 2026-11-10 (T2.4, human decision): "Voice transcripts usable" gate passed. The human dictated one bug and one feature (recordings kept locally, not committed) and found no problems. No STT model change needed. No latency or silence-hallucination figures were reported, so none are recorded here.
- 2026-11-10 (T2.3): On silence the real STT returns `"."` (not `""`). The recorder treats a transcript with no letter or digit as silence ("No speech was detected", nothing appended). The API still passes `text` through. Word-like silence hallucinations ("you", "Thank you.") are not filtered; note their frequency in T2.4.
- 2026-11-10 (T2.3): Recording uses `audio/webm;codecs=opus`, then `audio/webm`, `audio/ogg;codecs=opus`, `audio/ogg`, chosen with `isTypeSupported` at run time; `audio/mp4` is never used, so Safari shows "not supported". The upload carries the recorder's mime type. ⚠ VERIFY: MDN confirms codec strings are valid for `isTypeSupported` but gave no per-browser table; Chrome/Edge producing webm/opus was confirmed in practice by the human's check (a `.webm` was transcribed). Max recording 300 s, counted in one-second ticks; a failed upload keeps the blob (Try again, Download), a recorder error keeps none.
- 2026-11-10 (T2.3): With the API stopped the Vite proxy's plain-text 502 shows as "The server returned an unexpected response (HTTP 502)". Not changed; a clearer message for it is an optional later improvement. In development, three processes must run: `stt`, the API (port 5080) and `npm run dev` in `web/`.
- 2026-11-10 (T2.3): The "onnxruntime ... CUDAExecutionProvider" errors in the CPU `stt` container log are harmless: ONNX Runtime falls back to CPU and requests return 200.

- 2026-11-09 (T2.2): `POST /api/transcriptions` (field `audio`, 25 MB, webm/ogg/wav/mpeg, case-insensitive, parameters ignored) returns `{ text, durationMs }`. Errors for T2.3: 400 `validation` (missing, empty or unsupported type, broken multipart), 413 `payload_too_large`, 415 `unsupported_media_type` (not a form), 503 `stt_unavailable`, 504 `stt_timeout`. Silence returns 200 with `text: ""`, so the recorder must show a message for an empty transcript. The client trims the text. `DurationMs` is the API's own timing, not the audio length.
- 2026-11-09 (T2.2): Config `Stt` (`BaseUrl` `http://stt:8000`, Development `http://localhost:8000`; `Model`; `Language`; `TimeoutSeconds` 120). Compose: `api` `depends_on: stt` with `service_started` (not healthy, as the cold model download takes minutes). `Stt__BaseUrl` is not set in compose; the default is enough. Kestrel's default body limit (about 28.6 MB) rejects larger bodies through the existing 413 mapping.
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
- 2026-11-05 (T1.1): Error codes via `ApiException(status, code, title, detail?)` mapped by `ProblemDetailsExceptionHandler`. Amended the same day (human approved): every ProblemDetails gets a default `code` from its status, and `BadHttpRequestException` keeps its status instead of becoming 500. Codes added beyond plan 4.4 (later tasks and the web client should treat these as part of the code vocabulary): `not_found` (404), `method_not_allowed` (405), `payload_too_large` (413), `unsupported_media_type` (415), `http_error` (other 4xx); 400 → `validation`, other 5xx → `internal_error`. Source: `Infrastructure/ErrorCodes.cs`. Plan 4.4 was not edited at the time (the plan is not hook-protected, only `docs/development-plan.md` and `docs/progress.md` are; it is the source of truth and changes by agreement).
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
- 2026-11-10: T2.3 done. Task file created and approved first, then built in one pass. Reviewer APPROVE in round 1 (1 minor, fixed). The human's real-microphone check found the `"."`-on-silence behaviour that the fakes could not show; fixed with a small filter after the review (not re-reviewed). Two manual-check hiccups were instructions (`npm run dev` outside `web/`, API not running), not code.
- 2026-11-10: T3.1 done. Task file approved with three answers first; reviewer APPROVE in round 1 (2 minor, both handled). The build was blocked once by the human's still-running dev API (stop hook failed for the same reason); the agent asked instead of killing the process. The human approved the prompt text as printed and passed the "Prompt approved" gate. Prompt quality is untested until T3.2 and T5.
- 2026-11-10: T3.2 done. Task file approved with answers to four questions; key and data-policy approval available. The Stop hook failed earlier because the human's user-secrets held `Provider=Claude` (not yet valid), which led to forcing Fake in the test host. One live call passed on the first try. Reviewer APPROVE in round 1 (2 minor, file bookkeeping). The human approved after the manual check.
- 2026-11-10: T3.3 done. Task file approved as written, then built test-first in one pass. Reviewer APPROVE in round 1 (no findings). The invalid-key manual check was not reported separately; approval came by running `/finish-task`.
- 2026-11-10: T4.1 done. Task file approved with all five proposals first; built test-first in one pass. Reviewer APPROVE in round 1 (2 minor, one an out-of-list test edit the agent logged). The human ran the manual check: all good.
- 2026-11-10: T4.2 done. Task file written first; the human's six answers came in one message and work began from them. Reviewer APPROVE in round 1 (1 minor, a doc mismatch). The human ran the manual check: everything works as expected.
- 2026-11-10: T4.3 done. Task file written first; the human answered "yes" to all five proposals, then asked for a confirmation on Back, which the agent had read as "none"; added after review round 1 and re-reviewed (round 2 APPROVE, 1 minor each round, log bookkeeping). The human ran the manual check: everything works as expected.
- 2026-11-10: T4.4 done, "Full demo flow works" gate passed. Task file written first; the human answered "all as proposed", then the build ran in one pass. Reviewer APPROVE in round 1 (no findings). The human ran the voice demo and reported it works. Committed functional scope is complete.
- 2026-11-10: T2.4 done (human task, no agent work). The human reported the voice check as fine and passed the "Voice transcripts usable" gate. Not committed separately: the status change goes in with the next commit.
- 2026-11-11: T5.2 done. Task file written first; the human set the cost rule and approved the one-call check and then the full run. Reviewer APPROVE in round 1 (1 minor). The full run showed one Haiku contract failure, which led to the proposed retry task.
- 2026-11-09: T2.2 done. Reviewer APPROVE in round 1 (4 minor); the one real finding (malformed multipart body gave 500) needed two fixes, the second found by the new test. The agent ran the real-server checks (413, 503, 400, smoke tests against the running container) itself. The human's first manual attempt failed because the API was not running; the human then confirmed everything as expected. `docker compose up --build` with the new `depends_on` was run by the human after the first commit: everything worked (commit amended).
