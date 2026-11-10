# Progress

The plan is in [development-plan.md](development-plan.md) (rev. 2, aligned with CLAUDE.md). Tick items off as they land, and add a dated line to the log.

## Status

| Phase | Status |
|---|---|
| Planning | Done (rev. 1 2026-11-03; rev. 2 2026-11-04, awaiting approval) |
| Prerequisites | Not started |
| 1. Skeleton | Not started (next up) |
| 2. Page 1: voice → editable transcript | Not started |
| 3. Ticket generation (one Claude call) | Not started |
| 4. Page 2: review, preview, copy, JSON (committed scope done) | Not started |
| 5. Evaluation and Go / Conditional Go / No-Go (OPTIONAL) | Not started |
| 6. Jira connect (stretch) | Not started |
| 7. Demo and documentation | Not started |

## Prerequisites
- [ ] Anthropic API key available (user-secrets / `.env`)
- [ ] Company data-policy approval for sending transcripts to the Anthropic API
- [ ] (Optional, Phase 5) 6 evaluation scenarios authored before prompt tuning; thresholds already agreed
- [ ] Jira sandbox project (Phase 6); company CA certificate if needed
- [x] Open questions answered (2026-11-04); remaining: Jira link-type name for Bug → Story

## Phase 1: skeleton
- [ ] Solution: Domain / Application / Infrastructure / Api + tests; MediatR, FluentValidation, Mapster, Polly wired
- [ ] OpenAPI + Swagger, health endpoint, `IExceptionHandler` → ProblemDetails, options validated on start
- [ ] Config sections: `WhisperLive`, `Claude`, `Jira`
- [ ] `web/` Vite + React + TS app, dev proxy for `/api` and `/ws`
- [ ] Multi-stage Dockerfile (API serves the SPA)
- [ ] `docker-compose.yml`: `whisperlive-cpu`, `large-v3-turbo` in a models volume, `-fw`, `--omp_num_threads 4`, `--max_clients 4`, `--max_connection_time 900`

## Phase 2: Page 1, voice → one editable transcript field
- [ ] AudioWorklet (downmix + resample to 16 kHz f32, ~100 ms chunks) and Recorder
- [ ] `/ws/transcribe` relay to WhisperLive (anonymous, two pump loops, one CTS)
- [ ] `SegmentMerger` + unit tests
- [ ] Stop flow: END_OF_AUDIO, final flush
- [ ] Single editable textarea (confirmed text appended, tentative greyed), language selector, typing/pasting works
- [ ] `Save audio` button: mp3 encoded in browser → `POST /api/audio` → `audio/yyyyMMdd_HHmmss_record.mp3` (folder bind-mounted, in `.gitignore` already)

## Phase 3: ticket generation
- [ ] Domain contract: Bug and Feature tickets, Missing information
- [ ] `POST /api/tickets/generate` → MediatR handler → Claude (one call, JSON schema, classification included)
- [ ] Prompt with anti-invention rules (`Not provided` + Missing information entry)
- [ ] StopReason handling, FluentValidation of request and output, Polly on the Claude client
- [ ] Unit/integration tests incl. "absent detail → Not provided" regression

## Phase 4: Page 2, review, preview, copy, JSON
- [ ] Type-aware form, all fields editable
- [ ] `Not provided` highlighting and Missing information list
- [ ] Jira wiki-markup preview + Copy to clipboard
- [ ] Save as JSON
- [ ] `Connect to Jira board` button present (wired in Phase 6)

## Phase 5: evaluation and recommendation (OPTIONAL)
- [ ] Dataset: 6 scenarios (2 bug, 2 feature, 2 edge) with facts, expected missing info, traps
- [ ] Audio recordings of the scenarios (made with Save audio) for the full path
- [ ] Runner `tests/VoiceToJira.Evaluation` (`Category=Evaluation`), results to `eval/results/`
- [ ] Human scoring: invention, usability, time saved
- [ ] `docs/evaluation-report.md` with recommendation and conditions

## Phase 6: Jira connect (stretch)
- [ ] `/api/jira/login` (session cookie, password discarded), 401 handling
- [ ] Board list, parent search (Feature → Epic Link; Bug → issue link to a Story), type map Bug→Bug, Feature→Story
- [ ] `POST /api/jira/issues` (wiki-markup description, Epic Link, no retry on POST), Jira field errors mapped to the form
- [ ] Page 3 form

## Phase 7: demo and documentation
- [ ] Error UX: microphone denied, WhisperLive down/WAIT, Claude errors, expired Jira session
- [ ] README: setup, config, known limits, demo script, link to the evaluation report
- [ ] Manual end-to-end run (EN + UK)

## Log
- 2026-11-03: Plan approved (rev. 1). WhisperLive mode fixed to CPU image + `large-v3-turbo` (no benchmarking phase). Jira auth uses each user's own login (session cookie). Claude is reached with an Anthropic API key via a single structured-output call.
- 2026-11-04: CLAUDE.md gained scope, workflow and output contract. Plan revised (rev. 2): single-ticket Bug/Feature contract, 3-page flow, layered VSA + MediatR, no persistence or app auth, evaluation phase added, Jira integration moved to stretch. Seven open questions listed at the end of the plan.
- 2026-11-04: Open questions answered: TypedResults, Moq, Story for features, Epic Link for Story / issue link to Story for Bug. Phase 5 made optional with 6 scenarios. Added `Save audio` (mp3) to Page 1. `audio/` added to `.gitignore`; CLAUDE.md run path and test library (Moq) fixed.
