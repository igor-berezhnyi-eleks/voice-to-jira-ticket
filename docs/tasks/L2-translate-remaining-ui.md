# L2 — Translate Page 2, Page 3, Connect panel and errors

- **Milestone:** M8
- **Status:** done
- **Depends on:** L1 done
- **Plan sections:** `docs/language-plan.md` 7
- **Parallel-safe with:** L3, L4, L6, L8

## Goal

Every UI string outside Page 1 follows the selected language.

## Files

- `web/src/ticket/TicketPage.tsx` and the ticket UI components (labels, buttons, notices, missing-information panel). **Not** `render/**` or `convertTicket.ts` (they follow the ticket's language, L5).
- `web/src/jira/**` (UI strings, `jiraErrorMessages.ts`), `web/src/i18n/en.ts`, `uk.ts`
- related tests, `web/e2e/*` only if a selector or text changes
- `docs/tasks/L2-*.md`, `docs/status.md`

## Out of scope

- Text from Jira (project, type and field names, Jira's error messages), server `validation` details, the ticket content and preview.

## Acceptance criteria

- [x] Page 2 field labels, buttons, dialogs, the type picker, notices and the missing-information panel are translated.
- [x] Page 3 and the Connect panel are translated, including Jira error messages produced by the web app.
- [x] Tests render Page 2 and Page 3 in `uk` and check that known English UI strings are absent.
- [x] Existing tests still pass; any test that matched English text either uses the dictionary or stays explicitly in `en`.
- [x] `node scripts/check.mjs` passes.

## Verification

```
cd web && npm run build && npm test && npm run lint
node scripts/check.mjs
```

Manual check for the human: go through all three pages in Українська with the fake generator and the fake Jira; review the wording.

## Gate

None. The human reviews the Ukrainian wording at hand-over.

## Log

### Plan
Dictionaries grow groups: `fieldLabels` (Page 2 inputs by field path), `ticketPage`, `jira` (Page 3, fields, links, search), `connect`, `jiraErrors`. Components read `useT()`. `FieldInfo.label` in `fieldPaths.ts` stays English because the preview (L5) uses it; Page 2 inputs use `t.fieldLabels[path]`. Pure helpers (`describeJiraError`, `pruneDrafts` notice, `guessType` unchanged) take an optional dictionary defaulting to English, as in L1. Tests first: a new `i18n/pages.test.tsx` renders TicketPage and CreateInJiraPage (fake Jira) in `uk` and checks that known English strings are absent; `jiraErrorMessages.test.ts` gets a `uk` case. Existing tests render without a provider (English) and stay valid. Not translated: Jira data, server `validation` text, the ticket content, preview and `render/**`.
### Decisions
- No new dependency and no file outside the task's list. `FieldInfo.label` in `fieldPaths.ts` stays English because the preview and Copy still use it until L5; Page 2 inputs read `t.fieldLabels[path]` instead. `en.ts` imports the `FieldPath` type from `ticket/fieldPaths.ts`.
- New dictionary groups: `fieldLabels`, `ticketPage`, `jira`, `connect`, `jiraErrors`. `describeJiraError(error, action, t = en)` takes the dictionary like the L1 helpers, so existing tests stay in English.
- Ticket type names are kept in English in Ukrainian too (`Bug`, `Feature`; human decision at the manual check, 2026-11-20: the English words are what people use). The `typeNames` keys stay so another language can translate them. Jira issue type names come from Jira and are not translated.
- `CreateInJiraPage` reads the dictionary through a ref for loads and error texts. Without it, a language switch on Page 3 would change `handleFailure` and re-run the project, type and field loads (and the field effect prunes drafts). Texts on screen still follow the switch.
- The Connect "reason" line and the session-ended text share one string (`jiraErrors.authRequired`), replacing the `SESSION_ENDED` constant.
- Server `validation` text and Jira's own messages (`failure.message` in the Server sign-in hint, rejection messages, field errors) are shown as received, in English.
- Ukrainian wording is the agent's and is not yet reviewed by a native speaker.
### Verified
- `cd web && npm run build`: pass. `npm test`: 27 files, 413 tests pass (17 new in `i18n/pages.test.tsx`: Page 2, Page 3 with required, unsupported, optional and link fields, Connect panel for Cloud and Server, Jira error messages and plural forms). `npm run lint`: pass. `node scripts/check.mjs`: all passed.
### Not verified
- No browser check by the agent; the manual check is the human's. `npm run e2e` not run (English texts are unchanged).
- Wording of `uk.ts` not reviewed by a native speaker beyond the human's manual check (passed 2026-11-20, one change: type names stay English).
### Reviews
- 2026-11-20, round 1: APPROVE, 1 minor (stray untracked `web/tsconfig.tsbuildinfo`; deleted).
### Notes for the study
- Agent work: built in one pass with scripted edits (a Node helper that keeps CRLF); a shell heredoc with quotes failed once and the script was written with the file tool. Three of the agent's first new tests failed on test mistakes (preview text is English until L5, no confirmation without edits, reasons joined), not on code.
- Reviewer caught only a stray build file. The agent itself caught that putting the dictionary in effect dependencies would refetch Jira data on a language switch.
- Human correction at the manual check: ticket type names stay English («Bug», «Feature»); the wording of the rest passed.
- Harness: the Stop gate and check.mjs stayed green throughout.
