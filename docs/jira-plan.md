# Jira integration plan (M7)

Status: **draft, waiting for the "Jira plan approved" gate** (task J0). Written 2026-11-12, revision 2 (same day): the project setup is discovered at runtime and the user can edit and add fields.

This plan adds one step after Page 2: the developer connects to Jira with their own Atlassian account and creates the reviewed ticket as an issue. It extends [implementation-plan.md](implementation-plan.md) and does not change its decisions, except that the P2 row becomes M7 (D17). Igor's Server 7.8 design (`development-plan.md` Phase 6) is the starting point. Section 11 lists where this plan departs from it.

## 1. Principle: discover, suggest, let the user decide

The app assumes nothing about a project's setup. Project style (company- or team-managed), issue type names, the hierarchy (which types can be a parent), required fields and link types differ between Jira sites and projects. The app does three things instead:

1. **Discover** each project's setup from Jira when the user picks the project: create metadata, issue types with their hierarchy level, fields per issue type, and link types.
2. **Suggest** defaults: an issue type matching the ticket type, the summary and description from Page 2, and the link type "Relates" if the site has it. Configuration gives the preferred names, and the browser remembers the user's last choices per project.
3. **Let the user decide** on Page 3: change the issue type, edit the summary and description, fill required fields, add optional fields, pick a parent and add links.

Jira validates the create itself. Its field errors are shown next to the fields they belong to.

### Test instance (for J6 only; nothing in the code depends on it)

| Fact | Value | Source |
|---|---|---|
| Product | Jira Cloud | Human, 2026-11-12 |
| Site | `https://olehhupalo.atlassian.net` | Human (board URL) |
| Project, board | `SCRUM`, board 1 | Board URL |
| Auth | Atlassian account email + API token | Human |

The project style, type names and link types of `SCRUM` no longer need checking by hand. The app discovers them, and the J6 live check exercises them. No credentials are stored in the repository. The site URL is not a secret and goes into `appsettings.Development.json` (J1). The default `appsettings.json` has no site, and Jira is off unless configured.

## 2. User flow

```
Page 2 (edited ticket)
  [Connect to Jira board]  — enabled only when Jira:Enabled = true
     │  no Jira session → Connect panel: Atlassian email + API token (password field), link to the token page
     │                     POST /api/jira/session → "Connected as <display name>"
     ▼
Page 3 (Create in Jira)
  Project      [dropdown]   last used, else Jira:DefaultProjectKey, else none chosen
  Issue type   [dropdown]   the project's non-subtask types; suggested from the ticket type
  Summary      [text]       prefilled from Page 2, editable
  Description  [textarea]   prefilled with the Jira wiki preview, editable, "Reset to preview"
  Required fields           every required field of that type without a default (Create disabled until filled)
  [+ Add field]             optional fields of supported kinds (priority, labels, components, …)
  Parent       [search]     only if the project has a type one hierarchy level above the chosen type
  Links        [+ Add link] link type (with direction, e.g. "relates to", "blocks", "is blocked by") + issue search; up to 5
  [Create issue]  → "Created SCRUM-123" with a link that opens Jira in a new tab, plus any warnings
  [Back]          → Page 2 with its edits kept (Page 3 edits are kept too while the page is open)
  [Disconnect]    → DELETE /api/jira/session
```

- Pages 1 and 2 stay anonymous. The app has no login of its own.
- The token is entered only in the Connect panel. The browser never stores it (no localStorage or sessionStorage), and the field uses `autocomplete="off"`.
- **Remembered per project in localStorage** (non-sensitive conveniences, wrapped in try/catch, and the page works without it): the last project, the issue type picked for each ticket type, the last link type and the optional fields the user added. "Forget my Jira choices" clears them. No ticket text is stored.
- A Jira 401 at any step clears the session and shows the Connect panel again. Page 3 values are kept.
- After a successful create, the Create button is replaced by the result. A second create needs "Create another", so a double click can't make duplicates.
- Editing on Page 3 does not change Page 2. Going Back and changing Page 2 resets the Page 3 summary and description only if the user hasn't edited them there (otherwise "Reset to preview" is offered).

