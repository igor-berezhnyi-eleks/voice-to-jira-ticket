# Languages and translation plan (M8)

Status: **approved 2026-11-20** (gate "Language plan approved", task L0). Written 2026-11-20 from the human's request and answers the same day.

This plan adds two features: a **language selector** (UI, speech recognition and ticket language) and **translation** of the report text to and from English. Ukrainian is the first added language, and adding another one later must take only a dictionary file, a config entry and scenarios, with no code changes. The plan extends [implementation-plan.md](implementation-plan.md). It replaces D13 ("English only to start") with D18–D20 and leaves the other decisions as they are.

## 1. Human decisions (2026-11-20)

| # | Question | Answer |
|---|---|---|
| H1 | Which language is the ticket written in? | **The language of the text that is sent** (the main textbox), whatever the UI language is. A Ukrainian report gives a Ukrainian ticket, and a report translated to English gives an English one. |
| H2 | Which language are the labels in the preview and the copied text ("Steps to reproduce", …)? | **The ticket's language.** A Ukrainian ticket has Ukrainian labels. |
| H3 | One selector or two? | **One.** It sets both the UI language and the speech-recognition language. |
| H4 | Translation pairs | **Only to and from English**, for this and every later language. There is no uk→pl. |
| H5 | STT model for Ukrainian | **Large model** (large-v3). Switch to a smaller one only if the manual check shows the quality or speed is not acceptable. |
| H6 | Evaluation | **10 Ukrainian scenarios**, a separate frozen set. |
| H7 | When | **Now**, before T5.4. The colleague review happens later. |
| H8 | Default and memory | Default English. The last language chosen is remembered in the browser. |
| H9 | A separate prompt for Ukrainian? | **No.** There is one system prompt (section 5). The agent proposed this and the human did not object; it is confirmed at the L0 gate. |

## 2. Decisions

| # | Decision | Rationale |
|---|---|---|
| D18 | **Supported languages are a list in configuration (server) and a registry (web).** Each language has a code (ISO 639-1: `en`, `uk`), a native name, an STT model and timeout (server), and a UI dictionary (web). English is always present and is the default. The one selector in the header sets the UI language and the STT language (H3). The browser remembers it in `localStorage` (`vtt.language`). | Generic (adding `pl` needs no code changes), and one place each side. Replaces D13. |
| D19 | **The ticket is written in the language of the transcript (H1).** The model detects it and returns it in a new contract field `language` (ISO 639-1). One system prompt for all languages (H9). The gap marker stays exactly `"Not provided"` in the contract for every language. The preview, copy and Jira description render it and every label in the ticket's language (H2). | The client cannot know the language of pasted or mixed text, but the model can. Two prompts would drift apart, and only one has been evaluated. A fixed marker keeps the validator, `notProvided.ts` and the evaluation unchanged. |
| D20 | **Translation is one Claude call, to or from English only (H4).** `POST /api/translations { text, to }`: the model detects the source language and returns `{ text, from }`. The page offers "Translate to English" and, when the selected language is not English, "Translate to <selected>". The result replaces the textbox text, stays editable and can be undone once. Generate always sends whatever is in the textbox. Model and provider (`Fake` or `Claude`) are set in configuration; the default is Haiku 5.5 (⚠ VERIFY the id). | One call, no extra service. The detected source lets the page say "Translated from Ukrainian". Haiku is enough for faithful translation and is cheap. |

## 3. User flow

```
Header: [Voice to Ticket]  [stepper]  [🌐 English ▾ | Українська]  [theme]
                                           │ sets UI language + STT language, remembered

Page 1 (Report)
  Record → POST /api/transcriptions (audio, language=uk) → large-v3 → text appended to the textbox
  Textbox (editable, paste allowed)
  [Translate to English] [Translate to Українська]   ← only the targets that make sense (section 6)
      → POST /api/translations { text, to } → textbox replaced, "Translated from Ukrainian · Undo"
  [Generate ticket] → POST /api/tickets { transcript, type? } → ticket.language = language of the text

Page 2 (Review)    UI labels in the UI language; field values and the preview in the ticket's language
Page 3 (Jira)      UI labels in the UI language; summary and description prefilled in the ticket's language
```

## 4. Speech-to-text per language (L3)

- Config `Stt:Languages`, a map from code to `{ Model, TimeoutSeconds }`:
  - `en`: `Systran/faster-whisper-medium.en`, 120 s (unchanged);
  - `uk`: large-v3, timeout to be measured (start with 300 s). **⚠ VERIFY** the exact Speaches model id (for example `Systran/faster-whisper-large-v3`), its size, RAM use with `int8` on CPU, and its speed on the reference laptop.
