# P3 — Transcription busy limit (`stt_busy`)

- **Milestone:** M9
- **Status:** todo
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

- [ ] Per language: at most one call to Speaches at a time; up to `Stt:MaxWaiting` (configurable, positive, validated on start) requests wait; the next one gets 503 `stt_busy` with ProblemDetails, without calling Speaches.
- [ ] Time spent waiting does not count toward `Stt:Languages:*:TimeoutSeconds`; a waiting request whose caller cancels leaves the list.
- [ ] English and Ukrainian limits are independent.
- [ ] The web shows a "busy, try again in a minute" message in the UI language; the recording is kept so the user can retry.
- [ ] Tests with a fake speech-to-text cover: busy at the limit, waiting does not use the timeout, cancel while waiting, independent languages.
- [ ] `node scripts/check.mjs` passes.

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
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
