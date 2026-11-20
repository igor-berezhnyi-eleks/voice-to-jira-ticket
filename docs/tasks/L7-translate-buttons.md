# L7 — Translate buttons on Page 1

- **Milestone:** M8
- **Status:** todo
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

- [ ] With English selected: only "Translate to English". With another language selected: "Translate to English" and "Translate to <native name>".
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
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
