# Voice → Jira Ticket PoC: development plan (rev. 3)

> **Rev. 3 (2026-11-05): backend simplified.** One ASP.NET Core Minimal API project organised by feature folders, plus test projects. No Domain/Application/Infrastructure layers, no MediatR, Mapster, Polly or FluentValidation. Where the rev. 2 text below mentions them, this note wins; the sections were edited to match. **CLAUDE.md still describes the layered/MediatR design and must be updated to match** (see "Remaining open points").

## Context

A proof of concept that checks one thing: **can a developer describe a bug or feature by voice and get a structured ticket that is accurate enough to review and paste into Jira, with materially less manual writing?** It is not a production app. The PoC's verdict is the **evaluation result (Go / Conditional Go / No-Go)**. CLAUDE.md lists it as committed scope, but it is planned as an **optional phase** (your decision): without it the PoC delivers a working flow but no formal recommendation.

The repo is empty (only `.gitignore`, `CLAUDE.md`, `docs/`), so everything below is new code.

## What changed from rev. 1

| Area | Rev. 1 | Rev. 2 (CLAUDE.md) |
|---|---|---|
| Output | Free-form `tickets[]` with priority, components, labels, assignee, acceptance criteria | **One ticket**, exactly the Bug or Feature **Output Contract**, plus `Missing information` |
| Flow | Login first → live recording → review → create | **Page 1** voice + one editable text field → **one Claude call** → **Page 2** editable fields, `Save as JSON` / `Connect to Jira board` → **Jira login** → **Page 3** board / parent issue form |
| Scope | Jira creation was the core goal | Core = voice → transcript → ticket → preview → copy → **evaluation**. Direct Jira integration is **stretch** (kept because the workflow names it, built last) |
| Architecture | Single API project, MediatR/Clean Architecture "not adopted" | Rev. 2: four layers + MediatR + Mapster + FluentValidation. **Rev. 3 reverted to a single project by feature folders, none of those libraries** |
| State | In-memory transcript store with TTL, optional disk save | **No persistence at all** (out of scope). The transcript lives in the browser; generation is stateless |
| Auth | App-wide Jira login, auth on the WebSocket | **No app auth** (out of scope). Jira login only at the "Connect to Jira board" step |
| Priority/components/labels/assignee/metadata cache | Core | **Dropped** (not in the contract, and out of scope as "configurable templates") |
| Evaluation | Manual end-to-end run | **Optional** Phase 5: 10-scenario dataset (rev. 3; was 6) + runner + scoring + decision criteria + report |

## Decisions carried over (unchanged)
- **.NET 10 / C# 14** backend, **React + Vite + TypeScript** SPA. The API serves the built SPA: one origin, no CORS.
- **Speech-to-text: Whisper in the browser** (Transformers.js, Web Worker, WebGPU/WASM), fully local; see "Speech-to-text runs in the browser". English only. **No benchmarking/spike phase.** (Rev. 1–2 used a WhisperLive container; dropped in rev. 3.)
- **Claude: Anthropic API key**, official `Anthropic` NuGet SDK, **a single Messages call with structured output**, model `claude-opus-5-5`, medium `Effort`, all in config so a cheaper model can be compared in the evaluation. No agents.
- **Jira Server 7.8.1**, REST API v2 directly (no MCP). Each user's own login via `POST /rest/auth/1/session`; keep only `JSESSIONID`, discard the password (no PATs in 7.8).
- Everything runs in **Docker** (`docker compose up`).

## Conventions (from CLAUDE.md)
File-scoped namespaces; primary constructors for DI; `ILogger<T>`; `IOptions<T>` for configuration; injected `TimeProvider`; `IHttpClientFactory` only; `CancellationToken` on every async call; nullable enabled; implicit usings; no `#region`; `IExceptionHandler`; xUnit + FluentAssertions + **Moq**. OpenAPI + Swagger enabled.

- **Validation:** plain code. Request checks are inline in the endpoint and return `TypedResults.ValidationProblem`; model-output checks live in one `TicketValidator` class (no library).
- **Mapping:** hand-written, a few lines per feature; no mapper library.
- **Resilience:** no Polly. Use the `HttpClient` timeout and the Anthropic SDK's built-in retry setting for Claude. Jira calls have no retry (GETs fail fast, the create POST is non-idempotent anyway).
- **Handlers:** each endpoint calls its feature's service directly; no mediator.