## 3. Authentication and the session cookie

- **Scheme** (⚠ VERIFY done, see section 12): HTTP Basic, `Authorization: Basic base64(email:api_token)`, against the site URL. This works with **classic (unscoped) API tokens**. Scoped tokens only work through `https://api.atlassian.com/ex/jira/{cloudId}` and are out of scope. The Connect panel says to create a token without scopes, and a 401 shows that hint.
- **Login check:** `POST /api/jira/session {email, apiToken}` calls `GET /rest/api/2/myself`. A 200 creates the session and returns `{displayName}`. A 401 returns `jira_auth_denied`. Nothing is stored on failure.
- **Where the credential lives:** Basic auth has no server-side session, so every Jira call needs the token. The app keeps `{email, apiToken, issuedAt}` in one cookie protected with ASP.NET Core Data Protection (in the framework, no new package):
  - `HttpOnly`, `SameSite=Strict`, `Path=/api/jira`, and `Secure` when the request is HTTPS. The demo runs on `http://localhost`.
  - A session cookie (no `Expires`) with an absolute lifetime of `Jira:SessionHours` (default 8), checked against `issuedAt` through `TimeProvider`.
  - Data Protection keys are persisted to `DataProtection:KeysPath`. In Docker that is a named volume, `dp-keys`, so a restart doesn't log anyone out. Without the setting, keys stay in memory and a restart means connecting again.
- **CSRF:** the cookie is `SameSite=Strict`, and the Jira endpoints accept only `application/json` bodies. Cross-site form posts are therefore rejected (415) and don't carry the cookie.
- **No SSRF:** the Jira base URL comes only from configuration, never from the request.
- **What the user is told:** the token gives the app the same rights as the user in Jira, it is kept only in an encrypted browser cookie for this app, Disconnect removes it, and it can be revoked at any time in the Atlassian account.

## 4. API (new feature folder `Features/Jira/`)

All endpoints return `TypedResults`, and errors go through the existing `IExceptionHandler` (section 6). Request and response records live in `Features/Jira/Contract/`. Request validation uses the built-in Minimal API validation (D2: `AddValidation()` + DataAnnotations), like the generate endpoint.

| Endpoint | Request | Response | Jira calls |
|---|---|---|---|
| `GET /api/jira/status` | none | `{enabled, connected, displayName?, defaultProjectKey?}` | none (config and cookie) |
| `POST /api/jira/session` | `{email, apiToken}` | `{displayName}` + cookie | `GET /rest/api/2/myself` |
| `DELETE /api/jira/session` | none | 204, cookie cleared | none |
| `GET /api/jira/projects` | none | `[{key, name}]` | `GET /rest/api/2/project/search?action=create` (first page, 50) |
| `GET /api/jira/projects/{key}/issue-types` | none | `[{id, name, hierarchyLevel, suggestedFor: ["Bug"\|"Feature"]}]`, subtasks left out | `GET /rest/api/2/issue/createmeta/{key}/issuetypes` |
| `GET /api/jira/projects/{key}/issue-types/{id}/fields` | none | `{fields: [JiraField], parentTypeIds: [id]}` | `GET /rest/api/2/issue/createmeta/{key}/issuetypes/{id}` (all pages, until the last) and `GET /rest/api/2/issue/createmeta/{key}/issuetypes` (for the hierarchy levels) |
| `GET /api/jira/link-types` | none | `[{name, inward, outward, isDefault}]` | `GET /rest/api/2/issueLinkType` |
| `POST /api/jira/issues/search` | `{projectKey?, issueTypeIds?, query?}` | `[{key, summary, issueType, status}]` (max 20) | `POST /rest/api/2/search/jql` |
| `POST /api/jira/issues` | `{projectKey, issueTypeId, summary, description, parentKey?, fields: {fieldId: FieldValue}, links: [{typeName, direction, issueKey}]}` | 200 `{key, url, warnings: []}` (also when links failed) | `POST /rest/api/2/issue`, then `POST /rest/api/2/issueLink` per link |

### 4.1 Issue types and the suggestion

