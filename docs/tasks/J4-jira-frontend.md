# J4 — Jira frontend: Connect panel and Page 3 core

- **Milestone:** M7
- **Status:** done
- **Depends on:** J3 (contract generated)
- **Plan sections:** `docs/jira-plan.md` 2, 3 (what the user is told), 4.1, 4.5, 4.6, 6 (UI column); implementation plan 3 (D3, D10), 4.8
- **Parallel-safe with:** none (J5 extends the same files afterwards)

## Goal

From Page 2 the user can connect to Jira and create the issue on Page 3. They choose the project and issue type, edit the summary and description, and pick a parent when the hierarchy allows one. They then see the new key with a link. Errors show plain messages, and Back returns to Page 2 with edits kept. Extra fields and links come in J5.

## Files

- `web/src/jira/*` (new: `jiraApi.ts`, `ConnectPanel.tsx`, `CreateInJiraPage.tsx`, `IssueSearch.tsx` (used for the parent here and for links in J5), `jiraErrorMessages.ts`, tests)
- `web/src/App.tsx` (third page state; Page 2 edits kept while on Page 3)
- `web/src/ticket/TicketPage.tsx` (the button: enabled from `GET /api/jira/status`, calls `onConnectJira` with the edited ticket and its Jira wiki text)
- `web/src/ticket/TicketPage.test.tsx`, `web/src/App.test.tsx`
- `web/e2e/*` (a Jira flow with `page.route` mocks)
- `web/src/styles.css`
- `docs/tasks/J4-jira-frontend.md`, `docs/status.md`

## Out of scope

- Required and optional extra fields, links, remembered choices (J5). With J4 alone, an issue type whose fields include a required field without a default shows "This issue type needs more fields (coming in J5)", and Create stays disabled.
- Any router, state library or UI kit (D3). Server changes. Real Jira in tests.

## Acceptance criteria

- [ ] With `enabled: false`, the button stays disabled with the tooltip "Jira is not configured". With `enabled: true`, it's active.
- [ ] Not connected → Connect panel with an email field, an API token field (`type=password`, `autocomplete="off"`), a link to the Atlassian API token page (URL ⚠ VERIFY from the "Manage API tokens" support page), the short notice from plan section 3, and Connect / Cancel. Success shows "Connected as <name>" and opens Page 3. `jira_auth_denied` shows the "token without scopes" hint. The token field is cleared after any attempt.
- [ ] Page 3:
  - Project dropdown (`defaultProjectKey` preselected if set).
  - Issue type dropdown from the project's types, with the suggested type for the ticket type preselected and changeable.
  - Summary prefilled from Page 2.
  - Description textarea prefilled with the Jira wiki text Copy would copy, both editable, with "Reset to preview".
  - Parent search shown only when `parentTypeIds` is non-empty, searching only those types in the project, with a "No parent" option.
  - Changing the project or type reloads types or fields and drops a parent that no longer fits.
- [ ] Create disables itself while running. On success it shows the key as a link (`target=_blank`, `rel=noopener`) plus "Create another", and every warning in `warnings`. On `jira_rejected` it shows Jira's messages, with messages for `summary` or `description` next to those fields. A `jira_timeout` on create says the issue may exist and to check Jira first.
- [ ] `jira_auth_required` on any call shows the Connect panel and keeps the Page 3 values. Disconnect calls `DELETE /session`.
- [ ] Back from Page 3 returns to Page 2 with its edits unchanged.
- [ ] Vitest covers the panel, each Page 3 state (loading, no types, parent shown or hidden, success, warning, each error) and the error mapping, and Playwright covers connect → change type → pick parent → create → link shown, with mocks.
- [ ] `npm run lint`, `npm test`, `npm run build`, `npm run e2e` and `node scripts/check.mjs` pass.

## Verification

```
cd web && npm run lint && npm test && npm run build && npm run e2e
node scripts/check.mjs
```

Manual check for the human:

- In the browser against `SCRUM`: one ticket of each type, with edited summaries, one with a parent. Check both in Jira, then delete them.

## Gate

None.

## Notes