**Not used:** EF Core and repositories (no database, persistence is out of scope); MediatR, Mapster, Polly, FluentValidation (dropped in rev. 3 as unnecessary for a PoC of this size).

## Architecture

```
Browser (React)                    Api (ASP.NET Core)                         External
 Page 1: mic → AudioWorklet → 16 kHz buffer ─► Web Worker (Whisper, WebGPU/WASM)   [all local, no network]
         textarea ◄── transcript text
         "Save audio" ── mp3 encoded in browser ─► file download (local only)
         "Generate ticket" ── POST /api/tickets/generate {transcript} ─► TicketGenerator ─► Claude (1 call, JSON schema)
 Page 2: editable fields ◄── Bug | Feature ticket
         [Save as JSON]  (client-side download)
         [Connect to Jira board] ─► POST /api/jira/login ──────────────► Jira 7.8 /rest/auth/1/session
 Page 3: board / parent form ◄── GET /api/jira/boards, /issues/search ──► Jira REST v2 / Agile 1.0
         "Create" ── POST /api/jira/issues ───────────────────────────► Jira REST v2
```

### Solution layout (one API project, organised by feature folder)

```
VoiceToJira.sln
docker-compose.yml                 whisperlive-cpu + api; models volume
src/VoiceToJira.Api/               Single project; Dockerfile; serves the built SPA
  Program.cs                       DI, options (validated on start), OpenAPI/Swagger, endpoint mapping
  Features/Tickets/                Bug/Feature models, TicketType, POST /api/tickets/generate, ITicketGenerator + ClaudeTicketGenerator (prompt, schema), TicketValidator
  Features/Jira/                   Login, boards, parent search, create issue; JiraClient, options, payload builder
  Common/                          IExceptionHandler → ProblemDetails, shared options
web/                               React + Vite + TS
  src/audio/pcm-worklet.ts, recorder.ts
  src/pages/                       VoicePage, TicketPage, JiraPage
tests/VoiceToJira.Tests/           xUnit unit + integration
tests/VoiceToJira.Evaluation/      Evaluation runner (trait-gated, calls the real Claude API)
docs/scenarios/ , eval/results/    Predefined scenarios (10, with README); run outputs
```

### Output contract (`Features/Tickets`)

Fields marked **\*** are required, the others are optional (rev. 3 contract).

| Bug | Feature |
|---|---|
| Type\*, Title\*, Description\*, Steps to reproduce, Actual result, Expected result, Environment / platform, Missing information | Type\*, Title\*, Description\*, User or business need, Acceptance criteria\*, Missing information |

- *Proposed behavior* no longer exists in the Feature ticket.
- JSON shape (API response and `Save as JSON`): **one flat object**, `type` first, then that type's fields, then `missingInformation`. Property names (camelCase, match `docs/scenarios`): bug = `title`, `description`, `stepsToReproduce`, `actualResult`, `expectedResult`, `environment`; feature = `title`, `description`, `userOrBusinessNeed`, `acceptanceCriteria`. Example: `{"type":"Feature","title":…,"description":…,"userOrBusinessNeed":…,"acceptanceCriteria":[…],"missingInformation":[]}`. In C#: abstract `Ticket` record with `BugTicket` / `FeatureTicket`, serialized with `type` as the System.Text.Json discriminator.
- Lists: *Steps to reproduce* (ordered), *Acceptance criteria*, *Missing information* are string arrays; the rest are strings.
- **Missing information = the fields the model could not extract from the input.** Entries are field names of that ticket type (for example `environment`, `acceptanceCriteria`), not questions or explanations. It is derived in code after generation: every field that is empty (`""` / `[]`) is listed, nothing else is. The model is only told to leave unknown fields empty, so the list cannot disagree with the form. Page 2 shows it as a list with readable labels.
- **Required means "must be filled before the ticket can be copied or saved".** The model never invents a required value to satisfy the contract. Title and Description can always be written from any report. *Acceptance criteria* may only restate expectations the speaker actually stated, so it can come back empty; then it is listed in Missing information and the user has to write it on Page 2.
- **One ticket per report.** If the speaker clearly describes two separate items, the model produces the dominant one. It notes the second item in *Description* (for example "Also requested: X, to be filed separately"). Same for an unresolved Bug-vs-Feature doubt. No multi-ticket output.

