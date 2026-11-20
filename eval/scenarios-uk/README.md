# Evaluation scenarios, Ukrainian (uk v1 draft)

Ten spoken reports in Ukrainian about **Ledgerly**, the same invented web invoicing app as the English set in `eval/scenarios/`. They are read aloud (or fed as text) to the Voice-to-Ticket PoC, and the resulting ticket is compared with what each file expects. The ticket must be in Ukrainian (`expectedLanguage: "uk"`). Status: committed, tag `eval-scenarios-uk-v1` added. The protected-files hook now blocks edits to this folder.

This set is separate from v1. It was written in its own session (task L8), and the session that writes the prompt (L4) must not read it. Results from this set are reported separately.

| ID | Expected type | Purpose | Expected missing information |
|---|---|---|---|
| BUG-01 | Bug | Full detail: steps, expected result, environment (bulk "mark as paid") | none |
| BUG-02 | Bug | English technical terms (`GET /api/invoices/1187/pdf`, 403, Accountant, JSON); expected result stated | environment |
| BUG-03 | Bug | Almost no detail ("printing invoices is broken") | steps, expected result, environment |
| BUG-04 | Bug | Intermittent; a number and a name that can be garbled (INV-2024-0317, 18 450,75 грн, Ярина Щербатюк); partial environment | steps |
| FEATURE-01 | Feature | Explicit acceptance criteria (recurring monthly invoices) | none |
| FEATURE-02 | Feature | English technical terms (webhook, POST, endpoint, JSON, CRM); clear need and idea, no criteria stated | none |
| FEATURE-03 | Feature | Vague request (reports are inconvenient) | proposed behaviour, acceptance criteria |
| AMBIGUOUS-01 | Bug (by convention) | Invoice number prefix change keeps old prefix on old invoices: defect or intended? | a question asking which |
| NOISY-01 | Bug | Ukrainian filler ("ну", "е-е", "коротше", "як його", "типу") and self-corrections (понеділок→вівторок, 10→15 %, 4.1→4.2) | none |
| MIXED-01 | Bug (by convention) | Logo upload over 2 MB hangs, plus a dark-theme wish | dark theme should be a separate ticket; environment |

## File format

The v1 format (see `eval/scenarios/README.md`) plus one field:

`id`, `category`, `script` (what is read aloud, in Ukrainian), `expectedType`, `expectedLanguage` (`"uk"`), `facts` (must appear in the ticket; in Ukrainian), `expectedMissing` (gaps the ticket should flag; contract field paths, or `general:` for gaps without a field), `traps` (plausible details the model might invent; found by case-insensitive search of the ticket JSON; reasons in Ukrainian).

## Notes for reviewers

- The mix mirrors v1: BUG ×4, FEATURE ×3, AMBIGUOUS ×1, NOISY ×1, MIXED ×1. AMBIGUOUS-01 and MIXED-01 are not counted in type accuracy; 7 scenarios count (BUG and FEATURE).
- **Inflection.** Ukrainian nouns change their endings, so several Ukrainian traps are word stems (`понеділ`, `округлен`, `стиснен`, `щотижн`, `знижк`, `повторн`, `податков`, `дублік`) to match every form. Latin traps (Chrome, Firefox, CORS, HMAC…) are matched as written; a ticket that transliterates them (Хром) would not be caught.
- **Garbling traps (BUG-04).** `Ірина`, `Щербак`, `18 540` and `0371` catch a wrong name or swapped digits from STT, the model or translation. The number is written in digits in the script; on the audio path the reader says it as words, so the transcript may show it either way, and the fact check should accept both. Number formatting is uk-style (space as thousands separator, comma for decimals); a ticket writing `18,450.75` still matches the fact but not the trap.
- **English terms.** BUG-02 and FEATURE-02 use English terms the way Ukrainian developers do; the ticket may keep them in English. That is expected and is not a language error. BUG-01 and MIXED-01 also contain a few (Chrome, PNG, upload).
- **Spoken length.** Scripts are meant for ≈ 30–90 s read aloud. BUG-03 and FEATURE-03 are deliberately short and content-free (≈ 20–30 s), like their v1 counterparts.
- Trap words such as browser names can appear legitimately in a *question* ("Який браузер, наприклад Chrome?"). As in v1, the runner (L9) decides whether traps are searched outside `missingInformation`.
- Changes after freezing need a new version (`uk-v2`) and a note in the report.
