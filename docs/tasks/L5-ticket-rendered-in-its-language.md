# L5 — Ticket rendered in its language

- **Milestone:** M8
- **Status:** done
- **Depends on:** L2, L4 done
- **Plan sections:** `docs/language-plan.md` 2 (D19), 5 (Web)
- **Parallel-safe with:** L6, L8

## Goal

A Ukrainian ticket's preview, copied text and Jira description use Ukrainian labels and show `Не вказано` for gaps, whatever the UI language is.

## Files

- `web/src/ticket/render/**`, `web/src/ticket/convertTicket.ts`, `web/src/ticket/notProvided.ts` (display only), the Page 2 field inputs where the marker is shown
- `web/src/i18n/**` (a "ticket labels" section per language)
- `web/src/App.tsx` (Jira draft) only if needed
- related tests
- `docs/tasks/L5-*.md`, `docs/status.md`

## Out of scope

- Translating the ticket. Changing the contract or the marker. Page 2 UI chrome (L2).

## Acceptance criteria

- [ ] Plain and Jira wiki renderers take labels from `ticket.language`'s dictionary and fall back to English for an unknown code (tests for `en`, `uk` and an unknown code).
- [ ] `"Not provided"` displays as the ticket language's phrase in the preview, the copy and the Page 2 inputs. Editing and the highlight work as before, and the edited value saved back is the contract marker until the user types content.
- [ ] Type conversion (D16) writes its appended lines in the ticket's language.
- [ ] Save as JSON keeps the contract shape (`"Not provided"`, `language`).
- [ ] With the UI in English and a Ukrainian ticket, the UI labels are English and the preview is Ukrainian, and the other way round.
- [ ] `node scripts/check.mjs` passes.

## Verification

```
cd web && npm run build && npm test && npm run lint
node scripts/check.mjs
```

Manual check for the human: a Ukrainian ticket (fake generator, Cyrillic text) previewed in both UI languages; copy into Jira and check the wiki markup.

## Gate

None.

## Log

### Plan

1. `i18n/en.ts` and `uk.ts` get a `ticketLabels` group (`notProvided`, `type`, `fields` by path). New `i18n/ticketLabels.ts`: `ticketLabels(code)` returns that group for `ticket.language`, English for an unknown code.
2. Tests first: `plain.test.ts`, `jiraWiki.test.ts`, `convertTicket.test.ts`, `editedTicket.test.ts`, a new `ticketLabels.test.ts`, and `TicketPage.test.tsx` (Ukrainian ticket in English UI and the reverse; input shows `Не вказано`, Save as JSON keeps `Not provided` and `language`).
3. `editedTicket.ts`: `ticketSections` takes labels from `ticket.language` and shows the marker as the ticket language phrase; `editedTicket` maps the localised phrase back to the contract marker (so Copy, JSON and the Jira draft stay consistent).
4. `plain.ts`, `jiraWiki.ts` ("Type" label and empty-list phrase), `convertTicket.ts` (appended labelled lines) use the ticket language labels.
5. `TicketPage.tsx` `TextInput`: shows the localised phrase for the marker; typing the phrase back stores the marker. State keeps the contract marker.
6. `App.tsx` needs no change (it reads the contract marker from the edited ticket). No contract, marker or Page 2 chrome change. Nothing to VERIFY.
### Decisions

- Ticket labels are a `ticketLabels` group in each dictionary (`notProvided`, `type`, `fields` by path), looked up by `ticket.language` in `i18n/ticketLabels.ts` (English for an unknown code). Page 2 input labels stay in the UI language (`fieldLabels`).
- Page 2 state keeps the contract marker. The text box shows the ticket language phrase for it; typing the phrase on its own stores the marker again (`storeGap`), and `editedTicket` does the same, so Copy, Save as JSON and the Jira draft stay contract-shaped.
- The type name (`Bug`, `Feature`) stays English in the preview (L2 decision); only the label `Type`/`Тип` is translated.
- Files outside the list: new `ticket/TicketPage.language.test.tsx` and `i18n/ticketLabels.ts` (both inside the globs of the task: ticket and i18n).
### Verified

- `npm run build`, `npm test` (29 files, 431 tests), `npm run lint`: pass. `node scripts/check.mjs`: all pass.
### Not verified

- `npm run e2e` not run. (The human did the manual check and the Ukrainian check, both fine; see Notes.)
### Reviews

- 2026-11-20, round 1: APPROVE. 0 blocker, 0 major, 0 minor.
### Notes for the study

Built test-first in one pass (labels, renderers, conversion, read-out, Page 2 input, a page-level test file). A shell-escaped scripted edit failed on `\n`, so the agent switched to direct edits. Reviewer APPROVE in round 1 with no findings. The human's manual check (both UI languages, wiki markup in Jira) and Ukrainian check passed with no changes. No e2e run.