### The one Claude call
- Input: the (possibly edited) transcript text. Nothing else.
- Output schema (internal to the Claude call, `ClaudeTicketOutput`): `{ type: "Bug"|"Feature", bug: {...}|null, feature: {...}|null }`. It stays nested because a fixed schema per type keeps the model from mixing Bug and Feature fields. `TicketValidator` enforces that exactly the object matching `type` is set and that Title and Description are non-empty, then flattens it to the contract shape and computes `missingInformation` from the empty fields (see the contract).
- A single prompt does classification, structuring and gap detection. Check `StopReason` (`refusal`, `max_tokens`) before parsing.

### Anti-invention rules (prompt + review)
1. Use only facts stated in the transcript. Never infer versions, browsers, OS, URLs, error text, numbers, or steps.
2. A field with no supporting content is left empty (`""` for strings, `[]` for lists). It is then listed in `Missing information` by the code, not by the model.
3. Rewriting is allowed (remove filler, order steps, fix grammar, write a title). Adding substance is not.
4. If the report is ambiguous between Bug and Feature, choose the more likely one and state the doubt in Description.
5. **Review layer:** Page 2 highlights every empty field, lists the missing fields, and blocks Copy / Save until the required ones are filled, so the human reviewer sees gaps before using the ticket. The evaluation measures invention explicitly (see Phase 5).
6. Keep a regression test: transcripts with deliberately absent details must produce empty fields and the matching `missingInformation` entries.

### Speech-to-text runs in the browser (rev. 3)
- **Engine:** Whisper in the browser via `@huggingface/transformers` (Transformers.js, version pinned) running ONNX models inside a **Web Worker**. Device **WebGPU** when available, otherwise **WASM** (CPU). No STT server, no container, no WebSocket.
- **Audio stays on the machine:** it is recorded, held in memory and transcribed locally. Nothing is streamed anywhere. Only the transcript text goes to our API, and only when the user clicks `Generate ticket`.
- **Not live:** the user records, presses stop, then transcription runs with a progress indicator (30 s windows with overlap for longer audio) and fills the textarea. Showing partial text per window as it finishes is allowed; true streaming is not needed.
- **Models (config in the web app, `VITE_STT_MODEL`):** default `whisper-small.en` (ONNX, quantised), with `whisper-base.en` as the config-only fallback for weak machines; `distil-small.en` is another candidate. Exact ONNX repo ids are confirmed at implementation. English only, so **English-only (`.en`) models** are used: they are smaller and more accurate for English than the multilingual ones.
- **Model files:** ~0.1–1 GB depending on the model, downloaded once on first use and cached by the browser (Cache Storage), so later runs work without network. Download source for now is the Hugging Face Hub (see open points for self-hosting).
- **Requirements:** a Chromium browser (Chrome/Edge) for WebGPU and AudioWorklet; shown as a clear message when unsupported.

## Phases

**Prerequisites (alongside Phase 1)**
- Anthropic API key (user-secrets / `.env`).
- Company data-policy approval for sending transcripts to the Anthropic API.
- **Evaluation dataset authored and the decision criteria agreed (Phase 5) before prompt tuning starts**, so the prompt is not tuned on the exam.
- Jira sandbox project (needed only for Phase 6). Company CA certificate if Jira uses one.

### Phase 1: skeleton (~1 day)
- Solution with the single `VoiceToJira.Api` project (feature folders) + test project, OpenAPI + Swagger, health endpoint, `IExceptionHandler` → ProblemDetails, options validated on start.
- Vite React app with dev proxy for `/api`. Multi-stage Dockerfile, `docker-compose.yml` with the single `api` service (serves the SPA).
- Config sections: `Claude` (`ApiKey`, `Model`, `Effort`, `MaxTokens`), `Jira` (`BaseUrl`, `CaCertPath?`, `IssueTypeMap`).

