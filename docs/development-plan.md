# Voice → Jira Ticket PoC: development plan (rev. 2, aligned with CLAUDE.md)

## Context

A proof of concept that checks one thing: **can a developer describe a bug or feature by voice and get a structured ticket that is accurate enough to review and paste into Jira, with materially less manual writing?** It is not a production app. The PoC's verdict is the **evaluation result (Go / Conditional Go / No-Go)**. CLAUDE.md lists it as committed scope, but it is planned as an **optional phase** (your decision): without it the PoC delivers a working flow but no formal recommendation.

The repo is empty (only `.gitignore`, `CLAUDE.md`, `docs/`), so everything below is new code.

## What changed from rev. 1

| Area | Rev. 1 | Rev. 2 (CLAUDE.md) |
|---|---|---|
| Output | Free-form `tickets[]` with priority, components, labels, assignee, acceptance criteria | **One ticket**, exactly the Bug or Feature **Output Contract**, plus `Missing information` |
| Flow | Login first → live recording → review → create | **Page 1** voice + one editable text field → **one Claude call** → **Page 2** editable fields, `Save as JSON` / `Connect to Jira board` → **Jira login** → **Page 3** board / parent issue form |
| Scope | Jira creation was the core goal | Core = voice → transcript → ticket → preview → copy → **evaluation**. Direct Jira integration is **stretch** (kept because the workflow names it, built last) |
| Architecture | Single API project, MediatR/Clean Architecture "not adopted" | **Domain / Application / Infrastructure / Api**, Vertical Slice, **CQRS with MediatR**, Mapster, FluentValidation |
| State | In-memory transcript store with TTL, optional disk save | **No persistence at all** (out of scope). The transcript lives in the browser; generation is stateless |
| Auth | App-wide Jira login, auth on the WebSocket | **No app auth** (out of scope). Jira login only at the "Connect to Jira board" step |
| Priority/components/labels/assignee/metadata cache | Core | **Dropped** (not in the contract, and out of scope as "configurable templates") |
| Evaluation | Manual end-to-end run | **Optional** Phase 5: 6-scenario dataset + runner + scoring + decision criteria + report |

## Decisions carried over (unchanged)
- **.NET 10 / C# 14** backend, **React + Vite + TypeScript** SPA. The API serves the built SPA: one origin, no CORS.
- **Speech-to-text: WhisperLive CPU** (`ghcr.io/collabora/whisperlive-cpu`, `large-v3-turbo`, shared model via `-fw`). English, sometimes Ukrainian. **No benchmarking/spike phase.**
- **Claude: Anthropic API key**, official `Anthropic` NuGet SDK, **a single Messages call with structured output**, model `claude-opus-5-5`, medium `Effort`, all in config so a cheaper model can be compared in the evaluation. No agents.
- **Jira Server 7.8.1**, REST API v2 directly (no MCP). Each user's own login via `POST /rest/auth/1/session`; keep only `JSESSIONID`, discard the password (no PATs in 7.8).
- Everything runs in **Docker** (`docker compose up`).

## Conventions (from CLAUDE.md)
File-scoped namespaces; primary constructors for DI; `ILogger<T>`; `IOptions<T>` for configuration; injected `TimeProvider`; `IHttpClientFactory` only; `CancellationToken` on every async call; nullable enabled; implicit usings; no `#region`; `IExceptionHandler`; FluentValidation in the endpoint pipeline; Mapster mapping inside MediatR handlers; Polly for resilience; xUnit + FluentAssertions + **Moq**. OpenAPI + Swagger enabled.

**Not used, because there is no database:** EF Core, repositories. Listed in CLAUDE.md "Libraries", but persistence is explicitly out of scope.

## Architecture

