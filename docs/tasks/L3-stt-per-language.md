# L3 — Speech-to-text per language

- **Milestone:** M8
- **Status:** done
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
1. Tests first: `SpeachesClientTests` (language picks model/language/timeout; unknown code is 400; options validation: `en` required, bad codes, legacy config), `TranscribeEndpointTests` (`language` field passed on, empty means `en`, unconfigured is 400 with no STT call, log line has the code), an `Stt` test for Ukrainian (skips without the flag or a fixture), `api.test.ts` and `useRecorder.test.tsx` (language sent).
2. `SttOptions`: new `Languages` map (`SttLanguageOptions { Model, TimeoutSeconds }`) plus `Resolve(code)`; `Model`/`Language`/`TimeoutSeconds` stay as the legacy English entry when `Languages` is empty.
3. `ISpeechToText.TranscribeAsync` gets `string? language = null` after the token (human decision: edit `FakeStt` in `tests/VoiceToTicket.Evaluation/AudioTests.cs`, outside the file list). `SpeachesClient` sends the entry's model and language and uses its timeout. The endpoint reads the form field, checks it before any STT call, and logs the code.
4. `appsettings.json` gets `Stt:Languages` (`en`, `uk`); compose preloads both models; README STT section.
5. Web: `transcribeAudio(..., language)` sends the form field; `useRecorder` passes `useLanguage().language` (read through a ref).
6. ⚠ VERIFY: the Speaches id for large-v3 and its size/RAM/speed.

### Decisions
- 2026-11-20 (human, asked at the start): the interface change goes through an optional `language` parameter on `ISpeechToText`, with a one-line edit to `FakeStt` in `AudioTests.cs`.
- 2026-11-20: ⚠ VERIFIED the large-v3 id by running it: `Systran/faster-whisper-large-v3` (the Hugging Face repo; its `model.bin` is about 3.09 GB per the repo listing). The Speaches log printed "Successfully downloaded model: Systran/faster-whisper-large-v3" and the model transcribed. Sources: huggingface.co/Systran/faster-whisper-large-v3 and the container log.
- Config shape: `Stt:Languages` is a map; `SttOptions.Resolve(code)` returns the entry (empty code means `en`; an exact lower-case match; legacy `Model`/`TimeoutSeconds` act as the only `en` entry when the map is empty). `appsettings.json` now holds the `Languages` map and no longer the top-level `Model`/`Language`/`TimeoutSeconds` (the class defaults are the same values, and the Evaluation project still reads them).
- The endpoint passes the normalised code (never null) to `ISpeechToText`; `SpeachesClient` also rejects an unconfigured code with 400 `validation`, so a caller other than the endpoint cannot reach the server with one. The endpoint's check runs before the audio checks.
- `TranscribeForm` (OpenAPI doc record) gained `Language`. The web sends the language selected when the upload starts (a retry uses the language selected at retry time). The `language` state in `ReportPage` (translation, L7) is untouched.
- Edits outside the file list: `tests/VoiceToTicket.Evaluation/AudioTests.cs` (one parameter on `FakeStt`), approved by the human before starting.
- README: prerequisites, limits, configuration table, STT section (models, RAM, fallbacks), endpoint and upload text.

### Verified
- `node scripts/check.mjs`: build, test, npm build, npm test, lint all PASS.
- `dotnet build`: 0 warnings, 0 errors.
- `dotnet test`: 830 passed, 10 skipped (live/Stt categories, incl. the new Ukrainian test), 0 failed.
- `npm test` (web): 417 passed; `npm run lint`: clean.
- `VTT_RUN_STT=1 dotnet test --filter "Category=Stt"` with the recreated container: the 2 English smoke tests pass through the new config; the Ukrainian test skips (no recording).
- Real container (`docker compose up -d stt`, recreated with both models): healthy after 188 s; large-v3 6.8 s and medium.en 4.0 s for a 10 s English fixture (warm); container memory 4.5 GB with both loaded; volume 4.3 GB.

### Not verified
- Ukrainian transcription quality and speed: there is no Ukrainian recording in `tests/fixtures/audio/`. The new Stt test skips until a `uk-*.wav` is added; the human's manual check (record in Ukrainian) covers it and feeds the gate in L9.
- GPU compose file (unchanged, still untested).
### Reviews
- Round 1: APPROVE. 1 minor (log counted 9 skipped, run shows 10; check.mjs result missing from the log): fixed.
### Human check
- 2026-11-20: the human recorded in Ukrainian with `docker compose up --build`: works well, speed ok. Real-world speed to be seen after deployment.

### Notes for the study
- The agent asked one scope question first (the interface change touches a fake outside the file list) and got a one-line answer; no other human correction was needed.
- A shell-quoting failure on a long inline script cost one round; scripts moved to files in the scratchpad.
- The web search could not confirm the Speaches model id; running the container did. The reviewer APPROVED in round 1 with one bookkeeping minor (skip count, missing check result).
- Ukrainian quality had no automated check (no recording); only the human's manual check covers it.
