# P3 — Transcription busy limit (`stt_busy`)

- **Milestone:** M9
- **Status:** done
- **Depends on:** P0 approved; the waiting-list size is confirmed from P2 (default 2 until then)
- **Plan sections:** `docs/deployment-plan.md` 2 (D24), 5
- **Parallel-safe with:** P1, P2

## Goal

When several people transcribe at once, the API runs one transcription per language at a time, keeps a short waiting list, and answers 503 `stt_busy` immediately when the list is full, instead of letting requests time out after minutes.

## Files

- `src/VoiceToTicket.Api/Features/Transcriptions/**`
- `src/VoiceToTicket.Api/Infrastructure/ErrorCodes.cs`
- `web/src/**` only where error codes are turned into messages, and the en and uk dictionaries
- `tests/VoiceToTicket.Api.Tests/Transcriptions/**`, the matching web tests
- `README.md` (error table, `Stt:MaxWaiting`), `docs/tasks/P3-*.md`, `docs/status.md`

## Out of scope

- A job queue with positions or polling.
- Limits on ticket generation, translation or Jira.
- Changes to Speaches settings (P1).

## Acceptance criteria

- [x] Per language: at most one call to Speaches at a time; up to `Stt:MaxWaiting` (configurable, positive, validated on start) requests wait; the next one gets 503 `stt_busy` with ProblemDetails, without calling Speaches.
- [x] Time spent waiting does not count toward `Stt:Languages:*:TimeoutSeconds`; a waiting request whose caller cancels leaves the list.
- [x] English and Ukrainian limits are independent.
- [x] The web shows a "busy, try again in a minute" message in the UI language; the recording is kept so the user can retry.
- [x] Tests with a fake speech-to-text cover: busy at the limit, waiting does not use the timeout, cancel while waiting, independent languages.
- [x] `node scripts/check.mjs` passes.

## Verification

```
dotnet build
dotnet test
node scripts/check.mjs
```

## Gate

None.

## Notes

- Use `SemaphoreSlim` plus a counter, or `System.Threading.RateLimiting.ConcurrencyLimiter` (part of .NET, no new package: ⚠ VERIFY), registered as a singleton per language.

## Log

### Plan

1. `Features/Transcriptions/TranscriptionGate.cs` (new): one `System.Threading.RateLimiting.ConcurrencyLimiter` per configured language (permit 1, queue `Stt:MaxWaiting`, oldest first), built once at start; a failed lease throws `ApiException` 503 `stt_busy`.
2. `SttOptions.MaxWaiting` (default 2, must be positive; part of `IsValid`, already `ValidateOnStart`). `ErrorCodes.SttBusy`.
3. `TranscribeEndpoint` takes the gate after the form is validated and before `ISpeechToText`; the Speaches timeout starts inside `SpeachesClient`, so waiting does not count. `Program.cs`: one line `AddSingleton<TranscriptionGate>()` (outside the file list; approved by the human 2026-11-23).
4. Tests first: `TranscriptionGateTests` (busy at the limit, cancel while waiting frees the place, independent languages, options validation) and endpoint tests with a blocking fake STT (503 `stt_busy` ProblemDetails without calling STT; real `SpeachesClient` with a short timeout shows waiting is not counted).
5. Web: `stt_busy` → `t.sttBusy` (en, uk) in `useRecorder.ts`; Try again stays; test row in `useRecorder.test.tsx`.
6. README: error table row and `Stt__MaxWaiting` setting.
7. ⚠ VERIFY: `ConcurrencyLimiter` ships in the shared framework (no package) and its queue/cancel behaviour.
### Decisions

- ⚠ VERIFY `ConcurrencyLimiter`: `System.Threading.RateLimiting.dll` ships in the shared framework `Microsoft.AspNetCore.App` (checked in `C:\Program Files\dotnet\shared\Microsoft.AspNetCore.App\10.0.15\` and 10.0.12, 2026-11-23); no package added. Its behaviour was checked by tests, not recalled: with `QueueLimit` reached and `OldestFirst`, `AcquireAsync` returns a not-acquired lease at once; a cancelled waiter throws `OperationCanceledException` and its place is freed (`GetStatistics().CurrentQueuedCount` drops to 0 and a new request takes the place).
- `Program.cs` gets one line, `AddSingleton<TranscriptionGate>()`. It is outside the file list; the human approved it (2026-11-23).
- The gate sits in the endpoint, after the form is validated and before `ISpeechToText`: the Speaches timeout is created inside `SpeachesClient.TranscribeAsync`, so waiting is never counted, and tests with a fake `ISpeechToText` still go through the gate. Limiters are built once from the configured languages (`en` only when `Stt:Languages` is empty); other codes are rejected by the endpoint before the gate.
- `Stt:MaxWaiting` stays **2** (the default this task named). From P2: Ukrainian runs at about 0.8 s per second of audio, so a typical 1-minute report takes about 50 s and the third person in line waits under 2 minutes; the worst case (three 5-minute Ukrainian recordings) is about 12 minutes for the last one, without a timeout now. English is about three times faster. No setting is added to `docker-compose.prod.yml` (not in this task's files); the default applies on the VM.
- No `Retry-After` header: `ApiException` has no way to set headers, and the web shows its own message.
### Verified

- `dotnet build`: 0 warnings, 0 errors.
- `dotnet test`: Api.Tests 926 passed, 10 skipped (the Stt/Live/Evaluation-flagged ones); Evaluation 78 passed, 1 skipped.
- New tests: `TranscriptionGateTests` (busy at the limit, order, cancel while waiting, independent languages, legacy options, `MaxWaiting` validation and default) and three in `TranscribeEndpointTests` (503 `stt_busy` ProblemDetails without calling STT; busy English does not block Ukrainian; the real `SpeachesClient` with a 2 s timeout serves two 1.2 s requests, so 2.4 s of wait plus work passes). With the gate bypassed by hand, all three endpoint tests failed; restored. The two test classes passed 5 runs in a row.
- Web: `useRecorder.test.tsx` 37 passed (new `stt_busy` row; Ukrainian message with Try again and the recording kept).
- After review: `TranscribeEndpointTests` 36 passed (3 runs in a row).
- `node scripts/check.mjs`: dotnet build, dotnet test, npm build, npm test, npm lint all PASS.
- Human, 2026-11-23: deployed `c649abe` to the VM and ran the manual check from the handover (agent did not see the run): "everything works as expected".

### Not verified

- `Time_spent_waiting_does_not_count_toward_the_timeout` relies on wall-clock time (1.2 s work against a 2 s timeout); a heavily loaded machine could fail it without a bug.

### Reviews

- 2026-11-23, round 1: APPROVE; 0 blocker, 0 major, 3 minor (Program.cs line outside the list, human-approved; cancel tested only on the gate, so an endpoint test was added: `A_request_cancelled_while_waiting_leaves_the_list`, 3 runs passed; the wait-not-timed test uses wall-clock timing with 0.8 s margin, kept and noted).
### Notes for the study

- The one stop-and-ask was the `Program.cs` registration line outside the file list; the human approved it at once. The task's own Notes ("registered as a singleton") had already implied it, so the file list was slightly too narrow.
- The reviewer approved in round 1 with 3 minors; the useful one (cancel only tested on the gate, not through HTTP) led to one more endpoint test.
- Harness: the Stop gate and `check.mjs` stayed green; nothing caught a Python escape (`\10` became a backspace) in the task log, which the agent found when an Edit failed to match. Waiting-list size 2 was kept from the task default, reasoned from P2 numbers, and confirmed by the human's VM check.
