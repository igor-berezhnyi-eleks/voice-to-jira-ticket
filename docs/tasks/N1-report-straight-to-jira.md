# N1 — From Page 1 straight to Jira

- **Milestone:** M10 Navigation (human request 2026-11-24)
- **Status:** todo
- **Depends on:** J10 (Connect panel per session), L2 (translated Page 3)
- **Plan sections:** `docs/jira-plan.md` (Page 3, Connect panel); `docs/implementation-plan.md` 4.8 (Page 1)
- **Parallel-safe with:** T5.4. Not with N2 (same files; N2 builds on this task).

## Goal

Page 1 has a **Go to Jira** button. When the transcript box has text, it opens Page 3 directly, without generating a ticket: the Page 1 text becomes the Jira description and Summary is empty for the user to write. If the user is not connected to Jira, Page 3 shows the Connect panel first, as it does today when coming from Page 2.

## Files

Create or change only these. Anything else: ask first.

- `web/src/App.tsx` (+ `App.test.tsx`): ask the Jira status on Page 1 too; open Page 3 from Page 1; remember where Page 3 was opened from
- `web/src/report/ReportPage.tsx` (+ its test): the button
- `web/src/jira/CreateInJiraPage.tsx` (+ `CreateInJiraPage.test.tsx`): ticket type optional; Back label and target depend on where the page was opened from
- `web/src/i18n/en.ts`, `uk.ts` (+ `i18n.test.tsx` / `pages.test.tsx` if the key checks need it)
- `web/e2e/jira.spec.ts` (one new path, with the fake Jira used there today)
- `README.md` (one line in the Jira section), `docs/tasks/N1-*.md`, `docs/status.md`

## Out of scope

- Clickable header steps (N2).
- Asking before leaving Page 3 when it has changes (N2).
- Any API, contract or prompt change. No Claude call on this path: no generated title, no translation.
- Pre-selecting the Jira issue type from Bug/Feature on this path (there is no ticket type).

## Decisions (human, 2026-11-24)

1. Description = the Page 1 text (trimmed). Summary starts **empty**; Create stays disabled until the user writes one (today's rule).
2. Not connected → the Connect panel first, then Page 3 (today's Page 3 behaviour, reused).

## Acceptance criteria

- [ ] Page 1 shows a **Go to Jira** button (en and uk texts) near Generate. It is disabled when the transcript box is empty or blank, while a recording, transcription, translation or generation is running, and when Jira is not configured (same `jiraNotConfigured` tooltip as on Page 2).
- [ ] The Jira status is asked when Page 1 first shows (a failed call leaves the button disabled, as on Page 2), and asked again on click, as `openJira` does today.
- [ ] Clicking it opens Page 3 with Description = the Page 1 text and Summary empty. The issue type is not pre-selected from a ticket type; remembered project/issue-type choices still apply.
- [ ] Not connected: the Connect panel shows; after connecting, Page 3 shows with that description. Cancel on the panel returns to Page 1 with the text unchanged.
- [ ] On Page 3 opened from Page 1, the back button reads **Back to report** (en, uk) and returns to Page 1 with the text unchanged. Opened from Page 2, it still reads **Back to ticket** and returns to Page 2 with its edits (unchanged behaviour).
- [ ] Opening Page 3 from Page 1 does not show an older generated ticket: a ticket from an earlier Generate is dropped (Page 1's Generate replaces it anyway).
- [ ] The header shows step 3 as active on this path.
- [ ] Creating the issue works the same as from Page 2 (the API call is unchanged).
- [ ] Tests: Vitest for the button states, the description/summary handed to Page 3, the Back label and target, Cancel on the Connect panel; one Playwright path in `jira.spec.ts`.

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

- Local (`npm run dev` + API): type text on Page 1 → Go to Jira → connect → description filled, summary empty → write a summary → Create. Back to report keeps the text. Repeat with the UI in Ukrainian.

## Gate

None.

## Notes

- Page 3's `ticketType` prop is used to pre-select Bug/Feature issue types; make it optional and skip that step when absent.
- ELEKS UI: load the `eleks-ui-design-system` skill before touching components; reuse the button style of Page 2's Go to Jira.
- P1 text may be plain prose; it goes into the description as is (no wiki rendering).

## Log

### Plan
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
