# N4 — Progress indicator while a recording is transcribed

- **Milestone:** M10 Navigation (human request 2026-11-26)
- **Status:** done
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

- Start decisions (human, 2026-11-26): spinner + text (suggested design); no elapsed timer; keep the Ukrainian text «Транскрибування…» (no i18n change).
- `ReportPage.tsx`: remove the `transcribing` status text from the button row; add, in the row under the transcript box (inner Stack before Translate), a `role="status"` Stack holding an `aria-hidden` ELEKS UI `CircularProgress` (size 18, indeterminate) and `t.transcribing` as caption text.
- Tests first in `ReportPage.test.tsx`: indicator (status + progressbar) shown during record and upload transcription, gone after success, error and no speech; one status only; it sits next to the counter; Ukrainian text via `LanguageProvider`.
- Existing `getByText('Transcribing…')` checks stay and keep passing.
- ⚠ VERIFY: `CircularProgress` props via ELEKS UI MCP and the local `core/Progress/index.tsx`.
- Look checked in the browser preview at 1024 px, light and dark, with a held transcription request.
### Decisions

- ⚠ VERIFY `CircularProgress` (ELEKS UI MCP docs, 2026-11-26): props `size` (number|string, default 40), `variant` (default `indeterminate`), `color` (default `primary`), `thickness`; rest go to the root span. Local `core/Progress/index.tsx` is a plain pass-through to MUI, exported from `@eleks-ui/components`. Used: `size={18}`, defaults otherwise.
- The spinner is `aria-hidden`; the wrapping Stack carries `role="status"`, so screen readers hear «Transcribing…» once and no unlabeled progressbar is announced.
- The indicator sits first in the inner Stack with Translate (gap widened from 1 to 2), so the counter stays left and Translate right. No `styles.css` or i18n change.
### Verified

- Tests written first: 6 new tests in `ReportPage.test.tsx` ("Page 1 transcription indicator") failed before the change (no spinner), pass after. Existing `getByText('Transcribing…')` checks unchanged and passing.
- `npm run lint`: pass. `npm test`: 32 files, 533 tests pass. `npm run build`: pass (existing chunk-size warning only).
- `node scripts/check.mjs`: all checks passed.
- Browser preview at 1024×768, transcription request held by a stubbed `fetch`, file chosen via the file input: spinner + «Transcribing…» on one line between the counter and Translate; row height 35.8 px (the Translate button's height), status 20 px, so no jump. Same in Ukrainian («Транскрибування…», one line) and in dark theme.
### Not verified

- None left open. The agent could not run the real recording and upload against the STT container; the human's manual check (2026-11-26) covered it: recording and upload, Ukrainian and dark theme, "all is good".
### Reviews

- 2026-11-26, round 1: APPROVE, 0 findings (0 blocker, 0 major, 0 minor). The reviewer could not check the layout at 1024 px or dark theme visually and relied on the preview notes.
### Notes for the study

- Three start questions in one round (indicator, timer, Ukrainian wording). The wording question came from the agent noticing the task file's «Розпізнавання…» did not match the existing «Транскрибування…» string. No human correction was needed after that.
- Test-first worked cleanly: 6 new tests red, then green after one edit. Holding the transcription request with a stubbed `fetch` plus `DataTransfer` on the file input let the agent check the live look (1024 px, uk, dark) without the STT container.
- Reviewer APPROVE in round 1, no findings. The harness's Stop gate caught a load timeout (see below), and re-running the file alone showed it was not a regression.

- The Stop hook once failed with two 5 s timeouts in `App.test.tsx`, a file this task does not touch. That run overlapped the reviewer's own `npm test`. Run alone, `App.test.tsx` passed 44/44, and the full suite had passed twice before. Load flake, not a regression. Running test suites in parallel on this machine can trip the 5 s per-test limit.
