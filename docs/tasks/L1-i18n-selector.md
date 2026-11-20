# L1 — i18n foundation, language selector, shell and Page 1

- **Milestone:** M8
- **Status:** todo
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

- [ ] The selector in `PageHeader` shows the native names (English, Українська). It is keyboard-accessible and labelled.
- [ ] Default is English. The choice is stored in `localStorage` `vtt.language`, wrapped in try/catch, and an unknown or blocked value falls back to `en`. `<html lang>` follows the choice.
- [ ] `uk.ts` is typed against `en.ts`: a missing key fails `npm run build`. Plurals use `Intl.PluralRules` (a test covers the Ukrainian forms 1/2/5, for example the timer or limits).
- [ ] The header, stepper, Page 1 (buttons, states, recorder errors, upload, limits, banner) and generation errors are translated. No English text is left in Page 1 with `uk` selected (a test renders Page 1 in `uk` and checks that known English strings are absent).
- [ ] Switching language keeps the textbox text, the recording and the ticket.
- [ ] MUI built-in texts follow the language (`ukUA` locale) if it merges with the ELEKS theme; otherwise this is recorded as not done.
- [ ] `node scripts/check.mjs` passes.

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
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