- Keep the field area of Page 3 a separate component, so J5 only adds to it.

## Log

### Plan

1. Tests first: `jiraErrorMessages.test.ts`, `jiraApi.test.ts` (status, session, 204 delete, error extensions `errors`/`errorMessages`/`retryAfterSeconds`), `ConnectPanel.test.tsx`, `CreateInJiraPage.test.tsx` (loading, no types, parent shown/hidden, success, warnings, each error, auth-required keeps values, Back), then `TicketPage`/`App` tests for the button and Page 2 edits kept.
2. `web/src/jira/jiraApi.ts`: own `send` (the one in `api.ts` is private and cannot read a 204); `JiraApiError extends ApiError` carries `fieldErrors`, `messages`, `retryAfterSeconds`. Types come from `jiraContract.ts`.
3. `jiraErrorMessages.ts`, `ConnectPanel.tsx`, `IssueSearch.tsx` (debounced POST search, "No parent" handled by the page), `JiraFieldsArea.tsx` (separate component; J4 only shows the "needs more fields (coming in J5)" notice), `CreateInJiraPage.tsx`.
4. `App.tsx`: third page `jira`; `TicketPage` stays mounted but hidden on Page 3, so its edits survive Back. App fetches `GET /api/jira/status` once when Page 2 first shows and passes `jiraEnabled` to `TicketPage` (a prop, so the many fetch-count tests of `TicketPage` stay valid). `TicketPage` gets `jiraEnabled` and `onConnectJira(ticket, wikiText)`.
5. `App.test.tsx` fetch mocks that rely on call order become URL-aware (the status call is new). Playwright: `web/e2e/jira.spec.ts` with `page.route`.
6. ⚠ VERIFY: Atlassian "Manage API tokens" page URL.

### Decisions

- ⚠ VERIFY done: the Atlassian token page is `https://id.atlassian.com/manage-profile/security/api-tokens` (support page "Manage API tokens for your Atlassian account", fetched 2026-11-12).
- `jiraApi.ts` has its own `send`: the one in `api.ts` is private and cannot read a 204. `JiraApiError extends ApiError` (no edit to `api.ts`).
- Page 3 results (types, fields, parent, search hits) are stored with the choice they belong to and read only while that choice is current. The lint rule `set-state-in-effect` forbids resetting state in effects; this also means a changed project or type never shows an old answer. The parent is dropped on any project or type change.
- `TicketPage` takes `jiraEnabled` and `onConnectJira` as props; `App` asks `GET /api/jira/status` once when Page 2 first shows and again on click (the session may have ended). This kept the many fetch-count tests of `TicketPage` valid. `App.test.tsx`'s Regenerate test became URL-aware, because the status call is new.
- `TicketPage` stays mounted (hidden) while Page 3 shows, so its edits survive Back. Page 3 itself starts fresh each time it is opened.
- Jira session loss on create shows the Connect panel only (no error on the form); the Page 3 state stays in the component.
- Test support `web/src/jira/fakeJira.ts` (fetch router) is a new file inside the J4 folder.

### Verified

- `cd web && npm run lint`: 0 errors (1 warning in generated `jiraContract.ts`, existing). `npm test`: 284 passed. `npm run build`: ok. `npm run e2e`: 4 passed (new `jira.spec.ts` plus the 3 smoke tests). `node scripts/check.mjs`: all passed.

### Not verified

- The human's manual check against `SCRUM` was reported done (2026-11-12, "Manual check done"); the agent ran nothing against a real Jira, and the live check is J6. The Atlassian page itself was not opened in a browser, the URL comes from the support page text.
### Reviews

- 2026-11-12, round 1: APPROVE, 1 minor (status.md not yet updated, done at hand-over), 0 major, 0 blocker.
### Notes for the study

- Built test-first in one pass; lint (`set-state-in-effect`) forced a redesign of how Page 3 holds loaded data, which the agent fixed itself before the first review.
- An existing test with an ordered fetch mock broke by design (new status call); the agent rewrote it URL-aware and logged it.
- Reviewer APPROVE in round 1, one minor (bookkeeping). The human's manual check against SCRUM was reported done without details.