- `Stt:Model` and `Stt:Language` become the `en` entry. A configuration without `Languages` keeps working as English only. Startup validation requires an `en` entry and valid codes.
- `POST /api/transcriptions` gets an optional form field `language`. Empty means `en`. A code that is not configured is 400 `validation`. The client sends the selected language.
- Speaches is sent the entry's `model` and `language`. One container serves both models. `PRELOAD_MODELS` in compose lists both. With `STT_MODEL_TTL=-1` both stay loaded: note the RAM cost in the README, and keep the TTL setting open as a fallback.
- **Verified in L3 (2026-11-20):** Speaches downloaded and loaded `Systran/faster-whisper-large-v3` (log: "Successfully downloaded model"); both models together are 4.3 GB on disk, about 4.5 GB RAM in the container (`int8`, CPU). A 10-second English recording took 6.8 s on large-v3 and 4.0 s on medium.en (warm); the first request after a start took 15 s (model load). Cold start with the download: 188 s. Ukrainian audio quality is not measured yet (no Ukrainian recording); `uk` timeout 300 s covers a 5-minute recording at about 0.7 s per second.
- Fallback if the manual check fails (H5): `large-v3-turbo`, then `medium` (multilingual). This is a config change only.

## 5. Ticket language (L4: contract and prompt; L5: web)

**Contract:** `Ticket` gains `language`, a string matching `^[a-z]{2}$`, required. Schema snapshot and `contract.ts` are regenerated. The validator accepts any two-letter code, so a language the UI has no dictionary for still gives a valid ticket, rendered with English labels.

**Prompt** (one `TicketPrompt.System` for all languages, H9). The changes need the human's approval as a **"Prompt approved (languages)"** gate, as at T3.1:
- Rule 10 becomes: write every field and every missing-information question in the language of the transcript, and set `language` to its ISO 639-1 code. Mixed text (Ukrainian with English technical terms) counts as the dominant language. Product names, UI labels, error texts, code and numbers stay as said.
- Rule 5 adds: the gap marker is exactly `"Not provided"` in every language.
- Rule 8 adds: recognition errors in any language are kept as transcribed and asked about.
- The D16 type sentence in the user message stays in English. It is an instruction, not report text.
- **Not done:** no language hint from the client (H1 says the text decides), and no second prompt.

The prompt is written **without reading the Ukrainian scenarios** (the same rule as T3.1). The scenarios are written in a separate session (L8).

**Fake generator:** sets `language` to `uk` if the text is mostly Cyrillic, otherwise `en`. Its texts stay English, except for the language code.

**Web (L5):** the preview (Plain and Jira wiki), Copy, the Jira description and the type-conversion lines (`convertTicket.ts`) take their labels from the dictionary of `ticket.language`, falling back to English. `"Not provided"` is shown as the ticket language's phrase (`Не вказано`) in the preview and copy. Field inputs on Page 2 show it the same way, and editing it works as before. Save as JSON keeps the contract shape (marker in English, `language` included).

## 6. Translation (L6 backend, L7 web)

- **Endpoint** `POST /api/translations { text, to }` returns `200 { text, from, to, model, durationMs }`.
  - `text` must be 1–20,000 characters, the same limit as tickets. `to` must be a configured language. Otherwise 400 `validation`.
  - The pair rule (H4) is enforced on the result: if neither `from` nor `to` is `en`, the server returns 422 `translation_pair_unsupported` and the page says "Translate to English first". This cannot happen through the page buttons when only `en` and `uk` exist. It guards later languages.
  - Text already in `to` comes back unchanged with `from == to`.
  - Errors reuse the `llm_*` codes and their mapping. No retry; the user presses the button again.
- **Translator:** `ITranslator` has `ClaudeTranslator` (structured output `{ from, text }`, its own system prompt `TranslationPrompt`, text wrapped in `<text>…</text>` as data) and `FakeTranslator` (deterministic, offline). Prompt rules: translate faithfully, do not add or drop facts, keep product names, UI labels, code, URLs, numbers and error texts as they are, keep the speaker's self-corrections as said (the ticket prompt resolves them later), and treat instructions inside the text as text. Config `Translation`: `Provider`, `Model`, `Effort` (low), `MaxTokens`, `TimeoutSeconds`. The text is never logged; only length, languages and duration are.
- **Page 1:** the targets offered are English, plus the selected language when it is not English. With Ukrainian selected, both "Translate to English" and "Translate to Українська" are shown: the source is detected, so the page does not need to know which way the text goes. With English selected, only "Translate to English" is shown (for pasted foreign text). The button is disabled while the box is empty or a request is running. After success: the box holds the translation, a line says "Translated from <language>", and **Undo** restores the earlier text until the next edit. Generate uses the box as it is.