```
Browser (React)                    Api (ASP.NET Core)                         External
 Page 1: mic → AudioWorklet ─ws /ws/transcribe─► TranscriptionRelay ─ws─► WhisperLive :9090
         textarea ◄── {confirmed[], tentative} ── SegmentMerger
         "Save audio" ── POST /api/audio (mp3 encoded in browser) ─► ./audio/yyyyMMdd_HHmmss_record.mp3 (git-ignored)
         "Generate ticket" ── POST /api/tickets/generate {transcript} ─► GenerateTicketHandler ─► Claude (1 call, JSON schema)
 Page 2: editable fields ◄── Bug | Feature ticket
         [Save as JSON]  (client-side download)
         [Connect to Jira board] ─► POST /api/jira/login ──────────────► Jira 7.8 /rest/auth/1/session
 Page 3: board / parent form ◄── GET /api/jira/boards, /issues/search ──► Jira REST v2 / Agile 1.0
         "Create" ── POST /api/jira/issues ───────────────────────────► Jira REST v2
```

### Solution layout (VSA inside each layer, organised by feature folder)

```
VoiceToJira.sln
docker-compose.yml                 whisperlive-cpu + api; models volume
src/VoiceToJira.Domain/            Ticket (Bug/Feature) models, TicketType, value objects. No dependencies.
src/VoiceToJira.Application/       Features/<Feature>/ command|query + handler + validator + DTOs (MediatR, FluentValidation, Mapster)
  Features/Transcription/          SegmentMerger, transcript session abstractions
  Features/Audio/             SaveAudio command (writes the file via TimeProvider-based name)
  Features/Tickets/                GenerateTicket, RenderJiraMarkup (preview/copy)
  Features/Jira/                   Login, ListBoards, SearchParentIssues, CreateIssue
  Abstractions/                    ITicketGenerator, IJiraClient
src/VoiceToJira.Infrastructure/    Claude/ (ClaudeTicketGenerator, prompt, schema), Jira/ (JiraClient, handler, options), WhisperLive/ (protocol DTOs, relay client)
src/VoiceToJira.Api/               Endpoints per feature, WebSocket relay endpoint, IExceptionHandler, OpenAPI/Swagger, serves SPA; Dockerfile
web/                               React + Vite + TS
  src/audio/pcm-worklet.ts, recorder.ts
  src/pages/                       VoicePage, TicketPage, JiraPage
tests/VoiceToJira.Tests/           xUnit unit + integration
tests/VoiceToJira.Evaluation/      Evaluation runner (trait-gated, calls the real Claude API)
eval/dataset/ , eval/results/      Predefined scenarios; run outputs
```

### Output contract (Domain)

| Bug | Feature |
|---|---|
| Type, Title, Description, Steps to reproduce, Actual result, Expected result, Environment / platform, Missing information | Type, Title, Description, User or business need, Proposed behavior, Acceptance criteria, Missing information |

- Lists: *Steps to reproduce* (ordered), *Acceptance criteria*, *Missing information* are string arrays; the rest are strings.
- **One ticket per report.** If the speaker clearly describes two separate items, the model must produce the dominant one and name the other in `Missing information` / a note. No multi-ticket output.

### The one Claude call
- Input: the (possibly edited) transcript text. Nothing else.
- Output schema: `{ type: "Bug"|"Feature", bug: {...}|null, feature: {...}|null }`; the Application validator enforces that exactly the object matching `type` is set and all contract fields are present.
- A single prompt does classification, structuring and gap detection. Check `StopReason` (`refusal`, `max_tokens`) before parsing.

### Anti-invention rules (prompt + review)
1. Use only facts stated in the transcript. Never infer versions, browsers, OS, URLs, error text, numbers, or steps.
2. A field with no supporting content is the literal `"Not provided"` (strings) or `[]` (lists), and **must** be named in `Missing information` with a short question ("Which browser and version?").
3. Rewriting is allowed (remove filler, order steps, fix grammar, write a title). Adding substance is not.
4. If the report is ambiguous between Bug and Feature, choose the more likely and say why in `Missing information`.
5. **Review layer:** Page 2 visually flags every `Not provided` field and lists the missing-information questions, so the human reviewer sees gaps before copying. The evaluation measures invention explicitly (see Phase 5).
6. Keep a regression test: transcripts with deliberately absent details must produce `Not provided`.