### Phase 2: Page 1, voice → one editable transcript field (~3 days)
- **Recorder:** `getUserMedia` mono; AudioWorklet collects samples, downmixes and resamples to 16 kHz float32 into an in-memory buffer. English only, no language selector (the model is told `language: "en"`).
- **STT worker (`web/src/stt/`):** loads the model (progress bar on first download), receives the 16 kHz buffer on stop, transcribes in 30 s windows, posts text back. Model-load and transcription errors (no WebGPU, download failed, out of memory) become readable messages; WebGPU failure falls back to WASM.
- **UI:** a **single `<textarea>`**. After stop, transcription fills it (window by window, with progress), then it is fully **editable**; the user can also just type or paste (this is the *Edit transcript before generation* stretch item; it costs nothing here). The `Generate ticket` button sends the textarea content.
- No backend involvement in transcription; no transcript store, no disk save, no TTL.
- **`Save audio` button (download only):** the recorder already holds the 16 kHz mono PCM, so on click the browser encodes it to **mp3** (`lamejs`, pinned; `MediaRecorder` cannot produce mp3 natively) and offers it as a normal file download named `{yyyyMMdd_HHmmss}_record.mp3`. No backend endpoint, no upload, no server-side folder. Enabled only after a recording has stopped. It is purely a convenience for the user; nothing in the app or the evaluation reads the file.

### Phase 3: ticket generation (~2 days)
- `POST /api/tickets/generate { transcript }` → `ITicketGenerator` (Claude). Returns the Bug or Feature ticket. Inline request check (non-empty, max length) and `TicketValidator` on the model output (`type` matches the filled object, Title and Description non-empty) and compute `missingInformation`.
- Prompt (system, stable) with the anti-invention rules above; JSON schema from the ticket models; Claude errors/refusal → ProblemDetails.
- Resilience: request timeout plus the Anthropic SDK's built-in retry on transient failures (no Polly).
- The same endpoint serves **Regenerate** (stretch) without extra work.

### Phase 4: Page 2, review, preview, copy, JSON (~2 days)
- Form renders the fields for the detected type; **every field editable** (stretch item *Edit generated ticket fields*, in the workflow); a type switch lets the user flip Bug ↔ Feature only by regenerating (not client-side).
- Empty fields are highlighted; required ones (marked **\***) more strongly. The `Missing information` list (field names the model could not extract) is shown prominently.
- `Copy to clipboard` and `Save as JSON` stay disabled until every required field is non-empty.
- **Board-ready preview** rendered as Jira wiki markup (7.x) in the browser (`web/src/ticket/ticket.ts`, so it updates as fields are edited; Phase 6 sends this markup as the description), with **Copy to clipboard**; **Save as JSON** downloads the (edited) ticket client-side.
- A `Connect to Jira board` button is present from this phase but is wired in Phase 6.
- **Committed scope is complete at the end of this phase.**

### Phase 5: evaluation and recommendation (OPTIONAL, ~2 days)
Skipping this phase does not block Phases 6 and 7. Without it there is no formal Go / Conditional Go / No-Go.

**Dataset** (`docs/scenarios/*.json`, already authored; format and per-scenario purpose in `docs/scenarios/README.md`): **10 scenarios** about the invented app "Ledgerly": BUG-01..04 (detail from full to one sentence), FEATURE-01..03 (explicit criteria to vague), AMBIGUOUS-01 (bug or intended behaviour?), NOISY-01 (filler and self-corrections), MIXED-01 (one bug plus one feature in one report).
- Each file: `id`, `category`, `script` (the text fed to the generator, standing in for the transcript), `expectedType`, `facts[]` (must appear), `expectedMissing[]` (field paths such as `bug.environment`, which now map directly to `missingInformation` entries; `general: ...` entries are remarks judged by a human on Description), `traps[]` (`{text, reason}`: plausible details that must **not** appear, found by case-insensitive search).
- **Freeze before tuning:** a human commits the scenarios and tags `eval-scenarios-v1` before any prompt tuning; prompt examples must not reuse scenario text. Later changes need `v2` and a note in the report. (The files are untracked in git at the moment.)
- **Scoring rules:** AMBIGUOUS-01 and MIXED-01 are excluded from type accuracy (8 scenarios count) and scored on the missing-information flag. MIXED-01's expected type is Bug by convention, with the footer-note request noted in Description as a separate ticket.
- **Traps are searched in the whole ticket JSON,** as the scenarios README says. `Missing information` now holds only field names, so it cannot contain a trap word by accident.
- **Field-path gaps are checked mechanically:** an `expectedMissing` path (`bug.environment`, `feature.acceptanceCriteria`, ...) counts as flagged when the ticket's `type` matches the prefix and `missingInformation` contains the field name after the dot; a field listed that the scenario did not expect counts against precision. The property names are fixed in the contract section above and already match the scenario files.
- **Starts from text:** the evaluation feeds the written transcripts straight into ticket generation. Speech-to-text quality is not part of it.
- **Small-sample caveat:** type accuracy is over 8 scenarios, so a step is 12.5 points: "≥ 90%" effectively means 8/8, "80–90%" means 7/8, and 6/8 is No-Go. Other metrics move in steps of 10 points. The result is a go/no-go signal for the PoC, not a statistical claim.

