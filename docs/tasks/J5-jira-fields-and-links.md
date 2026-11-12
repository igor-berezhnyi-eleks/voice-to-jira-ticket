# J5 — Jira frontend: fields, links and remembered choices

- **Milestone:** M7
- **Status:** todo
- **Depends on:** J4
- **Plan sections:** `docs/jira-plan.md` 2 (remembered choices), 4.2, 4.3, 4.4, 6 (`jira_rejected` UI), 13 (unsupported fields)
- **Parallel-safe with:** none

## Goal

On Page 3 the user can fill every required field the issue type has, add optional fields of the supported kinds, and add links to other issues with a chosen link type and direction. The page remembers the user's choices per project. Projects with extra required fields can now be used.

## Files

- `web/src/jira/*` (new: `FieldInput.tsx` (one control per `kind`), `FieldsSection.tsx`, `LinksSection.tsx`, `jiraPreferences.ts` (localStorage with try/catch), tests; changes to `CreateInJiraPage.tsx`, `jiraApi.ts`)
- `web/e2e/*`
- `web/src/styles.css`
- `docs/tasks/J5-jira-fields-and-links.md`, `docs/status.md`

## Out of scope

- New field kinds beyond plan 4.2, and autocomplete for big lists. Server changes (if a server gap shows up, stop and ask).
- Storing ticket text, field values or anything about the credential in browser storage.

## Acceptance criteria

- [ ] Required fields without a default are always shown, each with the control for its `kind`:
  - `text` → input
  - `textarea` → textarea
  - `number` → number input
  - `date` → date input
  - `option` → select
  - `options` → multi-select
  - `labels` → tag input that rejects spaces
  Create stays disabled, with the reason shown, until all are filled.
- [ ] A required `unsupported` field without a default shows the blocking notice from plan 4.2, naming the field, and Create stays disabled.
- [ ] "Add field" lists the optional, supported fields not yet shown, and an added field can be removed. Changing the issue type keeps the values of fields the new type also has (same `fieldId`) and drops the others, with a short notice.
- [ ] Links: "Add link" (up to 5) has a link-type select showing both directions as phrases from `inward` and `outward` (e.g. "blocks" and "is blocked by"), preselected from the remembered type or `isDefault`, and an issue search across projects using `IssueSearch` from J4. A link can be removed.
- [ ] Create sends `fields` as typed `FieldValue`s and `links` with `typeName`, `direction` and `issueKey`. Jira's `errors` for a field id appear next to that field. A `jira_link_failed` warning names the issue that failed.
- [ ] `jiraPreferences.ts` remembers per project the issue type per ticket type, the last link type and the optional fields added, plus the last project. "Forget my Jira choices" clears them. Tests cover storage that throws, which leaves the page working without memory, and show no ticket text or values are stored.
- [ ] Vitest covers each kind's control and value, the required gate, the unsupported notice, add and remove of fields and links, keeping fields on type change, field-level errors and preferences. The Playwright test fills a required option field and adds a link, with mocks.
- [ ] `npm run lint`, `npm test`, `npm run build`, `npm run e2e` and `node scripts/check.mjs` pass.

## Verification

```
cd web && npm run lint && npm test && npm run build && npm run e2e
node scripts/check.mjs
```

Manual check for the human:

- In `SCRUM`, create an issue with a priority, a label and a link to another issue. Reload the page and check that the type and link type are remembered. Delete the test issue in Jira.
- If you can, make a field required for one issue type in a test project and check the required gate.

## Gate

None.

## Notes

- The field controls only know `kind` and `allowedValues`, never Jira field ids. That is what keeps the page general.

## Log

### Plan
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
