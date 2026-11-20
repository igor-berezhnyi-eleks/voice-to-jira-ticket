# L1 — i18n foundation, language selector, shell and Page 1

- **Milestone:** M8
- **Status:** done
- **Depends on:** L0 approved
- **Plan sections:** `docs/language-plan.md` 2 (D18), 7; implementation-plan 4.8
- **Parallel-safe with:** L3, L4, L6, L8

## Goal

A language selector in the header switches the UI between English and Ukrainian and is remembered across visits. The header and Page 1 are fully translated. Later pages can use the same `useT()`.

## Files

- `web/src/i18n/**` (new: `languages.ts`, `en.ts`, `uk.ts`, `LanguageProvider.tsx`, `useT`, `languagePreference.ts`, tests)
- `web/src/main.tsx`, `web/src/App.tsx`, `web/src/layout/**`
- `web/src/report/**`, `web/src/recording/**` (user-visible strings only), `web/src/errorMessages.ts` (generation errors shown on Page 1)
- related tests, `web/e2e/*` only if a selector or text changes
- `docs/tasks/L1-*.md`, `docs/status.md`

## Out of scope

- Page 2, Page 3, Connect panel (L2). Sending the language to the API (L3). Translate buttons (L7). Any i18n library.

## Acceptance criteria

- [x] The selector in `PageHeader` shows the native names (English, Українська). It is keyboard-accessible and labelled.
- [x] Default is English. The choice is stored in `localStorage` `vtt.language`, wrapped in try/catch, and an unknown or blocked value falls back to `en`. `<html lang>` follows the choice.
- [x] `uk.ts` is typed against `en.ts`: a missing key fails `npm run build`. Plurals use `Intl.PluralRules` (a test covers the Ukrainian forms 1/2/5, for example the timer or limits).
- [x] The header, stepper, Page 1 (buttons, states, recorder errors, upload, limits, banner) and generation errors are translated. No English text is left in Page 1 with `uk` selected (a test renders Page 1 in `uk` and checks that known English strings are absent).
- [x] Switching language keeps the textbox text, the recording and the ticket.
- [x] MUI built-in texts follow the language (`ukUA` locale) if it merges with the ELEKS theme; otherwise this is recorded as not done.
- [x] `node scripts/check.mjs` passes.

## Verification

```
cd web && npm run build && npm test && npm run lint
node scripts/check.mjs
```

Manual check for the human: switch to Українська, reload (still Ukrainian), read Page 1 for wording.

## Gate

None. The human reviews the Ukrainian wording at hand-over.

## Notes

- Load the `eleks-ui-design-system` skill before UI work. Use the existing `NativeSelect` if it fits.
- ⚠ VERIFY: `ukUA` export of `@mui/material/locale` in the installed version.

## Log

### Plan
Dictionaries `en.ts` (source) and `uk.ts` (typed `Dictionary`); `LanguageProvider` with `useT()` and `useLanguage()`; `LanguageSelect` in `PageHeader`; strings of the header, Page 1, recorder, upload checks and generation errors moved into the dictionaries. Pure helpers (`describeGenerationError`, `prepareAudioFile`, `durationMessage`) take an optional dictionary defaulting to English, so the existing tests stay valid. New tests in `i18n/i18n.test.tsx`.

### Decisions
- No new dependency. `LanguageProvider` imports `@mui/material/styles` and `@mui/material/locale` (theme utilities, not components; the ELEKS provider does the same) and merges `ukUA` or `enUS` into the outer ELEKS theme with `createTheme(outer, locale)`. ⚠ VERIFY done: `ukUA` exists in the installed version; a test shows the merge keeps the outer palette and carries the Ukrainian texts.
- The selector is a native select (`TextField select` with `native`), labelled with `aria-label`. Names are native (English, Українська).
- Page 1's own "Language" and "Translate" controls (UI only until L7) are translated; their option values are now language codes.
- The generation error is stored as the raw failure and described at render, so it follows a language switch. Recorder errors are written when raised, so a recorder error already on screen stays in its language until the next action (known limit); the "no speech" notice is mapped at render.
- The hint line says "англійською": speech-to-text is English-only until L3.
- New file `layout/LanguageSelect.tsx` is inside `layout/**`. No file outside the list was changed.

### Verified
- `npm run build`: pass. `npm test`: 26 files pass (396 tests, 18 of them in the new i18n file). `npm run lint`: pass. `node scripts/check.mjs`: all passed.

### Not verified
- Manual check (switch to Українська, reload, read Page 1) done by the human; the agent did not look at it in a browser. `npm run e2e` not run (default English, no text changes expected).
- Ukrainian wording not reviewed by a native speaker (the human does this at hand-over).

### Reviews
- 2026-11-20, round 1: APPROVE, 1 minor (test count misstated in this log; fixed). Reviewer also noted that the Ukrainian "upload" and "download" buttons read alike; the download button is now "Зберегти запис".
### Notes for the study
- Python is not installed on this machine; scripted edits were done with Node. The working tree has CRLF files, which the scripts had to preserve.
- Agent work: built in one pass; the reviewer found only a miscounted test total in the log. The human approved by running `/finish-task`; the human then reported the manual check (switch, reload, read Page 1) as done.
- Harness: the Stop gate and `check.mjs` stayed green; nothing caught the log text mangled by a shell heredoc (found by reading the diff).
- A shell heredoc ate the backticks in the first log text; the log was rewritten from a file.
