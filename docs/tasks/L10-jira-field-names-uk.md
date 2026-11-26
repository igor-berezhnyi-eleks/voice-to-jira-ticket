# L10 — Ukrainian names for Jira fields on Page 3

- **Milestone:** M8 Languages (human request 2026-11-26)
- **Status:** done
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

- New `web/src/jira/fieldNames.ts`: the list of known Jira system field ids and `fieldName(field, t)` → the dictionary name for a known id, else Jira's name. Test first in `fieldNames.test.ts`.
- Dictionaries: `jira.fieldNames`, the full map in `uk` (`satisfies` the id list, so a missing name fails the build). *(Superseded: the plan had `null` in `en` to keep Jira's name; the human chose dictionary words in English too, see Decisions.)*
- Use `fieldName` everywhere a field name is shown: `FieldInput` (label, remove button), `FieldsSection` ("requires field" warning, "Add field" list), `CreateInJiraPage` (the "fill in required fields" reason, the "dropped" notice, page-level field errors for fields not shown).
- Tests: `FieldInput.test.tsx` (uk label + remove label, custom field unchanged), `pages.test.tsx` (Priority/Environment absent in uk, custom field kept, field error next to the right field).
- Sweep the four Page 3 components for hard-coded English; no ⚠ VERIFY facts (no external API change). The field ids are checked against the server's metadata mapper and the fakes; the test Jira list is for the human's manual check.
### Decisions

- **Priority values stay English** (human, 2026-11-26, open question answered "No, names only"): only field names are translated; option values are Jira data (L2 rule).
- **English uses dictionary words too** (human, 2026-11-26): `en.jira.fieldNames` holds Jira Cloud's English names, so the label follows the app's language rather than the Jira account's. Effects: on Server/Data Center "Fix Version/s", "Affects Version/s", "Component/s" show as "Fix versions", "Affects versions", "Components"; a Jira account set to Ukrainian (or German) shows English names in the English UI. A first try with `null` in `en` (keep Jira's name) broke the dictionary shape test (`i18n.test.tsx`).
- **Out-of-list file, approved by the human:** `web/src/jira/CreateInJiraPage.test.tsx` fixture: the fake `environment` field was named "Env"; renamed to "Environment" (2 lines). The test checks the same behaviour; it is not weakened.
- **Final id list** (`web/src/jira/fieldNames.ts`): `priority`, `environment`, `labels`, `components`, `fixVersions`, `versions`, `duedate`, `assignee`, `reporter`, `timetracking`. Checked against the web fakes (they use `priority`, `environment`, `labels`, `components`, `duedate`) and the server mapper (`CreateMetadataMapper.cs`: `reporter` is never shown, kept for safety; `assignee` is a user field, so it shows only in the "requires field" warning; `timetracking` likewise). Not checked against the test Jira (see Not verified).
- Ukrainian names: Пріоритет, Середовище, Мітки, Компоненти, Версії виправлення, Версії, яких стосується, Термін виконання, Виконавець, Автор, Облік часу (for native-speaker review).
- The name is also used in the "Fill in the required fields" reason, the "dropped" notice and the top-of-page message for a Jira field error on a field that is not shown (`priority: …` → `Пріоритет: …`), so a field has one name everywhere (`CreateInJiraPage.tsx`).
- Note: Jira returns field names in the Jira user's own language; translating by `fieldId` makes the label follow the app instead.
- Sweep result: no hard-coded English in `CreateInJiraPage.tsx`, `ConnectPanel.tsx`, `LinksSection.tsx`, `IssueSearch.tsx` (only ids, keys, URLs, comments). English that stays, by the exceptions: "Cloud" and "Server / Data Center" (product names, as in L2), project / issue type / link type / custom field names, option values, Jira's messages.
### Verified

- `npm run lint`: pass. `npm test`: 32 files, 521 tests pass (new: `fieldNames.test.ts` 4, `FieldInput.test.tsx` +2, `pages.test.tsx` +2). `npm run build`: pass (usual chunk-size warning).
- `node scripts/check.mjs`: all checks passed.
### Not verified

- The field list against the **test Jira**: no Jira credentials in this session. The human's manual check covers it.
- Browser check of Page 3: it needs a Jira connection; covered by component tests with the fake Jira only.
- Both were then covered by the human's manual check on the test Jira (2026-11-26): all good. Which system fields that Jira returned was not reported to the agent.
### Reviews

- 2026-11-26, round 1: APPROVE; 0 blocker, 0 major, 1 minor (plan bullet still described the dropped `null` design; fixed).
### Notes for the study

- The human made two decisions: the open question on priority values was asked at the start, and English dictionary words were chosen when an existing test broke. The agent stopped and asked rather than edit the out-of-list test on its own.
- The harness caught the first design: the dictionary shape test (`i18n.test.tsx`) and lint (`no-non-null-assertion`) rejected the `null`-in-English approach before review.
- Reviewer APPROVE in round 1; its one minor finding was a stale plan bullet, i.e. the log drifting from the code after a mid-task design change.
