# L5 — Ticket rendered in its language

- **Milestone:** M8
- **Status:** todo
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
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