### WhisperLive wire protocol (verified against `whisper_live/client.py`, pin the version)
- First text frame: JSON with `uid`, `language` (null = auto), `task:"transcribe"`, `model`, `use_vad:true`, `send_last_n_segments`, `no_speech_thresh`, `same_output_threshold`, `initial_prompt`, `hotwords`.
- Audio: binary frames of little-endian float32 PCM, mono, 16 kHz, [-1, 1].
- Server: `SERVER_READY`, `{"status":"WAIT"|"ERROR"|"WARNING"}`, `{"language","language_prob"}`, `{"segments":[{start,end,text,completed}]}`, `DISCONNECT`.
- End of audio: bytes `END_OF_AUDIO` as a binary frame. Segments are re-sent, so **merge by `start`**; `completed:true` is confirmed, the last non-completed segment is tentative.

### WhisperLive on this laptop
CPU image, int8, `large-v3-turbo`, `--omp_num_threads 4`, `--max_clients 4`, `--max_connection_time 900`, model converted once into a `models` volume and passed with `-fw`. Docker Desktop on Windows (WSL2) has no `/dev/dri`, so no GPU image. Known risk: tentative text may lag; fallback is a config-only change to `medium`.

## Phases

**Prerequisites (alongside Phase 1)**
- Anthropic API key (user-secrets / `.env`).
- Company data-policy approval for sending transcripts to the Anthropic API.
- **Evaluation dataset authored and the decision criteria agreed (Phase 5) before prompt tuning starts**, so the prompt is not tuned on the exam.
- Jira sandbox project (needed only for Phase 6). Company CA certificate if Jira uses one.

### Phase 1: skeleton (~1 day)
- Solution with the four layers + test project, MediatR/FluentValidation/Mapster/Polly wired, OpenAPI + Swagger, health endpoint, `IExceptionHandler` → ProblemDetails, options validated on start.
- Vite React app with dev proxy for `/api` and `/ws`. Multi-stage Dockerfile, `docker-compose.yml` with `whisperlive-cpu`.
- Config sections: `WhisperLive`, `Claude` (`ApiKey`, `Model`, `Effort`, `MaxTokens`), `Jira` (`BaseUrl`, `CaCertPath?`, `IssueTypeMap`).

### Phase 2: Page 1, voice → one editable transcript field (~3 days)
- **Browser:** `getUserMedia` mono, AudioWorklet downmix + resample to 16 kHz float32 (~100 ms chunks), WebSocket to `/ws/transcribe` with `start`/`stop` control frames. Language selector: Auto / English / Українська.
- **Backend relay (anonymous, PoC):** browser socket ↔ `ClientWebSocket` to WhisperLive, two pump loops, one linked `CancellationTokenSource`; pass `WAIT`/`ERROR` through.
- **`SegmentMerger`** (backend, unit-tested): ordered map by `start`; sends deltas `{confirmed[], tentative}`.
- **UI:** a **single `<textarea>`**. While recording, confirmed text is appended to it and the tentative text shows greyed below it. After stop (`END_OF_AUDIO`, ~3 s final flush, tentative promoted) the textarea is fully **editable** and the user can also just type or paste (this is the *Edit transcript before generation* stretch item; it costs nothing here). The `Generate ticket` button sends the textarea content.
- No transcript store, no disk save, no TTL.
- **`Save audio` button:** the recorder already holds the 16 kHz mono PCM, so on click the browser encodes it to **mp3** (`lamejs`, pinned; `MediaRecorder` cannot produce mp3 natively, so a small encoder is the only way to get mp3 and avoids ffmpeg in the container) and posts it to `POST /api/audio`. The `SaveAudio` handler writes `audio/{yyyyMMdd_HHmmss}_record.mp3` using the injected `TimeProvider`. `audio/` is at the repo root, **added to `.gitignore`**, and bind-mounted into the API container (`./audio:/app/audio`) so files land in the solution folder. Enabled only after a recording has stopped. These files are the source for the optional evaluation's audio subset. It is a local dev aid, not persistence: nothing reads the files back in the app.

