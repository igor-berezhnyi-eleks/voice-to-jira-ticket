# Progress

The plan is in [development-plan.md](development-plan.md) (rev. 4, aligned with CLAUDE.md; Jira target is Jira Cloud). Tick items off as they land, and add a dated line to the log.

## Status

| Phase | Status |
|---|---|
| Planning | Done (rev. 1 2026-11-03; rev. 2 2026-11-04, awaiting approval) |
| Prerequisites | Not started |
| 1. Skeleton | Done (2026-11-05) |
| 2. Page 1: voice → editable transcript | Done (2026-11-05) |
| 3. Ticket generation (one Claude call) | Done (2026-11-05), checked by the user in the browser |
| 4. Page 2: review, preview, copy, JSON (committed scope done) | Done (2026-11-06), checked by the user in the browser |
| 5. Evaluation and Go / Conditional Go / No-Go (OPTIONAL) | Not started |
| 6. Jira connect (stretch, Jira Cloud) | Done (2026-11-10), checked by the user in the browser |
| 7. Demo and documentation | Not started |

## Prerequisites
- [ ] Anthropic API key available (user-secrets / `.env`)
- [ ] Company data-policy approval for sending transcripts to the Anthropic API
- [x] (Optional, Phase 5) 10 evaluation scenarios authored in `docs/scenarios/` (untracked); thresholds already agreed
- [x] (Optional, Phase 5) Scenarios committed and tagged `eval-scenarios-v1` (2026-11-05), before prompt tuning
- [ ] Jira Cloud site URL (typed at login), sandbox project with a board, an Epic and a Story, tester's Atlassian API token (Phase 6)
- [x] Open questions answered (2026-11-04); remaining: Jira link-type name for Bug → Story

## Phase 1: skeleton
- [x] Solution: single `VoiceToJira.Api` project (feature folders) + test project(s); no MediatR/Mapster/Polly/FluentValidation
- [x] OpenAPI + Swagger, health endpoint, `IExceptionHandler` → ProblemDetails, options validated on start
- [x] Config sections: `Claude`, `Jira`
- [x] `web/` Vite + React + TS app, dev proxy for `/api`
- [x] Multi-stage Dockerfile (API serves the SPA)
- [x] `docker-compose.yml`: single `api` service (serves SPA)

## Phase 2: Page 1, voice → one editable transcript field
- [x] AudioWorklet recorder (downmix + resample to 16 kHz f32 into an in-memory buffer)
- [x] STT Web Worker (Transformers.js Whisper, WebGPU with WASM fallback, model download progress, 30 s windows)
- [x] Stop flow: transcribe on stop, fill textarea with progress
- [x] Single editable textarea (English only, no language selector), typing/pasting works; unsupported-browser message
- [x] `Save audio` button: mp3 encoded in browser, downloaded as `yyyyMMdd_HHmmss_record.mp3` (no backend)

## Phase 3: ticket generation
- [x] Ticket contract (rev. 3): Bug and Feature models with required/optional fields, `missingInformation` derived from empty fields
- [x] `POST /api/tickets/generate` → `ITicketGenerator` → Claude (one call, JSON schema, classification included)
- [x] Prompt with anti-invention rules (unknown fields left empty)
- [x] StopReason handling, inline request check + `TicketValidator` for output, Claude timeout/SDK retry
- [x] Unit/integration tests incl. "absent detail → empty field + missingInformation entry" regression

## Phase 4: Page 2, review, preview, copy, JSON
- [x] Type-aware form, all fields editable
- [x] Empty-field highlighting, Missing information list (field names), Copy / Save disabled until required fields are filled
- [x] Jira wiki-markup preview + Copy to clipboard
- [x] Save as JSON
- [x] `Connect to Jira board` button present (wired in Phase 6)

## Phase 5: evaluation and recommendation (OPTIONAL)
- [x] Dataset: 10 scenarios in `docs/scenarios/` with facts, expected missing info, traps (to be frozen as `eval-scenarios-v1`)
- [ ] Runner `tests/VoiceToJira.Evaluation` (`Category=Evaluation`), results to `eval/results/`
- [ ] Human scoring: invention, usability, time saved
- [ ] `docs/evaluation-report.md` with recommendation and conditions

## Phase 6: Jira connect (stretch, Jira Cloud)
- [x] `/api/jira/login` (email + API token checked via `/myself`, encrypted HttpOnly cookie), logout, 401 handling
- [x] Board list, parent search via `/search/jql` (Feature → Epic via `parent`; Bug → issue link to a Story), type map Bug→Bug, Feature→Story
- [x] `POST /api/jira/issues` (wiki-markup description, no retry on POST), Jira field errors mapped to the form
- [x] Page 3 form

