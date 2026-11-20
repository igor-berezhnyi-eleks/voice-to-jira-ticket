# L2 — Translate Page 2, Page 3, Connect panel and errors

- **Milestone:** M8
- **Status:** todo
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

- [ ] Page 2 field labels, buttons, dialogs, the type picker, notices and the missing-information panel are translated.
- [ ] Page 3 and the Connect panel are translated, including Jira error messages produced by the web app.
- [ ] Tests render Page 2 and Page 3 in `uk` and check that known English UI strings are absent.
- [ ] Existing tests still pass; any test that matched English text either uses the dictionary or stays explicitly in `en`.
- [ ] `node scripts/check.mjs` passes.

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
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
