# Voice → Jira Ticket PoC: development plan

## Context

A proof of concept web app for 1–2 people at a time. It records speech in English, and sometimes Ukrainian, in the browser and transcribes it live with WhisperLive. On stop, Claude turns the rambling transcript into structured ticket drafts. The user reviews and edits the drafts, then the app creates the issues in the company's **Jira Server 7.8.1**. If the PoC is approved, a team will turn it into a company tool, so the code should be easy to extend. It should not be over-built now.

The repo is empty (only `.gitignore`), so everything below is new code.

**Decisions made**
- Stack: **ASP.NET Core (.NET 10)** backend plus a **React + Vite + TypeScript** SPA. The API serves the built SPA, so there is one origin, no CORS, and the auth cookie also works on the WebSocket upgrade.
- Jira auth: **each user's own login**. Jira 7.8 has no Personal Access Tokens (they arrived in 8.14). The backend calls `POST /rest/auth/1/session` once with the user's username and password. It keeps only the returned `JSESSIONID` and **throws the password away**.
- Jira integration: **REST API v2 directly, without MCP**. Atlassian's MCP server is Cloud-only, and community MCP servers aren't verified against 7.8. With MCP, the deterministic "create issue" call would also go through an LLM for no gain.
- Claude: **Anthropic API key** and the official `Anthropic` NuGet SDK. The Messages API makes **one call with structured outputs** (`OutputConfig.Format = JsonOutputFormat`). There's no agent or Managed Agents: this is a single extraction step, so an agent adds cost and latency without benefit. Model: `claude-opus-5-5` with low/medium `Effort`. The model is set in configuration, so a cheaper model can be evaluated later.
- C# conventions follow `C:\Projects\AGENTS.md`: file-scoped namespaces, primary constructors, `ILogger<T>`, `IOptions<T>`, injected `TimeProvider`, `IHttpClientFactory`, `CancellationToken` everywhere, `IExceptionHandler`, `ActionResult<T>`, FluentValidation, Polly, and xUnit/NSubstitute/FluentAssertions.
- **Not adopted for the PoC:** the GearFlow-specific layering (4-project Clean Architecture, MediatR, EF Core/Postgres). There's no database, and one API project with feature folders is enough. The split can happen when the team takes it over.

## Architecture

```
Browser (React)                     Backend (ASP.NET Core)                 WhisperLive (Docker)
 mic → AudioWorklet (16 kHz mono f32) ─ws /ws/transcribe─► TranscriptionRelay ─ws─► :9090 (one shared model)
 transcript view ◄─ {confirmed[], tentative} ───────────── SegmentMerger ◄──── segments{start,end,text,completed}
 "Stop" ──────────────────────────────────────────────────► END_OF_AUDIO → final transcript kept in session
 review form ◄── POST /api/drafts ──────────────────────── TicketDraftService ──► Claude Messages API (JSON schema)
 "Create" ────── POST /api/tickets ────────────────────── JiraClient ──────────► Jira 7.8.1 REST v2
```

### WhisperLive wire protocol (verified against `whisper_live/client.py`, pin the version)
- First text frame from the client: JSON with `uid`, `language` (null means auto), `task:"transcribe"`, `model`, `use_vad:true`, `send_last_n_segments`, `no_speech_thresh`, `same_output_threshold`, `initial_prompt`, `hotwords`.
- Audio: binary frames of little-endian **float32 PCM, mono, 16 kHz, in [-1, 1]**.
- The server sends `{"message":"SERVER_READY","backend":...}`, `{"status":"WAIT"|"ERROR"|"WARNING","message":...}`, `{"language","language_prob"}`, `{"segments":[{start,end,text,completed}]}`, and `{"message":"DISCONNECT"}`. Each message carries the `uid`.
- End of audio: the bytes `END_OF_AUDIO` sent as a **binary** frame.
- Segments are re-sent (the last N each time), so they must be **merged by `start`**. `completed:true` means confirmed. The last non-completed segment is the tentative one.

## WhisperLive on this laptop (Core Ultra 7 258V, Xe2 iGPU, 32 GB)