**Runner:** `tests/VoiceToJira.Evaluation`, xUnit tests with `[Trait("Category","Evaluation")]`, skipped when no API key. Run with `dotnet test --filter "Category=Evaluation"`. Calls the real generator for each transcript (n=1, plus a 3-repeat stability pass on AMBIGUOUS-01, NOISY-01 and MIXED-01), using each file's `script` and writes `eval/results/<date>.json` with a scoring sheet. The runner does not use new build scripts.

**Metrics and proposed thresholds (confirm before running):**

| Metric | How measured | Go | Conditional Go | No-Go |
|---|---|---|---|---|
| Contract compliance | Output valid against the contract | 100% | ≥ 95% | < 95% |
| Type classification accuracy | vs `expectedType` | ≥ 90% | 80–90% | < 80% |
| Fact coverage | `groundTruthFacts` present / total | ≥ 85% | 70–85% | < 70% |
| **Invention rate** | Tickets containing any `traps` item or unsupported fact (automatic check + human read of all tickets) | 0 critical, ≤ 10% tickets with a minor one | ≤ 1 critical or ≤ 20% minor | > 1 critical |
| Missing-info recall / precision | vs `expectedMissing` | ≥ 80% / ≥ 70% | 60–80% | < 60% |
| Usability | Reviewer rating per ticket: usable / minor edit / rewrite | ≥ 80% usable or minor edit | 60–80% | < 60% |
| Time saved | Timed: writing 3 tickets by hand vs dictate + review | ≥ 30% less | 10–30% | < 10% |
| Latency | `Generate ticket` click → ticket displayed | informational (target < 15 s) | | |

The overall result is the **worst** category reached by the invention, classification and usability rows; other rows adjust the conditions attached to a Conditional Go.

**Deliverable:** `docs/evaluation-report.md` with the results table, 3–5 representative before/after tickets, failure analysis, the recommendation (Go / Conditional Go / No-Go), and for Conditional Go the explicit conditions (e.g. "tighten prompt rule X", "mandatory reviewer step").

### Phase 6: Jira connect (stretch, ~3 days; only after Phase 5)
- **Login:** `POST /api/jira/login` (`username`, `password`) → `JiraClient.CreateSession`, keep `JSESSIONID` in an encrypted HttpOnly SameSite=Strict cookie, discard the password. 403 + `X-Seraph-LoginReason: AUTHENTICATION_DENIED` → tell the user to log in once through the Jira UI (CAPTCHA). A Jira 401 clears the session and returns the user to the login step. This is not an app login: pages 1 and 2 stay anonymous.
- **Page 3 form:**
  - Board picker: `GET /rest/agile/1.0/board` (the board decides the project via `/board/{id}/project`).
  - Parent issue picker (optional): search via `/rest/api/2/search` (JQL on summary/key) in that project, with the allowed targets depending on the ticket type:
    - **Feature (Story):** pick an **Epic** → set via the Epic Link custom field (field id discovered from `GET /rest/api/2/field`, name "Epic Link").
    - **Bug:** pick a **Story** → Jira cannot make a Story the parent of a Bug, so the Bug is created and then connected with an **issue link** (`POST /rest/api/2/issueLink`, link type configurable, default "Relates"). Bug as a sub-task is not used.
  - Issue type: `IssueTypeMap`: Bug → **Bug**, Feature → **Story**.
- **Create:** `POST /api/jira/issues` builds the payload: summary = Title; description = the same Jira wiki markup as the preview (all contract sections including Missing information); Epic Link for a Story, a follow-up issue link for a Bug (if the link call fails after the create succeeded, return the key with a warning rather than retry). `X-Atlassian-Token: no-check`; **no retry on the create POST** (non-idempotent); Jira `errors` map returned to the form. Returns `{key, url}`.
- No retry policy on Jira calls. Log every creation (user, key).

### Phase 7: demo and documentation (~1 day)
- Error UX: microphone denied, unsupported browser / no WebGPU, model download failed, Claude error/refusal, expired Jira session.
- README: prerequisites, `docker compose up`, config, known limits, demo script, link to the evaluation report.

