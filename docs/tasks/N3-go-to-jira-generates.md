# N3 — Go to Jira from Page 1 generates the ticket first

- **Milestone:** M10 Navigation (human request 2026-11-26; changes the N1 decision)
- **Status:** todo
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
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