**Chosen: `ghcr.io/collabora/whisperlive-cpu` (faster_whisper backend, CPU, int8) with the `large-v3-turbo` multilingual model**, `--omp_num_threads 4`. No benchmarking phase. (Docker Desktop on Windows runs containers in WSL2, which has no `/dev/dri`, so the OpenVINO GPU image isn't used.)

- **Shared model loaded once:** WhisperLive shares a model across clients only when a custom model path is passed with `-fw`. Otherwise it loads one model per client. On first start, convert or download `large-v3-turbo` to CTranslate2 into a `models` volume and start the server with `-fw /models/large-v3-turbo`. Set `--max_clients 4` and `--max_connection_time 900`.
- **Known risk:** turbo on an 8-core laptop CPU may make the tentative text lag. If it does, it's a config-only change (`WhisperLive:Model` and compose args) to `medium`. The WhisperLive URL, model and language are configuration only, so the later move to a GPU server (`whisperlive-gpu`) also needs no code change.

## Repository layout

```
docker-compose.yml            whisperlive + api (api serves the SPA); models volume; data volume
src/VoiceToJira.Api/          .NET 10 Web API (Dockerfile, multi-stage: node build → dotnet publish)
  Features/Auth/              AuthController (login/logout/me), Jira session cookie handling
  Features/Transcription/     TranscriptionRelay (WS endpoint), SegmentMerger, TranscriptStore
  Features/Drafts/            DraftsController, TicketDraftService, prompt + JSON schema, validators
  Features/Tickets/           TicketsController, JiraIssueBuilder
  Infrastructure/Jira/        JiraClient (typed HttpClient), JiraOptions
  Infrastructure/Claude/      ClaudeOptions, client registration
  Infrastructure/WhisperLive/ WhisperLiveOptions, protocol DTOs
web/                          React + Vite + TS (dev: Vite proxy /api,/ws → api)
  src/audio/pcm-worklet.ts    AudioWorkletProcessor: downmix + resample → 16 kHz f32, ~100 ms chunks
  src/audio/recorder.ts       getUserMedia + AudioContext + worklet + WebSocket
  src/components/             Login, Recorder, TranscriptView, DraftReviewForm, CreatedIssues
tests/VoiceToJira.Api.Tests/  xUnit + NSubstitute + FluentAssertions
README.md                     setup, config, demo script
```

## Phases

**Prerequisites (not a phase, done alongside Phase 1):**
- An Anthropic API key in user-secrets or `.env`.
- Company data-policy approval for sending transcripts to the Anthropic API.
- A Jira sandbox project to test against.
- If Jira uses the company CA, add that CA certificate to the API container.

### Phase 1: skeleton (~1 day)
- Solution, API project (health endpoint, `IExceptionHandler` → ProblemDetails, options binding with validation on start), Vite React app, Dockerfile, `docker-compose.yml`. The `whisperlive` service uses the CPU image, `large-v3-turbo` in the models volume, and the arguments above.
- Config sections:
  - `WhisperLive`: `Url`, `Model`, `DefaultLanguage`, `InitialPrompt`, `SendLastNSegments`.
  - `Claude`: `ApiKey`, `Model`, `Effort`, `MaxTokens`.
  - `Jira`: `BaseUrl`, `DefaultProjectKey`, `CaCertPath?`.
  - `Transcripts`: `SaveToDisk`, `Directory`.

### Phase 2: live transcription (~3 days)
- **Browser**:
  - `getUserMedia({audio:{channelCount:1, echoCancellation, noiseSuppression, autoGainControl}})` and an `AudioContext` at the native rate.
  - The worklet downmixes to mono, resamples to 16 kHz (low-pass, then linear interpolation), and posts ~1600-sample `Float32Array` chunks to the main thread.
  - The main thread sends the raw `ArrayBuffer` over the WebSocket.
  - Control text frames: `{type:"start", language:"auto"|"en"|"uk"}` and `{type:"stop"}`.
  - The microphone needs a secure context: localhost is fine; other machines need HTTPS.
- **Backend relay** (`/ws/transcribe`, requires auth):
  - Accept the browser socket and open a `ClientWebSocket` to WhisperLive. Send the options JSON with `uid = sessionId`.
  - Run two pump loops (browser → WL binary audio, WL → browser) linked by one `CancellationTokenSource`. Either side closing tears down both.
  - Pass `WAIT`/`ERROR` and the detected language through to the UI.
- **`SegmentMerger`** (backend-owned, unit-tested):
  - Keeps an ordered map of segments keyed by `start`, plus the tentative segment.
  - Sends the browser a delta: `{type:"transcript", confirmed:[new completed segments], tentative:"..."}`. The UI appends confirmed segments in normal text and replaces the grey tentative line. The merge logic exists in one place only.
- **On stop**:
  - Send `END_OF_AUDIO`, then wait up to ~3 s for final segments or `DISCONNECT`.
  - Promote the remaining tentative segment to confirmed.
  - Store the final transcript in `TranscriptStore`: in-memory, keyed by sessionId and owner, with a TTL of 2 h. Optionally also save it to `data/transcripts/*.json` for later prompt tuning.
  - Send `{type:"final", sessionId, transcript}` and close.
- **Language selector**: Auto (default), English, Українська. Whisper detects the language **once** at the start. A session that switches languages mid-way works better with the language set explicitly. Document this.
- **`initial_prompt`/`hotwords`**: seed them with Jira project keys and team terms to improve recognition of product names.

### Phase 3: Jira login and metadata (~2 days)
- **`POST /api/auth/login`**:
  - `JiraClient.CreateSession(username, password)`. Keep the `JSESSIONID` cookie from Jira and drop the password.
  - Issue an app auth cookie (ASP.NET cookie auth: HttpOnly, SameSite=Strict). It carries the username and the Jira session id, encrypted with Data Protection; keys persist on a volume.
  - Map Jira failures to clear messages: 401; 403 with `X-Seraph-LoginReason: AUTHENTICATION_DENIED` means CAPTCHA, so tell the user to log in once through the Jira web UI.
- **Requests and session expiry**: each Jira call forwards the user's `JSESSIONID` through a delegating handler. A 401 from Jira clears the app session, and the UI shows the login form again.
- **Jira 7.8 API specifics**:
  - Use the 7.x createmeta form: `GET /rest/api/2/issue/createmeta?projectKeys=X&expand=projects.issuetypes.fields`. The per-issue-type endpoints only exist in 8.4+.
  - Send `X-Atlassian-Token: no-check` on POSTs.
- **Metadata endpoints**:
  - `GET /api/jira/projects`.
  - `GET /api/jira/projects/{key}/meta`: issue types, priorities, components, and **required fields**, from createmeta. Cache per user for 10 min.
  - `GET /api/jira/users?project=&q=`: `/user/assignable/search?username=`, the 7.x parameter.
- **Resilience**: Polly standard resilience handler (`Microsoft.Extensions.Http.Resilience`) on GETs. **No retry on the create POST**, because it isn't idempotent.

### Phase 4: Claude ticket drafting (~2 days)
- **`POST /api/drafts`** with `{sessionId, projectKey, transcriptOverride?, outputLanguage:"en"|"same"}`. The UI shows the transcript in editable form, and "Regenerate" sends the edited text.
- **`TicketDraftService`**:
  - `client.Messages.Create` with `Model`, `OutputConfig { Effort, Format = JsonOutputFormat { Schema } }` and a stable system prompt.
  - The user message holds the transcript plus the project metadata: allowed issue types, priorities, components.
  - Add the server-side refusal fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) if the C# SDK exposes it. Always check `StopReason` (`refusal`, `max_tokens`) before parsing.
