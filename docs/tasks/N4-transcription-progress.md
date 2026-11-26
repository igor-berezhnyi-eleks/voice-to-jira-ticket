# N4 — Progress indicator while a recording is transcribed

- **Milestone:** M10 Navigation (human request 2026-11-26)
- **Status:** todo
- **Depends on:** T2.3, T6.2, L1
- **Plan sections:** `docs/implementation-plan.md` 4.8 (Page 1)
- **Parallel-safe with:** L10. With N3 only if each keeps to its own part of `ReportPage.tsx`.

## Goal

While a recording or an uploaded file is being transcribed, Page 1 shows a visible, animated indicator, so the user sees the app is working. Today only a plain "Transcribing…" text appears next to the buttons, which is easy to miss.

## Files

Create or change only these. Anything else: ask first.

- `web/src/report/ReportPage.tsx` (+ `ReportPage.test.tsx`)
- `web/src/styles.css` (only if spacing needs it)
- `web/src/i18n/en.ts`, `uk.ts` (only if the text changes)
- `docs/tasks/N4-*.md`, `docs/status.md`

## Proposed design (confirm with the human at the start)

- Place: the row under the transcript box, between the character counter and **Translate** (the spot the human marked). A small spinner (ELEKS UI progress component, circular, about 16–20 px) and the text **Transcribing…** / **Розпізнавання…**, with `role="status"`.
- The plain status text next to the buttons moves there (one indicator, not two).
- Alternative the human may prefer: a thin indeterminate progress bar along the bottom edge of the transcript box. Suggested: the spinner, because the row already holds status-like text.
- Optional (ask): show elapsed seconds next to the text ("Transcribing… 0:12"), since CPU speech-to-text can take a while.

## Out of scope

- Indicators for translation or generation (they keep their text; a follow-up if the human wants the same look).
- Any change to the recorder or the transcription API.

## Acceptance criteria

- [ ] While status is `transcribing`, the spinner and the text show in the chosen place, in en and uk; they disappear on success, error, and "no speech".
- [ ] It shows for both a recording and an uploaded file.
- [ ] The character counter stays visible and the layout does not jump when the indicator appears (no line wrap at 1024 px width; on a narrow screen it may wrap).
- [ ] Screen readers get the status (`role="status"`), only once.
- [ ] Works in light and dark theme.
- [ ] Tests: Vitest checks the indicator is shown during transcription and gone after; existing tests that look for the "Transcribing" text still pass or are updated without weakening them.

## Verification

```
cd web
npm run lint
npm test
npm run build
```

`node scripts/check.mjs`

Manual check for the human:

- Local with the STT container: record a short report, and upload a file; the spinner shows under the transcript box until the text arrives. Check in Ukrainian and in dark theme.

## Gate

None.

## Notes

- Load the `eleks-ui-design-system` skill and check the ELEKS UI `Progress` component docs via the MCP before choosing the component (⚠ VERIFY its props).
- The agent may check the look in the browser preview; the transcription state can be held with a test double or a slow STT response.

## Log

### Plan
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
