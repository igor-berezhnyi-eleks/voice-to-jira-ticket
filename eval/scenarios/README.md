# Evaluation scenarios (v1 draft)

Ten spoken reports about **Ledgerly**, an invented web invoicing app. They are read aloud (or fed as text) to the Voice-to-Ticket PoC and the resulting ticket is compared with what each file expects. Status: **draft, not frozen**. After review, the human commits and tags `eval-scenarios-v1`.

| ID | Expected type | Purpose | Expected missing information |
|---|---|---|---|
| BUG-01 | Bug | Full detail: steps, expected result, environment | none |
| BUG-02 | Bug | Medium detail | expected result, environment |
| BUG-03 | Bug | Almost no detail (one sentence) | steps, expected result, environment |
| BUG-04 | Bug | Intermittent bug, no steps, partial environment | steps |
| FEATURE-01 | Feature | Explicit acceptance criteria | none |
| FEATURE-02 | Feature | Clear need and idea, no criteria stated | none |
| FEATURE-03 | Feature | Vague request | proposed behaviour, acceptance criteria |
| AMBIGUOUS-01 | Bug (by convention) | Could be a bug or intended behaviour | a question asking which |
| NOISY-01 | Bug | Filler words and self-corrections (3.8→3.9, Tuesday→Wednesday) | none |
| MIXED-01 | Bug (by convention) | One bug and one feature in one report | feature should be a separate ticket; environment |

### Added after the freeze (set v2 additions, 2026-11-16)

Ten more scenarios from Jira tickets, added after `eval-scenarios-v1` was tagged. The ten files above are unchanged. Results that include these files must say so in the report.

| ID | Expected type | Purpose | Expected missing information |
|---|---|---|---|
| BUG-05 | Bug | Happy-path baseline: steps, expected result, browser and OS | none |
| BUG-06 | Bug | Hallucination resistance: Android login, no detail | steps, actual result, expected result, environment |
| BUG-07 | Bug | Ordered reproduction sequence (address country resets after refresh) | environment |
| BUG-08 | Bug | Exact technical strings (`GET /api/users/123`, 403, 2.4.1) | none |
| BUG-09 | Bug | Strongest hallucination test: "Notifications don't work." | steps, actual, expected, environment, notification type, trigger, consistency |
| FEATURE-04 | Feature | Clear feature (multiple delivery addresses) | none |
| FEATURE-05 | Feature | Vague export request; must not invent a format | format, roles, volume, filtering, fields |
| AMBIGUOUS-02 | Feature (accepted; Bug not penalised) | No "bug" or "feature" said (cannot filter orders by country) | is it a missing capability or a regression? |
| NOISY-02 | Bug | Conversational filler becomes concise content (search and sort) | expected result |
| MIXED-02 | Bug (by convention) | Slow reports page plus an Excel download request | Excel should be a separate ticket; environment |

## File format

`id`, `category`, `script` (what is read aloud), `expectedType`, `facts` (must appear in the ticket), `expectedMissing` (gaps the ticket should flag; contract field paths, or `general:` for gaps without a field), `traps` (plausible details the model might invent; found by case-insensitive search of the ticket JSON).

## Notes for reviewers

- AMBIGUOUS-01/02 and MIXED-01/02 are not counted in type accuracy; they are scored on the missing-information flag. With the additions, 14 scenarios count for type accuracy (BUG and FEATURE).
- AMBIGUOUS-02, NOISY-02 and MIXED-02 are repeated like their `-01` counterparts (1 + 3 runs).
- Trap words such as browser names can also appear legitimately in a *question* ("Which browser, e.g. Chrome?"). The runner (T5.2) should decide whether traps are searched only outside `missingInformation`.
- Changes after freezing need a new version (`v2`) and a note in the report.
