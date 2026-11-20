# L3 — Speech-to-text per language

- **Milestone:** M8
- **Status:** todo
- **Depends on:** L0 approved; L1 for the client part (if L1 is not done, the client part moves to L7)
- **Plan sections:** `docs/language-plan.md` 2 (D18), 4; implementation-plan 4.4, 4.5
- **Parallel-safe with:** L1, L2, L4, L8 (not L6: same `Program.cs`/appsettings)

## Goal

A recording made with Ukrainian selected is transcribed in Ukrainian by the large model. English works as before.

## Files

- `src/VoiceToTicket.Api/Features/Transcriptions/**`
- `src/VoiceToTicket.Api/appsettings.json`, `appsettings.Development.json`
- `docker-compose.yml`, `docker-compose.gpu.yml`
- `tests/VoiceToTicket.Api.Tests/Transcriptions/**`, `tests/VoiceToTicket.Api.Tests/ApiFactory.cs` (only if settings leak, as in J9)
- `web/src/api.ts` (transcribe sends `language`), `web/src/recording/useRecorder.ts` or `ReportPage.tsx` where the call is made, their tests
- `README.md` (STT section: models, RAM, first-start download)
- `docs/tasks/L3-*.md`, `docs/status.md`, `docs/language-plan.md` 4 (record the verified id and numbers)

## Out of scope

- Auto-detecting the spoken language. Streaming. Changing the English model.

## Acceptance criteria

- [ ] `Stt:Languages` maps codes to `{ Model, TimeoutSeconds }`. Startup fails without an `en` entry or with an invalid code. A config with only `Stt:Model`/`Language` still works (English only).
- [ ] `POST /api/transcriptions` accepts an optional `language` form field. Empty means `en`. An unconfigured code is 400 `validation` with no STT call.
- [ ] Speaches receives the entry's `model` and `language`; the per-language timeout applies (tests with a fake handler).
- [ ] The client sends the selected language.
- [ ] Compose preloads both models. The Speaches large-v3 id is ⚠ VERIFIED against current docs or the model registry and recorded in the log.
- [ ] The log line adds the language code; still no transcript text.
- [ ] `node scripts/check.mjs` passes.

## Verification

```
dotnet build
dotnet test
node scripts/check.mjs
```

Stt-category test (`VTT_RUN_STT=1`, needs Docker): a short Ukrainian WAV is transcribed into Cyrillic text. Record the duration, model size and RAM. If Docker is not available, mark it as not verified.

Manual check for the human: `docker compose up --build`, record in Ukrainian, judge quality and speed (feeds the gate in L9).

## Gate

None for the code. Quality is judged at "Ukrainian transcripts usable" (L9).

## Notes

- Fallbacks if quality or speed is bad: `large-v3-turbo`, then multilingual `medium`. This is a config change only.

## Log

### Plan
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