### Phase 3: ticket generation (~2 days)
- `POST /api/tickets/generate { transcript }` → `GenerateTicketCommand` → `ITicketGenerator` (Claude). Returns the Bug or Feature ticket. FluentValidation on the request (non-empty, max length) and on the model output (contract completeness, `type` matches the filled object).
- Prompt (system, stable) with the anti-invention rules above; JSON schema from the Domain contract; Claude errors/refusal → ProblemDetails.
- Resilience: Polly on the Claude HTTP client (timeout and retry on transient failures).
- The same endpoint serves **Regenerate** (stretch) without extra work.

### Phase 4: Page 2, review, preview, copy, JSON (~2 days)
- Form renders the fields for the detected type; **every field editable** (stretch item *Edit generated ticket fields*, in the workflow); a type switch lets the user flip Bug ↔ Feature only by regenerating (not client-side).
- `Not provided` fields are highlighted and the `Missing information` list is shown prominently.
- **Board-ready preview** rendered as Jira wiki markup (7.x), with **Copy to clipboard**; **Save as JSON** downloads the (edited) ticket client-side.
- A `Connect to Jira board` button is present from this phase but is wired in Phase 6.
- **Committed scope is complete at the end of this phase.**

### Phase 5: evaluation and recommendation (OPTIONAL, ~2 days)
Skipping this phase does not block Phases 6 and 7. Without it there is no formal Go / Conditional Go / No-Go.

**Dataset** (`eval/dataset/*.json`, authored by the team before tuning): **6 scenarios, 2 per category.**
- 2 bug, 2 feature, 2 edge cases (e.g. one ambiguous/very sparse report and one rambling Ukrainian report with filler and self-corrections).
- Each scenario: `id`, `language`, `transcript`, `expectedType`, `groundTruthFacts[]` (atomic facts that must appear), `expectedMissing[]` (information the transcript does not contain), `traps[]` (plausible details that must **not** appear, e.g. "Chrome" when no browser was mentioned).
- Audio: record the scenarios with the `Save audio` button and keep the mp3s in `audio/` (git-ignored) to test the full path including speech-to-text.
- **Small-sample caveat:** with 6 scenarios each percentage moves in steps of ~17 points, so "≥ 90%" effectively means 6/6 and "80–90%" means 5/6. The result is a go/no-go signal for the PoC, not a statistical claim.

**Runner:** `tests/VoiceToJira.Evaluation`, xUnit tests with `[Trait("Category","Evaluation")]`, skipped when no API key. Run with `dotnet test --filter "Category=Evaluation"`. Calls the real generator for each transcript (n=1, plus a 3-repeat stability pass on the 2 edge cases) and writes `eval/results/<date>.json` with a scoring sheet. The runner does not use new build scripts.

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
| STT quality (audio subset) | Word error rate and product-term accuracy | informational; feeds the recommendation | | |
| Latency | Stop → ticket displayed | informational (target < 15 s) | | |

The overall result is the **worst** category reached by the invention, classification and usability rows; other rows adjust the conditions attached to a Conditional Go.

**Deliverable:** `docs/evaluation-report.md` with the results table, 3–5 representative before/after tickets, failure analysis, the recommendation (Go / Conditional Go / No-Go), and for Conditional Go the explicit conditions (e.g. "switch STT model", "tighten prompt rule X", "mandatory reviewer step").

