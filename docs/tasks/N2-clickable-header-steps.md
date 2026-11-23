# N2 — Clickable header steps

- **Milestone:** M10 Navigation (human request 2026-11-24)
- **Status:** todo
- **Depends on:** N1 done
- **Plan sections:** `docs/implementation-plan.md` 4.8 (pages); `docs/jira-plan.md` (Page 3)
- **Parallel-safe with:** T5.4. Not with N1.

## Goal

The three steps in the header (Report, Review, Jira) are clickable. Each jump does exactly what the matching button on the current page does, including the question before edits are lost. Leaving Page 3 now also asks when Page 3 has changes (Back button and header alike).

## Files

Create or change only these. Anything else: ask first.

- `web/src/layout/PageHeader.tsx`, `AppShell.tsx`: clickable steps, disabled steps
- `web/src/App.tsx` (+ `App.test.tsx`): one place that decides what a step click does
- `web/src/report/ReportPage.tsx`, `web/src/ticket/TicketPage.tsx`, `web/src/jira/CreateInJiraPage.tsx` (+ their tests): accept a navigation request from the header and run their own confirmation; Page 3 gets a "has changes" notion and a confirmation
- `web/src/i18n/en.ts`, `uk.ts` (+ key tests if needed)
- `web/e2e/smoke.spec.ts`, `web/e2e/jira.spec.ts`
- `docs/tasks/N2-*.md`, `docs/status.md`

## Out of scope

- A router or URL per page (D3).
- Keeping Page 3's state after leaving it (human decision: ask instead).
- Changing what the existing buttons do, apart from Page 3's Back now asking (decision 3).

## Decisions (human, 2026-11-24)

1. Page 1 → Page 2 / Page 3: same as Page 1's **Generate** / **Go to Jira** (N1) buttons.
2. Page 2 → Page 1: same as **Back** (asks when Page 2 has edits). Page 2 → Page 3: same as **Go to Jira** (edits travel to Page 3, Page 2 is kept, **no question**).
3. Leaving Page 3 (Back button or header) asks when Page 3 has changes. Page 3 → Page 1 also warns when the kept Page 2 has edits, because those are lost too.
4. Page 3 opened straight from Page 1 → its Review step behaves like Page 1's **Generate** with the Page 1 text (after the Page 3 question, if any).

## Acceptance criteria

- [ ] Steps other than the current one are keyboard-reachable buttons with an accessible name; the current step is not clickable. A step that cannot be reached is shown disabled with a reason as tooltip (same texts as the matching buttons: empty text, Jira not configured, request running).
- [ ] **Page 1:** Review = Generate (disabled exactly when Generate is; same progress and errors). Jira = N1's Go to Jira (disabled exactly when it is).
- [ ] **Page 2:** Report = Back (same confirmation as today when Page 2 has edits, including edits in a parked Bug/Feature view). Jira = Go to Jira: edits carried over, no question; disabled when Jira is not enabled.
- [ ] **Page 3 opened from Page 2:** Review → asks if Page 3 has changes, then shows Page 2 with its edits. Report → asks if Page 3 has changes **or** Page 2 has edits (one question that says what will be lost), then Page 1 with the text unchanged.
- [ ] **Page 3 opened from Page 1:** Report → asks if Page 3 has changes, then Page 1. Review → asks if Page 3 has changes, then generates from the Page 1 text like Generate (progress and errors show where Generate shows them).
- [ ] Page 3 "has changes" = summary, description, field values or links differ from what the page opened with. Project and issue-type picks do not count (they are remembered preferences). The Connect panel (not connected) has no changes. After a successful Create, leaving does not ask.
- [ ] Page 3's **Back** button asks under the same rule (decision 3).
- [ ] The confirmation on Page 3 matches Page 2's inline style; Cancel keeps the user on the page with everything unchanged. Texts in en and uk.
- [ ] While a request is running (generate, regenerate, create in Jira), the header steps are disabled.
- [ ] Tests: Vitest for every row above (with and without changes, Cancel and Continue); Playwright: header navigation P1→P2→P1 and P2→P3→P2 in the smoke/jira specs.

## Verification

```
cd web
npm run lint
npm test
npm run build
npm run e2e
```

`node scripts/check.mjs`

Manual check for the human:

- Local: every jump in the table above, with and without edits, in en and uk; keyboard only (Tab + Enter) at least once.

## Gate

None.

## Notes

- ⚠ VERIFY with the ELEKS UI MCP (`search_components`, component docs) whether its Stepper offers `StepButton` (or the right clickable pattern) before building one by hand. Record the answer in the log.
- Page 2's dirty state and confirmation live in `TicketPage`; prefer passing a navigation request down (the page runs its own confirm) over lifting edit state into `App`.
- `App.tsx` keeps Page 2 mounted but hidden on Page 3; Page 3 is unmounted when left, so its changes are lost — which is why it asks.

## Log

### Plan
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
