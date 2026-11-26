# N3 — Go to Jira from Page 1 generates the ticket first

- **Milestone:** M10 Navigation (human request 2026-11-26; changes the N1 decision)
- **Status:** done
- **Depends on:** N1, N2
- **Plan sections:** `docs/tasks/N1-report-straight-to-jira.md`, `docs/tasks/N2-clickable-header-steps.md`; `docs/implementation-plan.md` 4.8 (Page 1)
- **Parallel-safe with:** N4 only if N4 keeps to the transcript area of `ReportPage.tsx`. Not with L10 (same files).

## Goal

**Go to Jira** on Page 1 no longer opens Page 3 with the raw report text. It calls Claude to structure the text, exactly like **Generate**, then skips Page 2 and opens Page 3 filled from the generated ticket as if the user had opened Page 2 and pressed Go to Jira without editing anything. The user can still go back to Page 2 and edit the generated ticket.

## Files

Create or change only these. Anything else: ask first.

- `web/src/App.tsx` (+ `App.test.tsx`): Page 1 → generate → Page 3 with the ticket; Page 2 kept mounted with the result
- `web/src/report/ReportPage.tsx` (+ `ReportPage.test.tsx`): the button runs the generate call and reports where to go
- `web/src/ticket/TicketPage.tsx` (+ test): only if the description text must come from a shared helper instead of the page
- `web/src/jira/CreateInJiraPage.tsx` (+ `CreateInJiraPage.test.tsx`): remove or keep the `from: 'report'` path (see the decisions)
- `web/src/i18n/en.ts`, `uk.ts` (+ `pages.test.tsx` if keys change)
- `web/e2e/jira.spec.ts` (update the N1 path)
- `README.md` (the Jira line from N1), `docs/tasks/N3-*.md`, `docs/status.md`

## Out of scope

- Any API, contract or prompt change: the same generate endpoint and request as Generate.
- Changing Page 2 or Page 3 behaviour when reached through Generate.
- Running a Claude call to translate anything on this path.

## Decisions to confirm with the human at the start

1. The generated ticket fills Page 3 exactly as Page 2's Go to Jira does today: Summary = title (empty if "Not provided"), Description = the Jira wiki text of the unedited ticket, issue type pre-selected from Bug/Feature.
2. Page 3's back button reads **Back to ticket** and goes to Page 2 with the generated ticket; header step 2 does the same. The N1 "Back to report" / "Reset to report text" path is no longer reachable and is removed (keys removed from `en.ts`/`uk.ts`). Suggested: yes.
3. The button follows Generate's rules: disabled under 20 characters and while busy, plus Jira not configured. While generating, the **Generating…** status shows; a generation error stays on Page 1 with today's error and Try again.
4. Not connected to Jira: the ticket is generated first, then the Connect panel shows (as from Page 2). Cancel on the panel goes to Page 2 (the ticket exists now). Suggested: yes; the alternative is to ask the Jira status before the Claude call and show the panel first.

## Acceptance criteria

- [ ] Go to Jira on Page 1 sends one generate request (same body as Generate) and, on success, shows Page 3 with Summary, Description and issue type from the generated ticket; Page 2 is not shown on the way.
- [ ] Back (and header step 2) from Page 3 shows Page 2 with the generated ticket unedited; edits made there, then Go to Jira, reach Page 3 as today.
- [ ] Page 3 "has changes" questions from N2 still work on this path.
- [ ] The Fake banner shows when the fake generator produced the ticket.
- [ ] Generation errors, the busy state and disabled reasons on Page 1 match Generate's.
- [ ] Not connected: the Connect panel shows after the ticket is generated; Cancel behaves as decided in 4.
- [ ] Generate (Page 1 → Page 2) is unchanged.
- [ ] Tests: Vitest for the request sent, Page 3's props, Back to Page 2, the error case and the Connect panel case; `jira.spec.ts` path updated.
- [ ] Decision log in `docs/status.md` records that N3 replaces the N1 decision "no Claude call on this path".

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

- Local (`npm run dev` + API, real Claude key): type a report on Page 1 → Go to Jira → Page 3 has a summary and a structured description → Back to ticket → edit → Go to Jira → the edit is there → Create. Repeat in Ukrainian.

## Gate

None.

## Notes

