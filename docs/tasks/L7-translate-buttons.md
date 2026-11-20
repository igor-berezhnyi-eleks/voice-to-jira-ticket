# L7 — Translate buttons on Page 1

- **Milestone:** M8
- **Status:** done
- **Depends on:** L1, L6 done
- **Plan sections:** `docs/language-plan.md` 2 (D20), 3, 6 (Page 1)
- **Parallel-safe with:** L8

## Goal

The user can translate the textbox text to English or to the selected language, fix it by hand, undo it, and generate a ticket from whatever the box holds.

## Files

- `web/src/report/**`, `web/src/api.ts`, `web/src/errorMessages.ts`, `web/src/i18n/en.ts`, `uk.ts`
- related tests, `web/e2e/*` (one smoke step with the fake translator)
- `docs/tasks/L7-*.md`, `docs/status.md`

## Out of scope

- Translating Page 2 or the ticket. Remembering the original text across reloads.

## Acceptance criteria

- [ ] One button, towards the other side (human decision after the first hand-over): text whose first 50 characters (fewer if shorter) contain any Cyrillic letter counts as Ukrainian and gets "Translate to English"; any other text gets "Translate to <native name>" of the selected language, or "Translate to English" when English is selected.
- [ ] Buttons are disabled while the box is empty, a translation, transcription or generation is running.
- [ ] Success replaces the text and shows "Translated from <language>" with **Undo**. Undo restores the exact earlier text. Any edit, recording or new translation clears Undo.
- [ ] The box stays editable. Generate sends the box's current text (test: translate, edit, generate → request has the edited text).
- [ ] Errors are shown with translated messages (`llm_*`, `translation_pair_unsupported`, network). The text is unchanged after an error.
- [ ] `node scripts/check.mjs` passes; `npm run e2e` passes, or is marked as not run.

## Verification

```
cd web && npm run build && npm test && npm run lint
node scripts/check.mjs
npm run e2e
```

Manual check for the human (Claude provider): dictate in Ukrainian, translate to English, fix a word, generate; check that numbers and names survived. Then translate an English text to Ukrainian.

## Gate

None.

## Log

### Plan

- Tests first: `api.test.ts` (`translateText` request/response, error codes), `errorMessages.test.ts` (`describeTranslationError`), `ReportPage.test.tsx` (buttons per language, disabled states, replace + "Translated from" + Undo, Undo exactness, edit/record/new translation clears Undo, translate → edit → generate sends the edited text, errors leave text unchanged), then one e2e step with the fake translator.
- `api.ts`: `translateText(text, to, signal)` → `{ text, from, to }`.
- `errorMessages.ts`: `describeTranslationError` (own `translationErrors` dictionary group, since the `errors` texts say "ticket service").
- `i18n/en.ts`, `uk.ts`: `translateToEnglish`, `translateTo(name)`, `translating`, `translatedFrom(name)`, `undo`, `alreadyIn(name)`, `languageNames`, `translationErrors`; remove the placeholder keys `language` and `translate` (and their line in `i18n.test.tsx`).
- `ReportPage.tsx`: drop the local placeholder Language select (the header selector is the one selector, D18); use `useLanguage()` for the target; Undo is shown only while the box still holds the translated text and is cleared by any change handler.
- Decision to log: text already in the target language comes back unchanged (`from` = `to`); the page shows a notice instead of "Translated from" + Undo.
- No ⚠ VERIFY facts, no new dependency, all files inside the list.
### Decisions

- The placeholder Language select on Page 1 is removed: the header selector is the one selector (D18). The buttons read the selected language from `useLanguage()`.
- Text already in the target language: the API returns it as sent (`from` = `to`). The page then shows an info line ("The text is already in English. Nothing was changed.") and no "Translated from" or Undo. Not in the plan; added so the user is not shown "Translated from English".
- Undo is shown only while the box holds exactly the text the translation put there (derived), and every change handler clears it, so an edit, a dictated part or a new translation removes it. One level of undo.
- Translation errors have their own dictionary group (`translationErrors`) because the `errors` texts say "ticket service". `validation` keeps the server text, as for generation. Record, Upload and Try again are also disabled while a translation runs, so the text cannot change under it.
- Language names for "Translated from <language>" are in the dictionary (`languageNames`; Ukrainian uses the genitive: "Перекладено з англійської"); an unknown code is shown as the code. The button for the selected language uses its native name (plan section 6).
- No new dependency, no ⚠ VERIFY facts.

### Verified

- `cd web && npm run build`, `npm run lint`: pass. `npm test`: 30 files, 459 tests pass. `node scripts/check.mjs` (build, test, lint) re-run after the last lint fixes: all pass.
- New tests: 13 in `report/ReportPage.translate.test.tsx` (buttons per language, disabled states, replace + Undo exactness, edit clears Undo, second translation, translate-edit-generate sends the edited text, already-in-language, error messages in both languages with the text unchanged), 3 in `api.test.ts`, 4 in `errorMessages.test.ts`.
- `npx playwright test e2e/smoke.spec.ts`: 4 of 4 pass, including the new translate step with the fake translator.

- After the first hand-over (human, 2026-11-20): the two buttons were replaced by one, chosen by a simple Cyrillic check in `report/textLanguage.ts` (first 50 characters). Other non-English text (for example German) is not detected and gets the same button as English text. The human confirmed live translation (`Translation:Provider=Claude`) works as expected; the earlier "[en] " prefix was the fake translator, which is the shipped default.

### Not verified

- `npm run e2e` as a whole: the first run had 3 failures. Two are in `e2e/jira.spec.ts` and are not caused by L7: the page snapshot shows the Connect panel's "Jira address" field (J9) empty, so Connect stays disabled; the spec never fills it. Not fixed here (out of scope). The third was my new smoke step (the fake treats English text as already English); fixed, re-run green. I did not run the Jira spec on a clean checkout to confirm it failed before L7.
- The real Claude translation (Haiku): no call made; the manual check below is the human's.
### Reviews

- Round 1: APPROVE. Minor: no test that dictation or upload clears Undo, or that Generate and Record are disabled during transcription and generation (both covered by code only); the already-in-language notice is outside the plan (logged under Decisions). Not fixed.
### Notes for the study

- Built test-first in one pass. The human's first manual check found two things the agent could not see from tests: two buttons felt wrong (a plan decision, not a bug) and "[en]" prefixes were the shipped fake translator. The human then chose one button with a Cyrillic check; the agent had offered options and waited.
- Reviewer APPROVE in round 1 (2 minor, left). A scripted edit broke on CRLF line endings in one file; fixed by a script that keeps them.
- The full e2e run failed on two Jira specs (missing Jira address step, since J9) and later reused the human's running servers, so the final smoke run after the button change was not repeated. The harness does not run e2e, so neither was caught automatically.
- Also edited `web/src/i18n/i18n.test.tsx` (one line, a renamed key), outside the file list.