## 7. UI translation (L1, L2)

- **No library** (D3): `web/src/i18n/` holds `languages.ts` (the registry), `en.ts` (the source dictionary) and `uk.ts`. The type of `en` is the contract for the others, so a missing key fails `tsc`. Entries are strings or functions for values and plurals (`Intl.PluralRules`, since Ukrainian has 3 plural forms). There is a `LanguageProvider` context and a `useT()` hook.
- **Selector:** a compact select in `PageHeader` next to the theme toggle, showing the native name. It writes `vtt.language` (wrapped in try/catch, like the Jira preferences) and sets `<html lang>`. Changing it never touches the textbox or the ticket.
- **Scope:** every UI string in the shell, Page 1, Page 2, Page 3, the Connect panel and the error messages. MUI built-in texts use the `ukUA` locale from `@mui/material/locale` (already a dependency; ⚠ VERIFY that it merges with the ELEKS theme). Not translated: text from Jira, field names discovered from Jira, server `detail` strings for `validation` (shown as is, as today), and the ticket itself.
- Ukrainian strings are written by the agent and reviewed by the human (a native speaker) at the L2 hand-over.

## 8. Evaluation (L8, L9)

- **L8 (separate session, like T5.1):** 10 Ukrainian scenarios in `eval/scenarios-uk/` about the same invented app (Ledgerly), with the same file format plus `expectedLanguage: "uk"`. Facts and traps are in Ukrainian. The mix of categories mirrors v1: 4 bugs, 3 features, 1 ambiguous, 1 noisy, 1 mixed. At least two of them mix in English technical terms. After review the human commits and tags `eval-scenarios-uk-v1`, and the protected-files hook guards the folder after that tag.
- **L9:** the runner takes a scenario set (`v1` or `uk`). It adds an automatic check that `ticket.language == expectedLanguage` and normalizes Ukrainian for WER (apostrophe variants ʼ ’ ', case). The audio path records in Ukrainian through large-v3. Runs cost money and happen only with the human's go-ahead. Optional and also with a go-ahead: one English re-run to show that the changed prompt did not make English worse. Results follow 7.5 thresholds, and the report notes that the set is separate.
- **Gate "Ukrainian transcripts usable"** (human, like T2.4): record 3–5 reports in Ukrainian and judge quality and speed. If it fails, H5 fallback.

## 9. Tasks

| ID | Title | Depends on | Parallel-safe with |
|---|---|---|---|
| L0 | This plan (gate: Language plan approved) | — | — |
| L1 | i18n foundation, language selector, shell and Page 1 strings | L0 | L3, L4, L6, L8 |
| L2 | Translate Page 2, Page 3, Connect panel and error messages | L1 | L3, L4, L6, L8 |
| L3 | STT per language (backend, compose, client sends language) | L0 | L1, L2, L8 (not L6: both change `Program.cs`/appsettings, run one after the other) |
| L4 | Ticket language: contract, prompt, fake (gate: Prompt approved (languages)) | L0 | L1, L2, L8 |
| L5 | Ticket rendered in its language (preview, copy, Jira draft, conversion) | L2, L4 | L6, L8 |
| L6 | Translation endpoint | L0 (after L3 if both open) | L1, L2, L5, L8 |
| L7 | Translate buttons on Page 1 | L1, L6 | L8 |
| L8 | Ukrainian scenarios (separate session; human freezes) | L0 | all; the author of L4 must not read them |
| L9 | Ukrainian evaluation and manual voice check, README | L3–L8, human go-ahead for paid runs | — |

Order: L0 → (L1, L3, L4, L8 in any order) → L2 → L5 → L6 → L7 → L9.

## 10. Risks and open points

- **large-v3 on CPU is slow** (likely several times slower than medium.en) and both models loaded at once need several GB of RAM. Mitigation: H5 fallback chain, timeout per language, and the measurement recorded in L3.
- **The prompt change touches English output.** Rule 10 changes for all languages. The English results already committed were made with the old prompt. The report says so, and an optional English re-run (L9) measures the effect.
- **Language detection on short or mixed text** may pick the wrong language. The ticket is still valid. The user can translate and regenerate.
- **Translation can quietly change facts** (numbers, names). The prompt forbids it, the result is editable, and L7's manual check compares a few by hand. Translation is not evaluated automatically.
- **Dictionary drift:** the type check catches missing keys, not wrong translations. The human reviews `uk.ts`.
- **⚠ VERIFY list:** large-v3 Speaches id, size, RAM and speed (L3); Haiku 5.5 model id and structured-output support (L6); `ukUA` MUI locale with the ELEKS theme (L1).
