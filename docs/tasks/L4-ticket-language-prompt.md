# L4 — Ticket language: contract, prompt, fake

- **Milestone:** M8
- **Status:** todo
- **Depends on:** L0 approved
- **Plan sections:** `docs/language-plan.md` 2 (D19), 5; implementation-plan 4.3, 4.6, 4.7
- **Parallel-safe with:** L1, L2, L8. **Do not read `eval/scenarios-uk/` or `eval/scenarios/`** while writing the prompt (as in T3.1).

## Goal

A ticket is written in the language of the transcript and says which language it is in.

## Files

- `src/VoiceToTicket.Api/Features/Tickets/Contract/**` (`Ticket.Language`)
- `src/VoiceToTicket.Api/Features/Tickets/Claude/TicketPrompt.cs`, `TicketValidator.cs`, `FakeTicketGenerator.cs`
- `contract/ticket.schema.json`, `web/src/contract.ts` (regenerated through the snapshot test and `npm run gen:contract`)
- web fixtures and tests that build a `Ticket` (add `language: 'en'`), `web/src/ticket/exportFile.ts` only if needed
- `tests/VoiceToTicket.Api.Tests/Tickets/**`, `tests/VoiceToTicket.Evaluation/**` only where a `Ticket` is built in tests
- `docs/implementation-plan.md` 4.3 and 4.7 (rule 5, 8 and 10 wording), `docs/tasks/L4-*.md`, `docs/status.md`

## Out of scope

- Rendering labels in the ticket's language (L5). A language hint from the client. A second prompt. Any evaluation run.

## Acceptance criteria

- [ ] `Ticket` has a required `language` matching `^[a-z]{2}$`; the validator rejects a missing or malformed value (`llm_invalid_output`, retried once per D15).
- [ ] The gap marker stays exactly `"Not provided"` in every language (prompt rule 5, validator unchanged).
- [ ] Prompt rule 10: fields and questions are in the transcript's language; mixed text counts as the dominant language; names, labels, error texts, code and numbers stay as said. Rule 8 covers any language. The D16 type sentence is unchanged.
- [ ] `TicketPrompt.System` is still one constant; the prompt tests are updated to the new rules.
- [ ] The fake sets `uk` for mostly-Cyrillic text, otherwise `en` (tests for both and for mixed text).
- [ ] Schema snapshot and `contract.ts` regenerated; web compiles and its tests pass.
- [ ] `node scripts/check.mjs` passes.

## Verification

```
dotnet build
dotnet test
node scripts/check.mjs
```

Live (only with the human's go-ahead; costs money): `VTT_RUN_LIVE=1` with one short Ukrainian and one English transcript written for this check, not taken from the scenarios. Expected: `language` is `uk`/`en`, and the text is in that language.

## Gate

**Prompt approved (languages)** (human): the prompt diff is shown before the task is handed over.

## Log

### Plan
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