- Subtask types (`subtask: true` or `hierarchyLevel` −1) are left out because they need a parent subtask flow the app doesn't have.
- `suggestedFor`: a type is suggested for a ticket type when its name matches, case-insensitively, the first available name in `Jira:PreferredIssueTypes:Bug` (default `["Bug", "Defect"]`) or `Jira:PreferredIssueTypes:Feature` (default `["Story", "Feature", "Task"]`). Without a match, the first type at hierarchy level 0 is suggested for both ticket types.
- The browser applies its remembered choice before the server's suggestion.

### 4.2 Fields (`JiraField`)

The server maps each create-metadata field to a small, typed shape the UI can render without knowing Jira:

```
JiraField = { fieldId, name, required, hasDefaultValue, kind, allowedValues?: [{id, name}] }
kind = text | textarea | number | date | option | options | labels | unsupported
```

| Jira `schema` | `kind` |
|---|---|
| `string` (textarea custom type, or system `environment`) | `textarea` |
| other `string` | `text` |
| `number` | `number` |
| `date` | `date` (`YYYY-MM-DD`) |
| `priority`, `option`, `component`, `version`, other single values with `allowedValues` | `option` |
| `array` of `option`, `component` or `version` with `allowedValues` | `options` |
| `array` of `string` with system `labels` | `labels` (no spaces inside a label) |
| anything else (user pickers, cascading selects, datetime, attachments, …) | `unsupported` |

- Fields the app fills itself are left out of the list: `project`, `issuetype`, `summary`, `description`, `parent`, `issuelinks`, `reporter`, `attachment`.
- **Required and unsupported, without a default:** shown as a blocking notice on Page 3 ("This issue type requires 'X', which this app can't fill. Pick another issue type or create the issue in Jira."). Create stays disabled.
- **Optional and unsupported:** not offered.
- **All pages of fields are read**, so a required field on a later page is never missed. A hard stop at 500 fields gives `jira_unavailable`. The page size and maximum of this endpoint are ⚠ VERIFY in J2.
- `allowedValues` is capped at 200 entries. A larger list is `unsupported` (an autocomplete is out of scope).
- `parentTypeIds`: the ids of the project's types whose `hierarchyLevel` is one above the chosen type's. An empty list means the Parent control is hidden.
- The exact create-metadata `schema` values for each kind and their input formats are ⚠ VERIFY in J2/J3, against the spec's `JsonTypeBean` and Atlassian's "field input formats" docs.

### 4.3 Create payload

The browser sends typed values, and the server builds Jira's shapes:

| `FieldValue` | Sent to Jira as |
|---|---|
| `{kind:"text"\|"textarea", value}` | `"value"` |
| `{kind:"number", value}` | `123.4` |
| `{kind:"date", value}` | `"2026-11-12"` |
| `{kind:"option", id}` | `{"id": "…"}` |
| `{kind:"options", ids}` | `[{"id": "…"}, …]` |
| `{kind:"labels", values}` | `["a", "b"]` |

```json
{ "fields": {
    "project":     { "key": "SCRUM" },
    "issuetype":   { "id": "10004" },
    "summary":     "<edited summary>",
    "description": "<edited Jira wiki text>",
    "parent":      { "key": "SCRUM-12" },
    "priority":    { "id": "3" },
    "labels":      ["voice"]
} }
```

