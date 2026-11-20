# L8 — Ukrainian scenarios (separate session)

- **Milestone:** M8
- **Status:** todo
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

- [ ] 10 files in the v1 format plus `expectedLanguage: "uk"`. The app is Ledgerly. Categories: BUG ×4, FEATURE ×3, AMBIGUOUS ×1, NOISY ×1 (Ukrainian filler and self-corrections), MIXED ×1.
- [ ] Scripts are natural spoken Ukrainian (≈ 30–90 s read aloud). At least two use English technical terms the way developers do (for example "CSV", "endpoint", "403"). One includes a number and a name that a translation or model could garble.
- [ ] `facts`, `expectedMissing` (contract field paths) and `traps` are filled in. Traps are Ukrainian and English words the model might invent.
- [ ] README lists the scenarios like the v1 README.
- [ ] The hook rule is added and tested by hand (an edit is blocked after the tag; before the tag it is allowed).
- [ ] The human reviews the set, commits, and tags `eval-scenarios-uk-v1`. The agent does not tag.

## Verification

```
node -e "for (const f of require('fs').readdirSync('eval/scenarios-uk').filter(f=>f.endsWith('.json'))) JSON.parse(require('fs').readFileSync('eval/scenarios-uk/'+f,'utf8'))"
```

The existing `ScenarioLoaderTests` pass (they read `eval/scenarios/` only until L9).

## Gate

**Ukrainian scenarios frozen** (`eval-scenarios-uk-v1` tag), set by the human.

## Log

### Plan
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
