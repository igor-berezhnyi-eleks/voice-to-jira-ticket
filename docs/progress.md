# Progress

The plan is in [development-plan.md](development-plan.md). Tick items off as they land, and add a dated line to the log.

## Status

| Phase | Status |
|---|---|
| Planning | Done (2026-11-03) |
| Prerequisites | Not started |
| 1. Skeleton | Not started (next up) |
| 2. Live transcription | Not started |
| 3. Jira login and metadata | Not started |
| 4. Claude ticket drafting | Not started |
| 5. Review form and creation | Not started |
| 6. Hardening and demo | Not started |

## Prerequisites
- [ ] Anthropic API key available (user-secrets / `.env`)
- [ ] Company data-policy approval for sending transcripts to the Anthropic API
- [ ] Jira sandbox project to test against
- [ ] Company CA certificate, if Jira uses one

## Phase 1: skeleton
- [ ] Solution and `src/VoiceToJira.Api` project (health endpoint, `IExceptionHandler` → ProblemDetails, options validated on start)
- [ ] Config sections: `WhisperLive`, `Claude`, `Jira`, `Transcripts`
- [ ] `web/` Vite + React + TS app, with the dev proxy for `/api` and `/ws`
- [ ] `tests/VoiceToJira.Api.Tests` project
- [ ] Multi-stage Dockerfile (node build → dotnet publish; the API serves the SPA)
- [ ] `docker-compose.yml`: `whisperlive-cpu` with `large-v3-turbo` in a models volume, `-fw`, `--omp_num_threads 4`, `--max_clients 4`, `--max_connection_time 900`

## Phase 2: live transcription
- [ ] AudioWorklet: downmix + resample to 16 kHz float32, ~100 ms chunks
- [ ] Recorder: getUserMedia + WebSocket + start/stop control frames
- [ ] `/ws/transcribe` relay to WhisperLive (two pump loops, one CTS)
- [ ] `SegmentMerger` + unit tests
- [ ] Stop flow: END_OF_AUDIO, final flush, `TranscriptStore`
- [ ] TranscriptView: confirmed (normal) and tentative (grey) text; language selector

## Phase 3: Jira login and metadata
- [ ] Session login (`/rest/auth/1/session`), app cookie holding JSESSIONID, password discarded
- [ ] Delegating handler forwards the session; a 401 logs the user out
- [ ] Projects, createmeta (7.x form), and assignable-users endpoints
- [ ] Polly on GETs only

## Phase 4: Claude ticket drafting
- [ ] `POST /api/drafts`, with a per-project JSON schema (enums from createmeta)
- [ ] Prompt: wiki markup, no invented facts, open questions, output language
- [ ] StopReason handling, refusal fallback if the C# SDK supports it, FluentValidation

## Phase 5: review form and creation
- [ ] DraftReviewForm (editable fields, warnings for unsupported required fields)
- [ ] `POST /api/tickets` → `JiraIssueBuilder` → create → issue key and link
- [ ] Jira field errors mapped back to the form

## Phase 6: hardening and demo
- [ ] Error UX: microphone denied, WhisperLive down/WAIT, Claude errors, expired Jira session
- [ ] README: setup, config, known limits, demo script
- [ ] Manual end-to-end run (EN + UK, two concurrent browsers)

## Log
- 2026-11-03: Plan approved. WhisperLive mode fixed to CPU image + `large-v3-turbo` (no benchmarking phase). Jira auth uses each user's own login (session cookie). Claude is reached with an Anthropic API key via a single structured-output call.
