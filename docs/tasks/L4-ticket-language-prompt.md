# L4 — Ticket language: contract, prompt, fake

- **Milestone:** M8
- **Status:** done
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

1. Tests first: `TicketValidatorTests` (missing, empty, uppercase, three-letter, `uk`/`en` accepted), `TicketPromptTests` (rules 5, 8, 10 wording; D16 sentence and the single constant unchanged), `FakeTicketGeneratorTests` (`uk` for Cyrillic, `en` for Latin, mixed by majority of letters), schema snapshot (new `language` string property).
2. `Ticket` gets `Language` as the second parameter (the schema lists it right after `type`, so the model states the language before writing the fields). `TicketValidator` checks `^[a-z]{2}$` (the schema carries no `pattern`: the exporter emits none and the schema test allows only known keywords, as with `maxLength`).
3. `TicketPrompt.System`: rules 5, 8, 10 and the Fields list per plan section 5; no other rule changes. The prompt is written without reading `eval/scenarios*`.
4. `FakeTicketGenerator`: language from the share of Cyrillic letters among letters (more than half → `uk`).
5. Update every place that builds a `Ticket` (`TicketSamples`, evaluation tests, JSON samples, web fixtures); regenerate the snapshot (`UPDATE_SNAPSHOTS=1`) and `contract.ts` (`npm run gen:contract`).
6. Plan 4.3 and 4.7 wording in `docs/implementation-plan.md` (edit allowed by the task's file list).
7. ⚠ VERIFY: whether Claude structured outputs accept `pattern`; not needed with this design, so nothing to verify unless the human wants the pattern in the schema.

### Decisions

- `Ticket.Language` is the second record parameter, so the schema lists `language` right after `type` and the model states it before writing the fields. Required, plain `string` in the schema.
- The schema has no `pattern`: the exporter emits none and `TicketSchemaTests` allows only known keywords (the same reason as `maxLength` in T1.2). `TicketValidator` enforces `^[a-z]{2}$` (ASCII only; `en-US`, `EN`, `укр` are rejected) with an error text that does not quote the value. Any two-letter code passes, also an unreal one.
- Prompt (`TicketPrompt.System`): rule 5 adds "in every language. Never translate it"; rule 8 adds "This applies in every language."; rule 10 is rewritten per language-plan section 5 (language of the transcript, ISO 639-1 code with `en`/`uk` as examples, dominant language for mixed text, names/labels/error texts/code/identifiers/numbers stay as said, `"Not provided"` is the one exception); a `- language:` line opens the Fields list. Nothing else changed. No client language hint; the D16 type sentence is untouched (tests pin both).
- New prompt hash `a03cbb8f5caae2ff95df26bd7187145c5e1299aac79b92008ea99bbd2ee94ba9` (was `31c6b80c…`, the hash of every committed English run). The hash test is renamed and now reports the actual hash in its message.
- The fake: `uk` when more than half of the letters are Cyrillic (U+0400–U+04FF), otherwise `en` (no letters = `en`; exactly half = `en`). Its texts stay English.
- Web: `language` is carried through `editedTicket`, `convertTicket` and `TicketPage`'s base ticket (a type conversion or an edit must not lose it). No rendering change (L5).
- Plan edits: implementation-plan 4.3 (record, example, validation rule 6) and 4.7 (rules 5, 8, 10).
- Prompt written without reading `eval/scenarios/` or `eval/scenarios-uk/`.

### Verified

- `dotnet build`: 0 warnings, 0 errors.
- `dotnet test`: Api.Tests 809 passed / 7 skipped; Evaluation 57 passed / 1 skipped; 0 failed (the skips are the Live, Stt and Evaluation traits).
- Web: `tsc -b` clean, `npm test` 378 passed, `npm run lint` clean, `npm run build` passed (through `check.mjs`).
- `node scripts/check.mjs`: all checks passed.
- Snapshot regenerated with `UPDATE_SNAPSHOTS=1`; diff is `language` as a required string after `type`. `contract.ts` regenerated with `npm run gen:contract` (one added line; `jiraContract.ts` unchanged).

- Live check (human's go-ahead 2026-11-20), new test `ClaudeLiveTests.A_real_call_writes_the_ticket_in_the_language_of_the_transcript` (Sonnet 5.5, `VTT_RUN_LIVE=1`, two transcripts written for this check, not from the scenarios; run twice, so four calls in all, the second run only to print the tickets): both passed. English transcript → `language: "en"`, English text. Ukrainian transcript (with the English word "staging") → `language: "uk"`, title, description, steps, result and question in Ukrainian, `staging` kept as said. In both, the unstated expected result is exactly `"Not provided"` (not translated) with a question in the ticket's language. One observation, not a failure: both tickets added a mild step (`Use the download button`, `Відкрити редактор рахунку`) the speaker did not say; one sample each says nothing about rates, the evaluation measures it.

### Not verified

- Prompt quality across languages (rates of `uk` detection, untranslated marker, invented steps): one sample per language only. The evaluation (L9) measures it.
- Playwright e2e (`npm run e2e`) not run; its mocks build no ticket JSON by hand that lacks `language`, and the fake sets it.

### Reviews

- 2026-11-20, round 1: APPROVE. 0 blocker, 0 major, 1 minor (stray `web/tsconfig.tsbuildinfo` from my `tsc -b`; deleted).
### Notes for the study

- Changing the system prompt after the first evaluation run is a tuning round (plan section 8: log it and re-run). The English results in `eval/results/` were measured with the old prompt; before the Recommendation gate (T5.4) the English scenarios need a re-run with this prompt, or the report must say which prompt each number belongs to. The human decides when (L9 or earlier).
- Agent work: built in one pass; the compiler listed every `Ticket` constructor that needed `language`, and the first full test run was green. The agent edited three web source files (`TicketPage.tsx`, `editedTicket.ts`, `convertTicket.ts`) that are not named in the task's file list, to carry `language` through; this was logged in Decisions but not asked about first. The reviewer approved in round 1 and caught only a stray build artifact the agent had created.
- The human approved the prompt and then asked for the live check; it passed on the first try and also added a permanent live test.
- A classifier blocked a throw-away "write the hash to a temp file from a test" attempt; the hash is read from the assertion message instead, which is also what the test now does for the next change.
