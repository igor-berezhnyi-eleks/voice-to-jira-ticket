# N2 — Clickable header steps

- **Milestone:** M10 Navigation (human request 2026-11-24)
- **Status:** done
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

1. `PageHeader`: each step is an ELEKS `Step`; a step other than the current one gets a `StepButton` (MUI, see Decisions) in a `<span title=reason>` so a disabled step still shows its reason. Steps come in as `{ disabled, reason }` plus one `onStep(index)` callback.
2. `App`: one `goToStep(step)` that forwards to the current page's handler. Each page reports `{ steps, go }` through an `onNavigation` prop (handler kept in a ref, step states in state, compared before set). Page 2 also reports whether it has edits, which Page 3 needs.
3. `ReportPage`: Review = `generate()`, Jira = `onOpenJira`, with the same disabled rules as the buttons. A `generateOnOpen` prop starts Generate on mount (Page 3 opened from Page 1 → Review).
4. `TicketPage`: Report = `back()` (existing confirm), Jira = Go to Jira. Both disabled while Regenerate runs.
5. `CreateInJiraPage`: `hasChanges` (summary, description, field values, parent, links; not after Create; never on the Connect panel), one `leave(step)` used by Back, the Connect panel's Cancel and the header; an inline warning like Page 2's with three texts (Page 3 only / Page 2 only / both). Disabled while Create runs.
6. Tests first: `App.test.tsx` (every row of the criteria), `CreateInJiraPage.test.tsx` (has-changes rules, Back asks, Cancel keeps); en/uk keys; Playwright P1→P2→P1 (smoke) and P2→P3→P2 (jira).
7. ⚠ VERIFY: ELEKS UI Stepper clickable pattern (done before the plan, see Decisions).
### Decisions

- ⚠ VERIFY (ELEKS UI MCP, `search_components "stepper"` + docs for Stepper and Step, 2026-11-24): ELEKS UI exports `Stepper`, `Step`, `StepLabel`, `DesktopStepper`, `MobileStepper`; **no `StepButton`**. Its `Step` docs say `disabled` "will also disable the button if `StepButton` is a child". The vendored `Step` is a thin wrapper over MUI's. Decision: use `StepButton` from `@mui/material` (already a direct dependency, v7) inside the ELEKS `Step`; no new dependency, no change to the vendored folder.
- Disabled-step reason: native `title` on a wrapping `span` (a disabled MUI button has `pointer-events: none`, so a title on the button itself never shows).
- Stepper is `nonLinear`: a linear MUI Stepper disables every step after the current one by itself. Steps before the current one are marked `completed` explicitly.
- MUI draws enabled and disabled step buttons alike (only the cursor differs, seen in the browser). Added `opacity: 0.45` for a disabled step and an underline on hover/focus for a clickable one.
- New reason texts (`stepReasons.busy`, `noText`, `textTooShort`): Generate and Go to Jira had no tooltip of their own apart from "Jira is not configured", so these say the same as the page's own hints.
- Page 3 "has changes" also counts a picked **parent** (not in the criterion's list). It is something the user picked for the issue and would lose; project and issue type stay excluded as the criterion says.
- Page 3 → Page 1 → Review: App sets `generateOnOpen`; Page 1 starts Generate on mount and clears the flag, so a later return to Page 1 does not generate again. React's development double effect starts it twice; the first request is aborted by the existing unmount cleanup, and Generate's `finally` now ends "running" only for the latest request.
- Pages register their step handler in a `useLayoutEffect`, not `useEffect`: with a passive effect a fast click right after a page change reached the previous page's handler (found as flaky App tests).
- Connector lines (human, after round 1: "lines between, like we had"): the line only fills spare width, and step buttons with their side padding used it all. Fix: the button keeps MUI's negative side margin (same footprint as a label), and the connector has `minWidth: 40` px. Checked in the browser in en and uk; `check.mjs` and e2e (9 of 9) green after it.
- Page 3 keeps `onBack` (Back, Connect panel Cancel) and gains `onStep` for header jumps, so existing tests and callers did not change.
### Verified

- `npm run lint`: pass.
- `npm test`: 31 files, 509 tests pass (35 new: 21 in `App.test.tsx` for the header rows, 14 in `CreateInJiraPage.test.tsx` for has-changes, Back, Cancel/Discard, the three texts, the Connect panel, disabled while Create runs). `App.test.tsx` + `CreateInJiraPage.test.tsx` run three times in a row: 106/106 each time.
- `npm run build`: pass.
- `npm run e2e`: 9 of 9 (2 new: smoke P1→P2→P1 with Cancel, then keyboard Enter and Discard; jira P2→P3→P2 with the Page 3 question).
- `node scripts/check.mjs`: all checks passed.
- Browser (dev server, no API): disabled steps show their reason as tooltip; Review enables at 20 characters; disabled steps dimmed.
- Manual check by the human (every jump, with and without edits, en and uk, keyboard): passed ("Manual check is done, all is good", 2026-11-24).
- `node scripts/check.mjs` at `/finish-task`: all checks passed.

### Not verified

- Ukrainian texts: written by the agent, not reviewed by a native speaker.
### Reviews

- 2026-11-24, round 1: APPROVE. 0 blocker, 0 major, 2 minor. Fixed: a test name that promised a Back click it did not make (renamed; Back without changes is covered in `CreateInJiraPage.test.tsx`). Open for the human: the first direct component import from `@mui/material` outside the vendored ELEKS UI folder (`StepButton`, see Decisions).
### Notes for the study

- The ⚠ VERIFY on the ELEKS UI MCP paid off: it showed there is no `StepButton`, so the gap was recorded and put to the human rather than built around silently; the reviewer flagged the direct MUI import as a convention change, and the human accepted it.
- Running the new App tests revealed a real race (step handler registered in a passive effect, so a fast click hit the previous page); the flaky failures, not the reviewer, caught it.
- The human caught a visual regression no test checks: the step connector lines collapsed to zero width once the steps became buttons. A browser look at the header had been done, but only for the disabled state.
- Harness: a global `sed` in a test file changed a line in an existing test; `npm run build` (tsc, duplicate key) caught it before the reviewer.