### Phase 6: Jira connect (stretch, ~3 days; only after Phase 5)
- **Login:** `POST /api/jira/login` (`username`, `password`) → `JiraClient.CreateSession`, keep `JSESSIONID` in an encrypted HttpOnly SameSite=Strict cookie, discard the password. 403 + `X-Seraph-LoginReason: AUTHENTICATION_DENIED` → tell the user to log in once through the Jira UI (CAPTCHA). A Jira 401 clears the session and returns the user to the login step. This is not an app login: pages 1 and 2 stay anonymous.
- **Page 3 form:**
  - Board picker: `GET /rest/agile/1.0/board` (the board decides the project via `/board/{id}/project`).
  - Parent issue picker (optional): search via `/rest/api/2/search` (JQL on summary/key) in that project, with the allowed targets depending on the ticket type:
    - **Feature (Story):** pick an **Epic** → set via the Epic Link custom field (field id discovered from `GET /rest/api/2/field`, name "Epic Link").
    - **Bug:** pick a **Story** → Jira cannot make a Story the parent of a Bug, so the Bug is created and then connected with an **issue link** (`POST /rest/api/2/issueLink`, link type configurable, default "Relates"). Bug as a sub-task is not used.
  - Issue type: `IssueTypeMap`: Bug → **Bug**, Feature → **Story**.
- **Create:** `POST /api/jira/issues` builds the payload: summary = Title; description = the same Jira wiki markup as the preview (all contract sections including Missing information); Epic Link for a Story, a follow-up issue link for a Bug (if the link call fails after the create succeeded, return the key with a warning rather than retry). `X-Atlassian-Token: no-check`; **no retry on the create POST** (non-idempotent); Jira `errors` map returned to the form. Returns `{key, url}`.
- Polly on Jira GETs only. Log every creation (user, key).

### Phase 7: demo and documentation (~1 day)
- Error UX: microphone denied, WhisperLive down/`WAIT`, Claude error/refusal, expired Jira session.
- README: prerequisites, `docker compose up`, config, known limits, demo script, link to the evaluation report.

### Out of scope (confirmed in CLAUDE.md; list in README as production follow-ups)
Production auth/SSO, persistent history or database, observability/scalability/hardening, offline transcription, attachments, screenshots, duplicate detection, analytics, enterprise templates, polished design system, mobile/desktop packaging.

## Testing and verification
Commands: `dotnet build`, `dotnet test`, `dotnet test --filter "FullyQualifiedName~X"`, `dotnet run --project src/VoiceToJira.Api/VoiceToJira.Api.csproj`.
- **Unit:** `SegmentMerger` (re-sent, tentative→completed, out-of-order, final flush); contract validator (type/object consistency, missing fields); wiki-markup renderer; Jira payload builder; Jira error mapping; prompt/schema snapshot.
- **Integration:** relay vs an in-process fake WhisperLive WebSocket (handshake, audio, deltas, stop/final); `ClaudeTicketGenerator` against a stub handler (refusal, `max_tokens`, malformed JSON); `JiraClient` against a stub handler (cookie forwarding, 401, no retry on POST).
- **Frontend:** Vitest for the resampler (48 kHz sine → 16 kHz, correct length) and for the page-2 `Not provided` highlighting.
- **Audio save:** handler test for the file name (fake `TimeProvider`) and path.
- **Evaluation:** optional Phase 5 (real API, excluded from the default run unless a key is present).
- **Manual end to end** on the laptop: `docker compose up`, dictate one bug and one feature in English, one in Ukrainian; stop, edit the textarea, generate, check gaps, edit a field, copy the preview, save JSON; with Phase 6, log in, pick a board and parent, create, open the link.

## Resolved decisions (2026-11-04)
1. Endpoints use Minimal APIs with `TypedResults`; `ActionResult<T>` is not used.
2. Mocking library: **Moq** (not NSubstitute).
3. CLAUDE.md run command fixed to `src/VoiceToJira.Api/VoiceToJira.Api.csproj`.
4. Parent issue: Story → Epic Link; Bug → issue link to a Story (link type configurable, default "Relates").
5. Feature maps to the **Story** issue type.
6. Evaluation thresholds accepted. Audio samples come from a `Save audio` button on Page 1 (mp3, `audio/`, git-ignored).
7. Phase order confirmed (Jira after evaluation). Evaluation is optional with 6 scenarios.

## Remaining open points
- Jira link-type name for "Bug relates to Story" in your Jira (assumed "Relates"); the Epic Link field id is discovered automatically.
- Who writes the 6 scenario transcripts (only needed if Phase 5 is run).
