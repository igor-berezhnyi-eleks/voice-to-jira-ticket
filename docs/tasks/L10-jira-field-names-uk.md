# L10 — Ukrainian names for Jira fields on Page 3

- **Milestone:** M8 Languages (human request 2026-11-26)
- **Status:** todo
- **Depends on:** L2 (translated Page 3), J5 (Page 3 fields)
- **Plan sections:** `docs/tasks/L2-translate-remaining-ui.md` (what stays English); `docs/jira-plan.md` (Page 3 fields)
- **Parallel-safe with:** N4. Not with N3 (both touch `CreateInJiraPage.tsx` and the dictionaries).

## Goal

With the UI in Ukrainian, Page 3 no longer shows English labels that the app can name itself. Today the Jira field names (**Priority**, **Environment**, …) come from Jira as received, in English; after this task the well-known Jira system fields are shown with Ukrainian names, and any other English UI text left on Page 3 is translated.

## Files

Create or change only these. Anything else: ask first.

- `web/src/jira/FieldsSection.tsx`, `FieldInput.tsx` (+ `FieldInput.test.tsx`): show the translated field name
- `web/src/jira/fieldNames.ts` (+ `fieldNames.test.ts`, new): Jira system field id → dictionary key
- `web/src/jira/CreateInJiraPage.tsx`, `ConnectPanel.tsx`, `LinksSection.tsx`, `IssueSearch.tsx`: only if the sweep finds hard-coded English
- `web/src/i18n/en.ts`, `uk.ts`, `web/src/i18n/pages.test.tsx`
- `docs/tasks/L10-*.md`, `docs/status.md`

## Exceptions that stay as they are (L2, human decisions)

- Ticket type names **Bug** and **Feature** stay English in Ukrainian.
- Jira issue type names, project names, link type names and **custom field** names come from Jira and are not translated.
- Server `validation` text and Jira's own messages (field errors, rejection messages, the Server sign-in hint) are shown as received.
- The ticket content, preview and `render/**` are not translated by this task.

## Out of scope

- Any API or contract change; the field id sent to Jira does not change, only the label shown.
- Translating Jira data the user chooses from (projects, issue types, users, versions, components).

## Acceptance criteria

- [ ] Sweep: Page 3, the Connect panel, the links section and issue search are rendered in `uk` with the fake Jira; every English string found is either translated or listed in the log as one of the exceptions above.
- [ ] Known Jira **system** fields are shown with a dictionary name, matched by `fieldId` (not by the English name): at least `priority`, `environment`, `labels`, `components`, `fixVersions`, `versions`, `duedate`, `assignee`, `reporter`, `timetracking` (the final list is checked against the fields the fake Jira and the test Jira return; record it in the log). The same name is used in the field label, the "Add field" list, the "requires field" warning and the remove button's label.
- [ ] Custom fields (`customfield_*`) and system fields not in the list keep Jira's name.
- [ ] In English the labels are unchanged (Jira's name, or the same English word).
- [ ] Jira's field error messages keyed by field id still show next to the right field.
- [ ] Tests: `fieldNames.test.ts` (known id → name in en/uk, unknown id → Jira's name); `pages.test.tsx` checks that `Priority` and `Environment` are absent from Page 3 in `uk`.

## Verification

```
cd web
npm run lint
npm test
npm run build
```

`node scripts/check.mjs`

Manual check for the human:

- UI in Ukrainian, connect to the test Jira, open Page 3: Priority, Environment and the other added fields read in Ukrainian; a custom field keeps its Jira name; creating an issue still works.

## Gate

None.

## Open question for the human (ask at the start)

- Priority **values** (Highest, High, Medium, Low, Lowest) are Jira data and stay English by the L2 rule. Should the standard ones be translated in the list too (the id sent to Jira stays the same)? Suggested: no, keep the L2 rule; only field names.

## Notes

- Jira returns field names in the Jira user's own language; a Jira account set to Ukrainian already sends Ukrainian names. Translating by `fieldId` makes the label follow the app's language instead; note this in the log.
- Load the `eleks-ui-design-system` skill before touching components.

## Log

### Plan
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
