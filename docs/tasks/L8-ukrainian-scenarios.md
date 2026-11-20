# L8 — Ukrainian scenarios (separate session)

- **Milestone:** M8
- **Status:** done
- **Depends on:** L0 approved
- **Plan sections:** `docs/language-plan.md` 8; implementation-plan 7.1
- **Parallel-safe with:** all. Run in its own session; the session that writes the L4 prompt must not read these files.

## Goal

Ten frozen Ukrainian evaluation scenarios in `eval/scenarios-uk/`, and the protected-files hook guards them once tagged.

## Files

- `eval/scenarios-uk/*.json`, `eval/scenarios-uk/README.md` (new)
- `.claude/hooks/guard-protected-files.mjs` (one rule: `eval/scenarios-uk/` after tag `eval-scenarios-uk-v1`)
- `docs/tasks/L8-*.md`, `docs/status.md`

## Out of scope

- Runner changes (L9). Any change to `eval/scenarios/`. Reading or editing `TicketPrompt.cs`.

## Acceptance criteria

- [x] 10 files in the v1 format plus `expectedLanguage: "uk"`. The app is Ledgerly. Categories: BUG ×4, FEATURE ×3, AMBIGUOUS ×1, NOISY ×1 (Ukrainian filler and self-corrections), MIXED ×1.
- [x] Scripts are natural spoken Ukrainian (≈ 30–90 s read aloud). At least two use English technical terms the way developers do (for example "CSV", "endpoint", "403"). One includes a number and a name that a translation or model could garble.
- [x] `facts`, `expectedMissing` (contract field paths) and `traps` are filled in. Traps are Ukrainian and English words the model might invent.
- [x] README lists the scenarios like the v1 README.
- [x] The hook rule is added and tested by hand (an edit is blocked after the tag; before the tag it is allowed).
- [x] The human reviews the set, commits, and tags `eval-scenarios-uk-v1`. The agent does not tag.

## Verification

```
node -e "for (const f of require('fs').readdirSync('eval/scenarios-uk').filter(f=>f.endsWith('.json'))) JSON.parse(require('fs').readFileSync('eval/scenarios-uk/'+f,'utf8'))"
```

The existing `ScenarioLoaderTests` pass (they read `eval/scenarios/` only until L9).

## Gate

**Ukrainian scenarios frozen** (`eval-scenarios-uk-v1` tag), set by the human.

## Log

### Plan

Read language-plan §8, the v1 README, five v1 files (format, `expectedMissing` paths) and `TicketFields` for the contract paths. Not read: `TicketPrompt.cs`. Write 10 files mirroring the v1 mix and purposes (same scenario IDs, new Ukrainian content), a README, and one hook rule mirroring the v1 rule. Test the rule in a throwaway git repo so no tag is created here.

### Decisions

- Field order: v1 fields with `expectedLanguage: "uk"` after `expectedType`.
- Facts and trap reasons in Ukrainian (language-plan §8). README in English, like v1.
- Ukrainian traps are word stems (`понеділ`, `округлен`, `знижк`…) because inflection would defeat a whole-word substring search. Noted in the README.
- English technical terms: BUG-02 (`GET /api/invoices/1187/pdf`, 403, Accountant, JSON) and FEATURE-02 (webhook, POST, endpoint, JSON, CRM); also a few in BUG-01 and MIXED-01.
- Number and name to garble: BUG-04 (INV-2024-0317, 18 450,75 грн, клієнтка Ярина Щербатюк) with traps `Ірина`, `Щербак`, `18 540`, `0371`.
- NOISY-01 traps `понеділ` and `4.1` appear in the script on purpose (self-corrected values), like `3.8` and `Tuesday` in v1.
- Hook rule: `eval/scenarios-uk/` after tag `eval-scenarios-uk-v1`. The v1 prefix `eval/scenarios/` does not match `eval/scenarios-uk/`, so the two rules are independent.

### Verified

- JSON parse command from this task: passes (10 files). A check script also confirmed id = file name, `expectedLanguage` = `uk` everywhere, mix bug 4 / feature 3 / ambiguous 1 / noisy 1 / mixed 1.
- Script length: 43–90 words, about 22–45 s at a normal speaking pace. BUG-03 (≈ 22 s) and FEATURE-03 (≈ 28 s) are deliberately short and content-free, like their v1 counterparts.
- Hook, tested by hand in a throwaway repo with `CLAUDE_PROJECT_DIR` pointing to it: before the tag an edit to `eval/scenarios-uk/BUG-01.json` is allowed (exit 0); after `eval-scenarios-uk-v1` it and `README.md` are blocked (exit 2); `eval/scenarios/BUG-01.json` stays allowed until `eval-scenarios-v1` exists, then blocked; `eval/other.json` allowed.
- `dotnet test --filter "FullyQualifiedName~ScenarioLoaderTests"`: 8 passed.

### Not verified

- Read-aloud timing was estimated from word count, not recorded.
- The Ukrainian has not been checked by a native speaker; the human review covers that.
- `/review` was not run in this session (the task asked for a hand-over to the human).

### Reviews

- 2026-11-20, human: "I'm happy with scenarios. Please commit and create a tag." Committed and tagged `eval-scenarios-uk-v1` by the agent at the human's request. No reviewer subagent run.

### Notes for the study

- The set was written without reading the prompt, so the prompt author (L4) cannot tune against it; L4 must not read this folder either.
- Stems as traps are a language-specific adaptation of the v1 trap search: a whole-word Ukrainian trap would silently miss inflected forms.
