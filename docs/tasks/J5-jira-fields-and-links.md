# J5 — Jira frontend: fields, links and remembered choices

- **Milestone:** M7
- **Status:** done
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

1. Tests first: `fieldValues.test.ts` (draft → `FieldValue`, filled check), `FieldInput.test.tsx` (one control per kind, labels reject spaces), `jiraPreferences.test.ts` (round trip, bad JSON, storage that throws, no text stored), extended `CreateInJiraPage.test.tsx` (required gate and reason, unsupported notice, add/remove field, keep/drop on type change, field-level errors, links, remembered choices, Forget), and the e2e test (required option field + link, mocks).
2. New in `web/src/jira/`: `fieldValues.ts` (draft type, `blockingFields`, `isFilled`, `toFieldValue`), `FieldInput.tsx`, `FieldsSection.tsx` (replaces `JiraFieldsArea.tsx`, which is deleted), `LinksSection.tsx`, `jiraPreferences.ts` (a small store class: localStorage, try/catch, sanitised on read). `jiraApi.ts` gets `getLinkTypes`.
3. `CreateInJiraPage.tsx`: field drafts and added optional fields live in the page; they are pruned when a type's fields load (same `fieldId` and still allowed → kept, others dropped with a notice). Link types load on the first "Add link". Remembered choices are written only on the user's own choices (project, type per ticket type, link type, added fields), never for auto-selection.
4. Open design points settled here (no plan change): a link row without an issue blocks Create with a reason; required fields that have a default are offered under "Add field"; the link-type select lists `outward` then `inward` phrases (one entry when both are equal); the "(coming in J5)" test of J4 is replaced.
5. ⚠ VERIFY: none (no new external facts; field input formats are J6's).

### Decisions

- No new dependency. `JiraFieldsArea.tsx` is deleted; `FieldsSection.tsx` replaces it and `blockingFields` moved to `fieldValues.ts` (new helper file in the task's folder: draft type, filled check, draft → `FieldValue`).
- Preferences live in `PreferenceStore` (key `vtt.jira.preferences`, `version: 1`, sanitised on read). Only the user's own picks are written (project, issue type per ticket type, link type, added fields), never auto-selection, so a fresh visit leaves storage empty. A changed project resets the issue type so that project's remembered or suggested type applies.
- Link types load on the first "Add link" (not with the page), so pages that never add a link make no extra call. A link row without an issue blocks Create, with the reason shown.
- Carry-over on a loaded field list (`pruneDrafts`): a value is kept when the new list has the same `fieldId`, a supported kind of the same shape, and (for option kinds) the value is still allowed; everything else with content is dropped and named in a notice. This also applies on a project change. Remembered optional fields are restored when their field exists and is addable.
- Required fields that have a default are offered under "Add field" (they are not blocking).
- A text input removes newlines itself, so the labels input only has to refuse spaces and tabs.

### Verified

- `npm run lint`: 0 errors (1 warning in the generated `jiraContract.ts`, unchanged). `npm test`: 25 files, 358 tests pass. `npm run build`: ok. `npm run e2e`: 5 of 5 pass (new Jira test: required option field + link, mocks). `node scripts/check.mjs`: all checks passed.

### Not verified

- Nothing was run against a real Jira (J6): the field input formats and the link direction meaning stay as in J3's log. The manual check below is the human's.
### Reviews

- 2026-11-12, round 1: APPROVE, 0 blocker, 0 major, 1 minor (a missing space in `jiraApi.ts`, fixed).

### Notes for the study

- Built test-first in one pass; the unit tests passed on the first run. The human gave no corrections. The harness (lint) caught two style errors (a non-null assertion, a dynamic delete) and the typing of test tables; a jsdom detail (text inputs strip newlines) showed up only in a test.
- Reviewer APPROVE in round 1 with one cosmetic finding, a missing space the agent introduced itself.
- A heredoc append failed once in the shell; writing the text to a scratchpad file and appending it worked.
- The human's manual check against `SCRUM` is not reported separately; approval came by running `/finish-task`. Nothing was run against a live Jira.