### Out of scope (confirmed in CLAUDE.md; list in README as production follow-ups)
Production auth/SSO, persistent history or database, observability/scalability/hardening, offline transcription, attachments, screenshots, duplicate detection, analytics, enterprise templates, polished design system, mobile/desktop packaging.

## Testing and verification
Commands: `dotnet build`, `dotnet test`, `dotnet test --filter "FullyQualifiedName~X"`, `dotnet run --project src/VoiceToJira.Api/VoiceToJira.Api.csproj`.
- **Unit:** ticket validator (type/object consistency, required Title/Description) and `missingInformation` derivation; Jira payload builder; Jira error mapping; prompt/schema snapshot.
- **Integration:** `ClaudeTicketGenerator` against a stub handler (refusal, `max_tokens`, malformed JSON); `JiraClient` against a stub handler (cookie forwarding, 401, no retry on POST).
- **Frontend:** Vitest (`npm test`) for the wiki-markup renderer, missing-information derivation and required-field gating of Copy / Save. (Resampling is done by the browser's `AudioContext`, so there is no resampler to test.)
- **Evaluation:** optional Phase 5 (real API, excluded from the default run unless a key is present).
- **Manual end to end** on the laptop: `docker compose up`, dictate one bug and one feature in English; stop, edit the textarea, generate, check gaps, edit a field, copy the preview, save JSON; with Phase 6, log in, pick a board and parent, create, open the link.

## Resolved decisions (2026-11-04)
1. Endpoints use Minimal APIs with `TypedResults`; `ActionResult<T>` is not used.
2. Mocking library: **Moq** (not NSubstitute).
3. CLAUDE.md run command fixed to `src/VoiceToJira.Api/VoiceToJira.Api.csproj`.
4. Parent issue: Story → Epic Link; Bug → issue link to a Story (link type configurable, default "Relates").
5. Feature maps to the **Story** issue type.
6. Evaluation thresholds accepted. (Rev. 3: the evaluation starts from transcribed text, no audio samples; `Save audio` is download-only.)
7. Phase order confirmed (Jira after evaluation). Evaluation is optional; the dataset is the 10 scenarios in `docs/scenarios/` (rev. 3).
8. (2026-11-05) Backend is one Minimal API project by feature folders plus test projects. No layers, MediatR, Mapster, Polly or FluentValidation.
9. (2026-11-05) English only: no Ukrainian, no language selector. `Save audio` is a client-side download; no `/api/audio`, no `audio/` folder. Evaluation starts from text. Speech-to-text runs fully in the browser (Whisper via Transformers.js in a Web Worker). No WhisperLive, no WebSocket relay, no `SegmentMerger`, no live streaming; transcription happens after the user stops recording.

## Remaining open points
- **Scenario files vs the new contract: resolved (2026-11-05).** `FEATURE-02` and `FEATURE-03` now expect `feature.acceptanceCriteria` (and no `proposedBehavior`); README rows updated.
- **Non-field notes: resolved.** For `AMBIGUOUS-01` ("bug or intended behaviour?") and `MIXED-01` ("footer note is a separate ticket") the model states the remark inside *Description* (the speaker's own content, not invention). Their `general:` expectations are judged by the human reader on Description; missing-information precision is not computed for AMBIGUOUS-01. The prompt must allow this explicitly.
- **Model hosting:** first run downloads the Whisper model from the Hugging Face Hub (then cached). If the company network blocks it, or "nothing leaves the machine" must also cover the download, we self-host the model files from the API container instead (extra step: pre-download into a git-ignored `models/` volume).
- **Model/hardware fit:** whether `whisper-small.en` is fast and accurate enough on the team's laptops is checked by using it (fallback `base.en` is config-only), not by a spike phase. STT quality is not part of the evaluation.
- **CLAUDE.md synced with rev. 3 (2026-11-05):** architecture, libraries, rules, STT and the output contract. Deliberately left as written: the Scope section, which still lists the evaluation as committed (the plan runs it as an optional phase) and "Offline transcription" as out of scope (the in-browser STT is on-device, but the first model download needs network).
- Jira link-type name for "Bug relates to Story" in your Jira (assumed "Relates"); the Epic Link field id is discovered automatically.
- Freezing the scenarios: a human reviews them, commits and tags `eval-scenarios-v1` (needed only if Phase 5 is run, but before prompt tuning).
