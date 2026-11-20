# L6 — Translation endpoint

- **Milestone:** M8
- **Status:** done
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

- Tests first in `tests/VoiceToTicket.Api.Tests/Translations/`: prompt wrapping, translator (request shape, parser, every llm_* mapping, no retry, no text in logs), endpoint (validation, shape, same language, pair rule via a stub translator, startup without a key).
- New in `Features/Translations/`: `TranslationOptions` (+ validator that checks `Claude:ApiKey` when `Translation:Provider=Claude`), `TranslationPrompt`, `TranslationResponseParser`, `ITranslator`, `ClaudeTranslator` (reuses `IClaudeMessages` unchanged), `FakeTranslator`, `TranslateEndpoint` (applies the pair rule and the same-language rule, so both providers get them), registration extension.
- `ITranslator` returns `{ from, text, model }`; the endpoint times the call and builds the response. `to` is valid when `Stt:Languages` configures it (the same list as the selector; no second list).
- Edits: `Program.cs`, `appsettings.json` (`Translation` section, Provider Fake, model `claude-haiku-5-5`), `ErrorCodes.cs`, `ApiFactory.cs` (pin `Translation:Provider=Fake` so user-secrets cannot leak in), plan 4.4 row. `appsettings.Development.json` needs no change.
- ⚠ VERIFY: Haiku 5.5 id and request shape, from the `claude-api` skill table; one live call (human go-ahead) confirms.
### Decisions

- Translation reuses `IClaudeMessages`/`AnthropicMessages` unchanged, so the key and the SDK client timeout come from `Claude:*`; `Translation:TimeoutSeconds` must therefore not exceed `Claude:TimeoutSeconds` (startup check).
- `to` is valid when `Stt:Languages` configures it (one list for the selector). Empty `to` is 400, not English.
- Same language on both sides (also non-English) returns the text as sent; the pair rule applies only when the languages differ.
- Model `claude-haiku-5-5`, effort `low`; ⚠ VERIFY source: claude-api skill model table (cached 2026-11-03). Haiku gets no refusal fallback (as in tickets). No new dependency.
- `ApiFactory` pins `Translation:Provider=Fake` (listed as conditional in the file list).
- `FakeTranslator` prefixes `[target] ` so offline demos show a change.
### Verified

- `dotnet build`: succeeded, 0 warnings. `dotnet test`: Api.Tests 915 passed, 0 failed, 10 skipped (live/Stt/Jira live); 85 new tests in `Translations/`; Evaluation 57 passed, 1 skipped. `node scripts/check.mjs`: all checks passed.
- Earlier lock by the human's dev API (PID 50728) was cleared by the human; nothing killed.
### Not verified

- Live check skipped by the human (2026-11-20, "Let's skip the live check then"). The human first tried the Translate button on Page 1; it is the L7 placeholder with no handler, so it could not exercise the endpoint.
- The live call (uk to en, en to uk with the real Haiku 5.5): no live test written yet and it needs the human's go-ahead. The id `claude-haiku-5-5` is taken from the claude-api skill table (cached 2026-11-03) and the session's model list, not from a call.
- `AnthropicMessages` (the SDK side) is only exercised live; unchanged by L6.
### Reviews

- 2026-11-20, round 1: APPROVE. 0 blocker, 0 major, 1 minor (status.md Current line contradicted itself; fixed).
### Notes for the study

- Built test-first in one pass; 85 new tests green after one test-helper compile fix. The first build was blocked by the human's running dev API (PID 50728); the agent asked instead of killing it, and the Stop gate failed once for the same reason.
- Reviewer APPROVE in round 1; its one minor was a self-contradicting status line the agent wrote.
- The human's live check failed because the Translate button is an L7 placeholder: the agent had offered a live check without saying the UI was not wired. The harness could not catch this.
