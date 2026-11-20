# L6 — Translation endpoint

- **Milestone:** M8
- **Status:** todo
- **Depends on:** L0 approved; run after L3 if both are open (same `Program.cs`/appsettings)
- **Plan sections:** `docs/language-plan.md` 2 (D20), 6; implementation-plan 4.4, 4.6 (error mapping)
- **Parallel-safe with:** L1, L2, L5, L8

## Goal

`POST /api/translations` translates the report text to or from English with one Claude call, with a fake for offline work.

## Files

- `src/VoiceToTicket.Api/Features/Translations/**` (new: endpoint, `ITranslator`, `ClaudeTranslator`, `FakeTranslator`, `TranslationPrompt`, `TranslationOptions`, response parser)
- `src/VoiceToTicket.Api/Program.cs`, `appsettings.json`, `appsettings.Development.json`
- `src/VoiceToTicket.Api/Infrastructure/ErrorCodes.cs` (`translation_pair_unsupported`)
- `src/VoiceToTicket.Api/Features/Tickets/Claude/IClaudeMessages.cs`, `AnthropicMessages.cs` only if they need to become shared (no behaviour change for tickets)
- `tests/VoiceToTicket.Api.Tests/Translations/**`, `ApiFactory.cs` only if settings leak
- `docs/implementation-plan.md` 4.4 (new row), `docs/tasks/L6-*.md`, `docs/status.md`

## Out of scope

- The web buttons (L7). Retries. Streaming. Translating the generated ticket.

## Acceptance criteria

- [ ] Request `{ text, to }`: `text` 1–20,000 characters, `to` a configured language, otherwise 400 `validation`. Response `{ text, from, to, model, durationMs }`.
- [ ] Neither `from` nor `to` is `en` → 422 `translation_pair_unsupported`. Same language → text returned unchanged.
- [ ] `ClaudeTranslator`: structured output `{ from, text }`, its own stable system prompt, text wrapped in `<text>` tags with the closing tag escaped (as `TicketPrompt` does), no `temperature`/`top_p`. Refusal, truncation, timeout, unavailable and invalid output map to the existing `llm_*` codes. No retry.
- [ ] `Translation:Provider` is `Fake` or `Claude`; startup fails if `Claude` is chosen without a key. The model id is ⚠ VERIFIED (load the `claude-api` skill) and recorded.
- [ ] Logs carry lengths, languages and duration only, never text.
- [ ] Tests with a fake `IClaudeMessages`: request shape, prompt wrapping, every error mapping, the pair rule, validation.
- [ ] `node scripts/check.mjs` passes.

## Verification

```
dotnet build
dotnet test
node scripts/check.mjs
```

Live (`VTT_RUN_LIVE=1`, `[Trait("Category","Live")]`, only with the human's go-ahead): one uk→en and one en→uk call on short texts written for this check, with numbers and a product name kept.

## Gate

None. The human reads `TranslationPrompt` at hand-over.

## Log

### Plan
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