- **JSON schema, built per project so the enums match Jira**:
  - `{ tickets: [ { summary (≤255), issueType (enum), priority (enum), components[] (enum), labels[], description, acceptanceCriteria[], openQuestions[] } ], detectedLanguage, notes }`.
  - Usually one ticket. Several only if the speaker clearly described separate pieces of work.
- **Prompt rules**:
  - Remove filler and repetition. Don't invent facts. Put anything unclear into `openQuestions`.
  - Write the description in **Jira wiki markup**: Server 7.x doesn't use the Cloud ADF format. Use `h3.`, `*`, `#`, `{code}`.
  - Write output in English by default, or in the spoken language when `outputLanguage:"same"`.
- Validate the result with FluentValidation (summary length, enum membership) before returning it to the UI.

### Phase 5: review form and creation (~2 days)
- **`DraftReviewForm`**:
  - One card per draft with editable fields: project, issue type, summary, description (textarea), priority, components, labels, assignee picker.
  - Acceptance criteria are appended to the description on submit.
  - Open questions are shown as hints.
  - Required custom fields that the PoC doesn't support (from createmeta) show a clear warning instead of a failed create.
- **`POST /api/tickets`**:
  - Validator, then `JiraIssueBuilder` (DTO → `{fields:{project:{key}, issuetype:{id}, summary, description, priority:{id}, components:[{id}], labels, assignee:{name}}}`), then `JiraClient.CreateIssue`.
  - Returns `{key, url: {BaseUrl}/browse/{key}}`.
  - Jira field errors (`errors` map) are passed back to the form fields.
  - The issue is created as the logged-in user. Reporter is set automatically.
- Log every creation (user, session, issue key) with `ILogger`.

### Phase 6: PoC hardening and demo (~1–2 days)
- **Error UX** for: microphone denied, WhisperLive down or `WAIT` (server full), Claude errors, Jira expired session.
- **README**: prerequisites, `docker compose up`, config, the chosen WhisperLive mode, known limits, and a demo script.
- **Optional**: HTTPS via a dev certificate so a colleague's browser can use the microphone.

### Out of scope (production follow-ups to list in the README)
- SSO or OAuth 1.0a application link instead of password login.
- Persistent storage and audit log.
- Horizontal scaling and a GPU server.
- Jira upgrade (PATs, new createmeta).
- Custom required fields and epics.
- Splitting into Clean Architecture and MediatR when the team takes over.

## Testing and verification

- **Unit tests** (xUnit/NSubstitute/FluentAssertions):
  - `SegmentMerger`: re-sent segments, tentative → completed, out-of-order, final flush.
  - JSON schema builder.
  - Draft validator.
  - `JiraIssueBuilder` payload.
  - Mapping Jira error responses to form errors.
- **Integration tests**:
  - Relay test with `WebApplicationFactory` and an in-process fake WhisperLive WebSocket server: checks handshake, audio forwarding, delta messages, and stop/final.
  - `JiraClient` tests against a stub `HttpMessageHandler`: session cookie forwarding, 401 handling, and no retry on POST.
- **Frontend**: a Vitest test of the resampler (a 48 kHz sine wave in gives a 16 kHz sine wave out, with correct length).
- **End to end, manual, on the laptop**:
  1. Run `docker compose up` and open `http://localhost:8080`.
  2. Log in with a Jira account.
  3. Dictate one English and one Ukrainian ticket. Confirm the grey tentative text turns into normal confirmed text.
  4. Stop, then check the draft fields against the project metadata.
  5. Edit, create, and open the returned Jira link in the sandbox project.
  6. Repeat with two browsers at once to confirm two users can work concurrently on the shared model.