- Today `ReportPage` runs `generate` and calls `onGenerated`; `App.showTicket` sets the result and Page 2. The description for Page 3 is built by `TicketPage` (`onConnectJira(ticket, wikiText)`); the new path needs the same text without the user opening Page 2: reuse the render helper (`ticket/render/jiraWiki.ts`, in the ticket's language as in L5) rather than copying it.
- `TicketPage` stays mounted (hidden) on Page 3 so Back keeps state; on this path it must mount with the new result too.
- Load the `eleks-ui-design-system` skill before touching components.

## Log

### Plan

Decisions 1–4 confirmed by the human on 2026-11-26 as suggested (Page 3 filled like Page 2's Go to Jira; Back → Page 2 and the N1 report path removed; Generate's rules; not connected → generate, then the Connect panel, Cancel → Page 2).

1. `ReportPage.tsx`: Go to Jira (button and header step 3) runs the same `generate()` as Generate and calls `onGenerated(response, 'jira')`; it is disabled when Generate is, or when Jira is not configured. Remove `onOpenJira`, `generateOnOpen`, `onGenerateStarted`.
2. `TicketPage.tsx`: export `uneditedTicket(ticket)` (the baseline Page 2 reads out of an untouched ticket), so Page 3 gets exactly the text Page 2 would send.
3. `App.tsx`: on `'jira'`, ask the Jira status, set the result (Page 2 mounts hidden) and open Page 3 with title / `renderJiraWiki(uneditedTicket)` / type; Jira off → Page 2. Remove `openJiraFromReport`, `from`, `generateOnOpen`, `reviewFromJiraReason`.
4. `CreateInJiraPage.tsx`: remove `from`, `reviewDisabledReason` and the no-type key; `ticketType` required. `en.ts`/`uk.ts`: remove `backToReport`, `resetToReport`, `stepReasons.noText`.
5. Tests first: App.test (request body, Page 3 props, Back → Page 2 unedited, edit → Go to Jira, error, busy, Connect + Cancel, Fake banner), ReportPage.test, CreateInJiraPage.test cleanup; `e2e/jira.spec.ts` N1 path rewritten.
6. README Jira line; status decision log. No ⚠ VERIFY facts.
### Decisions

- Human, 2026-11-26: decisions 1–4 accepted as suggested (see Plan).
- Page 3 gets the text from `uneditedTicket()` (new export in `TicketPage.tsx`: the baseline Page 2 reads out of an untouched ticket) passed to `renderJiraWiki`, so it is exactly what Page 2's Connect to Jira would send, normalisation included. No copy of the render code.
- Retry after a failed Go to Jira repeats Go to Jira (not Generate), under Go to Jira's rules (disabled when Jira is off; review round 1). The failed button is kept with the failure in state. Not in the task text; confirmed by the human on 2026-11-26.
- Jira found off by the fresh status call after generating (rare: config changed): the ticket is kept and Page 2 shows, so the Claude call is not lost.
- The header Jira step's disabled reason on Page 1 is now "The report needs at least 20 characters" (as Generate); `stepReasons.noText` became unused and is removed with `backToReport` and `resetToReport` from `en.ts`/`uk.ts`. `pages.test.tsx` needed no change (it checks key parity, which still holds).
- `CreateInJiraPage`: `from`, `reviewDisabledReason` and the "Report" issue-type preference key are removed; `ticketType` is now required (every caller has a ticket). A stored "Report" preference in an existing browser is simply never read.
- The busy state on Page 1 lasts until App has asked the Jira status and switched page (`onGenerated` may return a promise that ReportPage awaits), so there is no idle flash between the Claude call and Page 3.
- No new dependency; no ⚠ VERIFY facts.

### Verified

- `npm run lint`: pass (no warnings).
- `npm test`: 32 files, 527 tests pass after review round 1 (525 before; added: Retry rules, Page 1 vs Page 2 normalised text).
- `npm run build`: pass (existing chunk-size warning only).
- `npm run e2e`: 9 of 9 pass (re-run after round 1), including the rewritten "jira flow from Page 1: generates first, connect, filled from the ticket, Back to ticket, edit, create" (fake generator, real API).
- `node scripts/check.mjs`: all checks passed (web build, test, lint).
- Ports 5080/5173 free before and after e2e.

- Manual check (human, 2026-11-26, real Claude key): "Manual check done, all is good."

### Not verified

- Nothing open.
### Reviews

- 2026-11-26, round 1: APPROVE; 0 blocker, 0 major, 1 minor (Retry after a failed Go to Jira ignored Jira's rules) — fixed. The reviewer's untested point (normalised ticket: Page 1 path vs Page 2 path) now has an App test.
### Notes for the study

- The four start-of-task decisions were asked in one question round; the human took all suggestions, so no rework.
- A broad `sed` on the test file changed two unrelated "Try again" assertions; the test run caught it at once and they were restored. The hidden-but-mounted Page 2 made a "Description" query ambiguous, also caught by the tests.
- The reviewer found one minor gap (Retry ignored Jira's rules) and named an untested claim (Page 1 vs Page 2 normalised text); both were closed with tests. The Stop-gate hook had nothing to catch: checks were green before each hand-over.
