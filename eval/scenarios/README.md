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

## File format

`id`, `category`, `script` (what is read aloud), `expectedType`, `facts` (must appear in the ticket), `expectedMissing` (gaps the ticket should flag; contract field paths, or `general:` for gaps without a field), `traps` (plausible details the model might invent; found by case-insensitive search of the ticket JSON).

## Notes for reviewers

- AMBIGUOUS-01 and MIXED-01 are not counted in type accuracy; they are scored on the missing-information flag.
- Trap words such as browser names can also appear legitimately in a *question* ("Which browser, e.g. Chrome?"). The runner (T5.2) should decide whether traps are searched only outside `missingInformation`.
- Changes after freezing need a new version (`v2`) and a note in the report.