## Phase 7: demo and documentation
- [ ] Error UX: microphone denied, no WebGPU/unsupported browser, model download failed, Claude errors, expired Jira session
- [ ] README: setup, config, known limits, demo script, link to the evaluation report
- [ ] Manual end-to-end run (English)

## Log
- 2026-11-10: Phase 6 checked by the user in the browser against Jira Cloud (login, board, parent Story, create Bug with issue type dropdown). Phase 6 done.
- 2026-11-10: Issue-type fallback: `GET /api/jira/issue-types?projectKey&type` returns the project's types and the one matching the Bug/Feature mapping; when none matches, Page 3 shows an "Issue type" dropdown (required) and sends the choice as `issueType`, which overrides the mapping. 52 backend tests pass.
- 2026-11-10: Create now looks up the project's issue types (`GET /rest/api/2/project/{key}`) first and matches the configured name case-insensitively; if the project has no such type (Jira answered "Specify a valid issue type" for Bug) it stops with a message listing the available types and pointing to `Jira:IssueTypeMap`. 51 backend tests pass.
- 2026-11-10: Jira site URL moved from config (`Jira:BaseUrl`, removed) to the login form; it is validated as an https `*.atlassian.net` host and stored in the encrypted cookie with the email and token. The empty `BaseUrl` in appsettings.json had overridden the value hard-coded in `JiraOptions`, which caused the "Set Jira:BaseUrl" error.
- 2026-11-10: Phase 6 in code (not yet tried against a real Jira site). `Features/Jira`: `JiraOptions` (`IssueTypeMap`, `LinkTypeName`), `JiraSession` (email + token in a Data Protection cookie), `JiraClient` (Basic auth, `/myself`, agile boards with project key, `/search/jql`, create, issue link; no retries; link failure after create returns a warning), `JiraPayloadBuilder`, `/api/jira/{login,logout,boards,parents,issues}`. Frontend `JiraPage` (login → board → optional Epic/Story → create) behind the now-enabled `Connect to Jira board`. 50 backend and 7 frontend tests pass. Manual check against the sandbox site still open.
- 2026-11-10: Plan rev. 4: Jira target changed from corporate Jira Server 7.8.1 to Jira Cloud (atlassian.net). Login = user's Atlassian email + API token (no password session), search via `/rest/api/2/search/jql`, Epic parent via `parent`, `CaCertPath` dropped, `LinkTypeName` added. Phase 6 started.
- 2026-11-06: `Save as JSON` always opens the browser's save dialog (`showSaveFilePicker`, Chromium; plain download as fallback) with the suggested name `{bug|feature}-ticket_DD.MM.YY_HH.MM.json` in local time. Cancelling the dialog does nothing.
- 2026-11-06: Ticket JSON flattened (API response and Save as JSON): `{type, title, description, <type fields>, missingInformation}` instead of `{type, bug, feature}`. Backend: abstract `Ticket` record with `BugTicket` / `FeatureTicket`, `type` as the System.Text.Json discriminator, property order pinned. The Claude schema stays nested (`ClaudeTicketOutput`, internal) and `TicketValidator` flattens it; prompt unchanged. Scenario files unchanged (`bug.environment` = type prefix + field). 30 backend and 6 frontend tests pass.
- 2026-11-06: Phase 4 in code. Page 2 (`web/src/pages/TicketPage.tsx`) replaces the raw JSON view: type-aware form with every field editable (lists one item per line), empty fields highlighted (required ones in red), Missing information list with readable labels recomputed live from the empty fields (same rule as `TicketValidator`), Jira 7.x wiki-markup preview (title as Summary, empty optional sections skipped, Missing information section, `{ } [ ]` escaped), `Copy title` / `Copy description` / `Save as JSON` disabled until the required fields are filled, `Back to transcript`, `Regenerate` (asks before replacing edits), `Connect to Jira board` present but disabled. Bug ↔ Feature is changed only by editing the transcript and regenerating. Page 1 stays mounted while Page 2 is shown, so recording, speech model and transcript survive. The wiki-markup renderer lives in the frontend (`web/src/ticket/ticket.ts`) so the preview updates without an API call; Phase 6 will send this markup as the Jira description. Vitest 5.1.0 added (`npm test`, 6 tests on missing-info derivation, required gating, JSON export, wiki markup).
- 2026-11-05: Phase 3 in code. `Features/Tickets`: `TicketModels` (Bug/Feature records, `TicketType` as string enum), `TicketPrompt` (system prompt with the anti-invention rules, JSON schema `{type, bug|null, feature|null}`), `ClaudeTicketGenerator` (Anthropic SDK 13.5.0, one beta Messages call with structured output, effort from config, server-side refusal fallback `fallbacks: "default"` via `server-side-fallback-2026-07-01`, `StopReason` checked before parsing, SDK timeout `Claude:TimeoutSeconds` + retries `Claude:MaxRetries`), `TicketValidator` (type/object consistency, non-empty Title/Description, trims values, derives `missingInformation`), `POST /api/tickets/generate` (inline checks: non-empty, ≤ 20 000 chars; errors → ProblemDetails 422 refusal / 503 no key / 504 timeout / 502 otherwise). 30 tests pass (validator, generator against a stub HTTP handler, endpoint with a mocked generator). Page 1 has a `Generate ticket` button (`web/src/api/tickets.ts`) that shows the result as raw JSON until Page 2 (Phase 4) replaces it.
- 2026-11-05: Phase 2 done, checked by the user in the browser (record, transcribe, edit, Save audio). `web/src/audio/` (AudioWorklet downmix to mono; resampling is done by the browser via `AudioContext({ sampleRate: 16000 })`, Chromium only), `web/src/stt/` (module Web Worker, Transformers.js 4.3.2 pinned, default model `onnx-community/whisper-small.en`, override with `VITE_STT_MODEL`; WebGPU fp32 encoder + q4 decoder, WASM q8 fallback; model download starts when the page opens). Long audio is split into ≤30 s windows cut at the quietest 100 ms in the last 5 s, so no overlap merging is needed; each window updates the textarea. No `language` option is passed because Transformers.js rejects it for `.en` models. `Save audio` uses `@breezystack/lamejs` 1.2.7 (ESM fork of lamejs; the original breaks under ES modules), 64 kbps mono. The ONNX Runtime wasm (~27 MB) is bundled and served by the API; model files still come from the Hugging Face Hub. Dockerfile runs `npm ci --ignore-scripts` (skips the unused onnxruntime-node download).
- 2026-11-05: Phase 1 skeleton done. `VoiceToJira.slnx` with `src/VoiceToJira.Api` (options `Claude`/`Jira` validated on start, `GlobalExceptionHandler` → ProblemDetails, `/api/health`, OpenAPI at `/openapi/v1.json` + Swagger UI at `/swagger`, SPA served from `wwwroot` with `index.html` fallback, unknown `/api/*` → 404) and `tests/VoiceToJira.Tests` (xUnit v3 on Microsoft.Testing.Platform via `global.json`, FluentAssertions pinned to 7.2.0 because v8 needs a commercial licence, Moq). `web/` Vite + React + TS with `/api` proxy to `http://localhost:5080`. Multi-stage Dockerfile and single-service compose; `docker compose up` checked by the user (API and Swagger on :8080). `Claude:ApiKey` is not checked on start; Phase 3 reports a missing key at generation time.
- 2026-11-05: Plan rev. 3 in progress: backend simplified to one Minimal API project by feature folders; MediatR, Mapster, Polly, FluentValidation dropped. CLAUDE.md still to be synced.
- 2026-11-05: STT moved fully into the browser (Whisper via Transformers.js in a Web Worker, WebGPU/WASM, transcribe after stop). WhisperLive container, WebSocket relay and SegmentMerger removed from the plan.
- 2026-11-03: Plan approved (rev. 1). WhisperLive mode fixed to CPU image + `large-v3-turbo` (no benchmarking phase). Jira auth uses each user's own login (session cookie). Claude is reached with an Anthropic API key via a single structured-output call.
- 2026-11-04: CLAUDE.md gained scope, workflow and output contract. Plan revised (rev. 2): single-ticket Bug/Feature contract, 3-page flow, layered VSA + MediatR, no persistence or app auth, evaluation phase added, Jira integration moved to stretch. Seven open questions listed at the end of the plan.
- 2026-11-05: CLAUDE.md synced with rev. 3 (single Minimal API project, no MediatR/FluentValidation/Mapster/Polly/EF Core, in-browser STT, English only, new output contract, TypedResults rule). Scope section left as is.
- 2026-11-05: Contract updated: required fields marked (Bug: Type, Title, Description; Feature: Type, Title, Description, Acceptance criteria), Feature loses Proposed behavior, Missing information = field names the model could not extract (derived from empty fields). Scenario files FEATURE-02/03 and the README updated (acceptanceCriteria expected missing); notes for AMBIGUOUS-01/MIXED-01 go in Description.
- 2026-11-05: Whisper via Transformers.js confirmed. Evaluation dataset is now the 10 scenarios in `docs/scenarios/` (README format, scoring rules, trap search excludes Missing information).
- 2026-11-05: English only (Ukrainian and language selector removed). `Save audio` is download-only (no `/api/audio`, no `audio/` folder). Evaluation starts from transcribed text; STT quality dropped from it. Default STT model `whisper-small.en`.
- 2026-11-04: Open questions answered: TypedResults, Moq, Story for features, Epic Link for Story / issue link to Story for Bug. Phase 5 made optional with 6 scenarios. Added `Save audio` (mp3) to Page 1. `audio/` added to `.gitignore`; CLAUDE.md run path and test library (Moq) fixed.
