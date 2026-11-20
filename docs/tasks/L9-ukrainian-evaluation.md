# L9 — Ukrainian evaluation, manual voice check, README

- **Milestone:** M8
- **Status:** todo
- **Depends on:** L3–L8 done; gate "Ukrainian scenarios frozen"; **the human's go-ahead for each paid run**
- **Plan sections:** `docs/language-plan.md` 8, 10; implementation-plan 7
- **Parallel-safe with:** none

## Goal

Evidence on whether Ukrainian works: the runner handles the Ukrainian set, a human judges Ukrainian transcripts, and (with a go-ahead) the set is run and scored.

## Files

- `tests/VoiceToTicket.Evaluation/**` (scenario set option, language check, WER normalization for Ukrainian)
- `eval/results/**` (new run outputs only)
- `README.md` (languages, translation, STT models and RAM)
- `docs/language-plan.md` 8 and 10 (results, closed risks), `docs/tasks/L9-*.md`, `docs/status.md`

## Out of scope

- Prompt tuning (a separate human decision, like after the first English run). T5.4's report (it may cite these results later).

## Acceptance criteria

- [ ] The runner selects a set (`v1`, `uk`) by option or env var; the default stays `v1`, so existing runs are reproducible.
- [ ] New automatic check: `ticket.language == expectedLanguage` (when given). Tests cover it.
- [ ] WER normalization handles Ukrainian apostrophes (ʼ ’ ') and case; tests cover Cyrillic.
- [ ] Gate **"Ukrainian transcripts usable"**: the human records 3–5 reports and judges quality and speed. If it fails, apply the large-v3-turbo fallback (config only) and repeat.
- [ ] With the go-ahead: the Ukrainian text-path run (and audio path, if recordings exist in `eval/audio/`) is committed with run info. The optional English re-run happens only if the human asks for it.
- [ ] README documents the selector, translation, the models and the RAM use.
- [ ] `node scripts/check.mjs` passes.

## Verification

```
dotnet build
dotnet test
node scripts/check.mjs
```

Paid, only with the go-ahead: `VTT_RUN_EVALUATION=1` with the `uk` set.

## Gate

"Ukrainian transcripts usable" (human). The scoring of the results feeds the recommendation (T5.4).

## Log

### Plan
### Decisions
### Verified
### Not verified
### Reviews
### Notes for the study