- REST **v2** takes `description` as a wiki-markup string. v3 would need Atlassian Document Format.
- A field id must match `^(customfield_\d+|[a-z][a-zA-Z]*)$` and must not be one of the app-filled fields, otherwise the result is 400 `validation`. The server does not re-check against the metadata, because Jira does, and its `errors` map (field id → message) is shown next to the field.
- Limits (400 `validation`): summary 1–255 characters; description at most 32,000 characters (Jira's limit is believed to be 32,767, ⚠ VERIFY in J3); at most 30 fields and 5 links; text values at most 32,000 characters; labels without spaces; keys matching `^[A-Z][A-Z0-9_]+-\d+$`; project key matching `^[A-Z][A-Z0-9_]+$`.
- The response is `201 {id, key, self}`, and the app returns `url = <BaseUrl>/browse/<key>`.

### 4.4 Links

- After a 201, each link is created in order with `POST /rest/api/2/issueLink {type:{name}, inwardIssue:{key}, outwardIssue:{key}}`, which returns 201 with no body. `direction` is `outward` ("<new issue> blocks X": the new issue is `outwardIssue`) or `inward` ("<new issue> is blocked by X").
- A failed link never fails the request, since the issue already exists. Each failure adds `{code: "jira_link_failed", issueKey}` to `warnings`, and the UI says "Created SCRUM-124, but the link to SCRUM-12 failed; add it in Jira."
- `isDefault` on link types: the type named `Jira:DefaultLinkType` (default `Relates`) if the site has it, otherwise none. The browser's remembered link type comes first.

### 4.5 Search (parent and link pickers)

- The search is a **POST**, so the user's search text never shows up in a URL or in the `IHttpClientFactory` request log.
- JQL is built on the server from fixed parts:
  `[project = "<key>" AND] [issuetype in (<ids>) AND] [(summary ~ "<q>*" OR key = "<q>")] ORDER BY updated DESC`
  with `fields=summary,issuetype,status`, `maxResults` 20.
  - The parent picker sends the project and `parentTypeIds`. The link picker sends only the text, so any project the user can see is searched.
  - `<q>` is JQL-escaped (backslash and quote) and capped at 100 characters. The `key =` clause is added only when `<q>` is key-shaped.
  - That `summary ~ "<q>*"` does a prefix match is ⚠ VERIFY in J2. If it doesn't, the builder uses `summary ~ "<q>"`.
  - ⚠ VERIFY in J2: whether Jira rejects the whole query (400) when `key = "<q>"` names a key that doesn't exist, and which text-search characters need escaping beyond backslash and quote. If it rejects, the key is looked up separately (`GET /rest/api/2/issue/{key}?fields=summary,issuetype,status`, a 404 meaning no hit) and only the text clause goes into JQL. Reserved characters are escaped or stripped as the docs say.
  - An empty query with no project returns 400 `validation`, so the app never searches the whole site.
- The search uses the enhanced JQL endpoint. The old `/rest/api/2/search` is marked "Currently being removed" in the spec.

### 4.6 Rendering

D10 is unchanged: the browser renders the Jira wiki text. Page 3 prefills it and lets the user edit it, and the server sends the description as received without re-rendering.

## 5. Configuration

`JiraOptions` uses `IOptions<T>` with `ValidateOnStart`. When `Enabled` is true, `BaseUrl` must be an absolute https URL. All other keys are defaults and suggestions, never requirements.

| Key | Default | Notes |
|---|---|---|
| `Jira:Enabled` | `false` | When false, all `/api/jira/*` endpoints except `status` return 404 `jira_not_configured`, and the button stays disabled with the tooltip "Jira is not configured". |
| `Jira:BaseUrl` | none | `https://olehhupalo.atlassian.net` in `appsettings.Development.json`, and set by the human in `.env` for Docker |
| `Jira:DefaultProjectKey` | none | Optional preselection (`SCRUM` in Development) |
| `Jira:PreferredIssueTypes:Bug` | `["Bug", "Defect"]` | Names tried in order, case-insensitive. A configured list **replaces** the default (it does not append). |
| `Jira:PreferredIssueTypes:Feature` | `["Story", "Feature", "Task"]` | As above |
| `Jira:DefaultLinkType` | `Relates` | Preselected link type if the site has it |
| `Jira:TimeoutSeconds` | `15` | Per Jira call |
| `Jira:SessionHours` | `8` | Absolute cookie lifetime |
| `DataProtection:KeysPath` | none | `/keys` in Docker (volume `dp-keys`) |

Secrets: none in config. The user types the credential. The live test reads `VTT_JIRA_EMAIL` and `VTT_JIRA_API_TOKEN`, which the human sets in their own environment. The agent never writes them.

## 6. Errors

New `ErrorCodes`, mapped through `ApiException` and the existing handler:

| Code | Status | When | UI |
|---|---|---|---|
| `jira_not_configured` | 404 | `Jira:Enabled` false | Button disabled, so this is normally not seen |
| `jira_auth_required` | 401 | No or expired cookie, or a Jira 401 on any call (the cookie is cleared) | Connect panel |
| `jira_auth_denied` | 401 | `POST /session`: Jira rejected the email or token | "Jira did not accept this email and token. Use a token without scopes." |
| `jira_forbidden` | 403 | Jira 403 (no create or browse permission) | "Your Jira account cannot do this in this project." |
| `jira_not_found` | 404 | Jira 404 (project, issue type, parent or issue missing, or not visible to the user) | "Jira could not find that project or issue, or your account cannot see it." |
| `jira_rejected` | 422 | Jira 400 or 422, with `errors` (field id → message) and `errorMessages` passed through as extensions | Field messages next to their fields; others listed at the top of Page 3 |
| `jira_rate_limited` | 503 | Jira 429, with `retryAfterSeconds` if Jira sent `Retry-After` | "Jira is busy. Try again in a moment." |
| `jira_unavailable` | 502 | Jira 5xx, network error or unexpected body | "Could not reach Jira." with Try again |
| `jira_timeout` | 504 | Over `Jira:TimeoutSeconds` | As above; on create: "The issue may have been created. Check Jira before trying again." |

- **No automatic retries anywhere.** The create is not idempotent, and D2 excludes Polly. "Try again" is the user's choice.
- `X-Atlassian-Token: no-check` is **not** sent. The Cloud docs require it only for multipart/form-data operations, and all calls here are JSON.

## 7. Logging

- One Information line per created issue: key, issue type id, the number of extra fields and links, whether a parent was set, and the number of failed links.
- Never logged at any level: the token, the `Authorization` header, the email, the summary, the description, field values or the search text.
- `IHttpClientFactory` logs request URIs. These contain only keys, ids and fixed paths, since search text goes in the POST body.
- The Jira `accountId` may be logged at Debug.

## 8. Testing

- **Default `dotnet test`** (offline):
  - `JiraClient` runs against a stub `HttpMessageHandler`. Tests cover the Basic header, the error map for each status, 429 with and without `Retry-After`, the timeout, and exactly one create POST (no retry).
  - The metadata mapper (create metadata → `JiraField` kinds, `parentTypeIds`, `suggestedFor`), the JQL builder and the payload builder are pure functions. They are tested with recorded-shape fixtures for both a company-managed and a team-managed project, written from the spec's schemas, plus a project with an unknown type name and one with a required unsupported field.
  - Endpoint tests through `ApiFactory` with a fake `IJiraClient` check the cookie round trip and its expiry after `SessionHours` (fake `TimeProvider`). They also check `Enabled=false` for every endpoint, 415 on non-JSON, a 401 clearing the cookie, reserved and malformed field ids, and partial link failures.
  - A capturing-logger test shows that no log line contains the token, summary, description or field values.
- **Frontend (Vitest):**
  - The Connect panel.
  - Page 3 with each field kind.
  - The required-field gate, the blocking notice for an unsupported required field, Add field, the parent shown or hidden by `parentTypeIds`, and Add link with direction.
  - Remembered choices, including storage that throws.
  - Field errors placed next to their fields, the warnings, and the error mapping.
- **Playwright:** `page.route('/api/jira/**')` mocks. The tests are connect → change issue type → fill a required option field → pick a parent → add a link → create → result with a link warning. No real Jira is needed.
- **Live** (J6): `[Trait("Category","Live")]` tests that skip unless `VTT_RUN_LIVE=1` **and** `VTT_JIRA_LIVE=1`. They discover the setup of `VTT_JIRA_PROJECT` (default `SCRUM`), create one issue per ticket type using the suggested types, a parent if the hierarchy allows, and one link between the two, then print the keys. The human deletes the issues afterwards. These tests are never part of the default run.

## 9. Contract

- The Jira request and response records are exported to `contract/jira.schema.json` by a snapshot test, the same way `ticket.schema.json` is. `FieldValue` and `JiraField.kind` are discriminated unions that the generated TypeScript must type without `any`. J1 checks that `json2ts` handles the chosen shape, and changes the C# shape if it doesn't.
- `npm run gen:contract` is extended to also write `web/src/jiraContract.ts`.
- Both new generated files are added to the protected-files hook. That changes `.claude/hooks/guard-protected-files.mjs` and `web/package.json`, and it's part of J1's file list.

## 10. Tasks

Each task is one session, strictly in order (J1 → J6). Later tasks extend files earlier ones created; no two tasks run at the same time.

| Task | Content | Main files |
|---|---|---|
| **J1** Client, config, session | `JiraOptions`, typed `HttpClient`, `myself`, Data Protection cookie, `status` / `session` endpoints, error codes, `dp-keys` volume, contract export plus the gen script and hook change | `Features/Jira/*`, `Infrastructure/ErrorCodes.cs`, `Program.cs`, `appsettings*.json`, `docker-compose.yml`, `contract/jira.schema.json`, `web/package.json`, hook, tests |
| **J2** Discovery | Projects, issue types and suggestion, the field mapper, link types, issue search (JQL builder) | `Features/Jira/*` (discovery files), tests |
| **J3** Create | Payload builder with field values, create, parent, links with warnings, validation | `Features/Jira/*` (create files), tests |
| **J4** Page 3 core | Button from `status`, Connect panel, Page 3 with project, issue type, editable summary and description, parent, Create and result, App page state, error messages | `web/src/jira/*`, `web/src/App.tsx`, `web/src/ticket/TicketPage.tsx` (button only), `web/e2e/*` |
| **J5** Page 3 fields and links | Required fields, Add field for each kind, the unsupported-field notice, links with direction, remembered choices, field errors next to fields | `web/src/jira/*`, `web/e2e/*` |
| **J6** Live check and docs | Live tests, README section (setup, token, what is discovered, limits), manual demo on `SCRUM` and, if available, a second project of the other style | `tests/VoiceToTicket.Api.Tests/Jira/JiraLiveTests.cs`, `README.md`, this plan |

The task files are `docs/tasks/J1-…md` to `J6-…md`.

## 11. Changes from Igor's Server 7.8 design

| Igor (Server 7.8) | Here (Cloud) | Why |
|---|---|---|
| Session login `/rest/auth/1/session`, keep `JSESSIONID` | Basic email + API token on every call, kept encrypted in the cookie | Cloud has no cookie login for REST clients. Basic with an API token is the documented way. |
| CAPTCHA handling (`X-Seraph-LoginReason`) | Dropped | Server only |
| Epic Link custom field, found via `/field` | `parent` field, with parent types found from the hierarchy level | Epic Link is deprecated for Cloud REST, and the hierarchy works for any project style |
| Fixed rules: Story → Epic, Bug → "Relates" link to a Story | Any type gets a parent if the hierarchy allows. The user adds any links, with any link type. | Projects differ, and Cloud allows a Bug under an Epic. Human request (rev. 2). |
| Fixed issue type map | Discovered types, suggested by configured names, chosen by the user | Human request (rev. 2) |
| Summary and description only | The user edits both and fills required or optional fields of supported kinds | Human request (rev. 2) |
| `X-Atlassian-Token: no-check` | Not sent | Cloud requires it only for multipart |
| MediatR, FluentValidation, Mapster, Polly on GETs | Plain endpoints, built-in validation (`AddValidation()` + DataAnnotations), no retries | D2 |
| Missing-information section in the description | Not included by default; the user can type it in | T4.2 human decision |
| Company CA certificate | Not needed | Cloud uses a public CA |
| Kept: no retry on create, a link failure returns the key with a warning, the app has no login of its own, every creation logged | | |

## 12. Verified facts (⚠ VERIFY, 2026-11-12)

- **Basic auth with email and API token**, header `Authorization: Basic base64(email:token)`. Passwords are deprecated. Source: https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/
- **Scoped tokens need the `api.atlassian.com/ex/jira/{cloudId}` gateway**, and classic tokens work against the site URL. Sources: https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/ and https://github.com/sooperset/mcp-atlassian/issues/968. That's enough for the "classic tokens only" decision. The token expiry range (1–365 days) is from third-party docs only and is not relied on.
- **REST v2 vs v3:** "Version 2 and 3 of the API offer the same collection of operations. However, version 3 provides support for the Atlassian Document Format." So v2 takes plain (wiki) strings. Source: https://developer.atlassian.com/cloud/jira/platform/rest/v2/intro/
- **`X-Atlassian-Token`** is required only for multipart/form-data operations. Source: the same v2 intro page, "Special headers".
- **Endpoints in the Jira Cloud OpenAPI spec** (https://dac-static.atlassian.com/cloud/jira/platform/swagger.json, version `1001.0.0-SNAPSHOT-8e29beb…`):
  - `POST /rest/api/2/issue` returns 201 with `{id, key, self}` and has errors 400, 401, 403 and 422.
  - `POST /rest/api/2/issueLink` returns 201 with no body and has errors 400, 401, 404 and 413.
  - `GET/POST /rest/api/2/search/jql` returns `issues`, `nextPageToken` and `isLast`; `/rest/api/2/search` is "Currently being removed".
  - `GET /rest/api/2/project/search` has an `action` parameter. `GET /rest/api/2/myself` exists.
  - `GET /rest/api/2/issue/createmeta/{projectIdOrKey}/issuetypes` returns a page of issue types with `id`, `name`, `subtask` and `hierarchyLevel`.
  - `GET /rest/api/2/issue/createmeta/{projectIdOrKey}/issuetypes/{issueTypeId}` returns a page of `FieldCreateMetadata`: `fieldId`, `key`, `name`, `required`, `hasDefaultValue`, `defaultValue`, `allowedValues`, `autoCompleteUrl`, `operations`, and `schema` (`type`, `items`, `system`, `custom`, `customId`).
  - The old `GET /rest/api/2/issue/createmeta` is deprecated, so the app uses the two paged endpoints above.
  - `GET /rest/api/2/issueLinkType` exists.
  - The create example in the spec sets `"parent": {"key": "PROJ-123"}`.
- **Epic Link deprecated for Cloud** in favour of `parent`. Source: https://community.developer.atlassian.com/t/deprecation-of-the-epic-link-parent-link-and-other-related-fields-in-rest-apis-and-webhooks/54048. Not verified: that `parent` is accepted for every hierarchy pair in both project styles. It is expected to be, and Jira's 400 is shown if not. J6 checks it live.
- **Rate limits:** Jira Cloud returns 429, sometimes without `Retry-After`. Sources: https://developer.atlassian.com/cloud/jira/platform/build-an-app-that-respects-rate-limits/ and https://community.developer.atlassian.com/t/jira-cloud-api-rate-limits-and-missing-headers/94358. The app does not retry, so no backoff numbers are needed.
- **Still ⚠ VERIFY:**
  - the `schema` values per field kind and their input formats (J2/J3)
  - the 32,767 description limit (J3)
  - JQL `~ "<q>*"` prefix matching, the unknown-key behaviour and reserved characters (J2)
  - the create-metadata fields page size and maximum (J2)
  - the Atlassian API token page URL for the Connect panel (J4)

## 13. Risks

- **The token sits in a browser cookie.** It's encrypted and HttpOnly, but it is a real credential with the user's full Jira rights. That's acceptable for a local PoC demo and not for a shared deployment. Production would use OAuth 2.0 (3LO), which is named as the next step in the report and not built.
- **Basic auth on Cloud may be restricted further** (scoped tokens, admin policies). The Connect panel's error and the README say what to try.
- **Unsupported required fields** (user pickers, cascading selects) block creating some issue types. The app says so and names the field, instead of failing on Create. Adding more kinds later is a mapper change plus one UI control.
- **Field kinds are inferred from `schema`.** A custom field type the mapper doesn't know becomes `unsupported`, never a wrong guess.
- **Duplicates on timeout:** a create that times out may still have succeeded. The UI warns, and there's no automatic retry.
- **Rate limits:** opening Page 3 makes about four calls, and a search runs debounced per keystroke pause, so this is low risk for a demo.
- **Scope grew in revision 2.** That is why the frontend is split into J4 and J5. The fallback if time runs short is to stop after J4: summary, description, type and parent work, and only projects with no extra required fields can be used.
