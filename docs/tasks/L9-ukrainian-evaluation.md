# L9 — Ukrainian evaluation, manual voice check, README

- **Milestone:** M8
- **Status:** done
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

Tests first, in `tests/VoiceToTicket.Evaluation`:
1. `Scenario` gets an optional `ExpectedLanguage` (v1 files have none, so they still load). New `EvaluationSet` (`v1`, `uk`): folder, version tag (`eval-scenarios-v1`, `eval-scenarios-uk-v1`), spoken language, audio folder. Default `v1`; env var `VTT_EVAL_SET=uk` picks the other. Unknown name is an error.
2. `TicketChecks.LanguageMatches(scenario, ticket)`: null without an expected language. `RunRecord.LanguageMatches` is left out of the JSON when null, so v1 result files keep their shape. The scoring sheet shows the check per ticket.
3. `Wer.Words`: the apostrophes ʼ (U+02BC), ’ and ' inside a word are one apostrophe; ʼ is a letter for `char.IsLetter`, so it needs its own branch. Case already works for Cyrillic. Tests with Cyrillic.
4. Audio path: `AudioTranscriber` passes the language to STT; the live test takes the model from `Stt:Languages`. Uk recordings go in `eval/audio/uk/<id>.webm` (ids repeat across sets). Result folder gets a `-uk` suffix.
5. README: check what L3 already wrote about selector, translation, models, RAM; add only what is missing.
6. Not run by me: the human's voice check (gate) and the paid run (needs the go-ahead). ⚠ VERIFY: none.

### Decisions

- Set choice is `VTT_EVAL_SET` (`v1` default, `uk`), resolved by `EvaluationSet`; the run info carries the set's tag (`eval-scenarios-uk-v1`). `RunInfoFactory.Create` kept its two-argument form (third argument defaults to the v1 tag), so existing callers and results are unchanged.
- `Scenario.ExpectedLanguage` is optional (v1 files have none). `RunRecord.LanguageMatches` is left out of the JSON when null, so English result files keep their shape. The scoring sheet prints a language line and a per-model count only for sets that name a language. Comparison is exact (`uk`, not `UK`).
- Ukrainian recordings live in `eval/audio/uk/<id>.webm` because the ids repeat across sets; the folder is already git-ignored through `/eval/audio/`. Result folder for `uk` ends in `-uk`. The audio path takes its model from `Stt:Languages` through `EvaluationSet.SttModel` and sends the set's language to the STT (it sent none before, which meant English).
- WER: ʼ (U+02BC) is a letter for `char.IsLetter`, so the old code kept `пʼять` and `п'ять` apart. Apostrophes are now decided first and the three variants become one. A decimal comma still splits a number into two words (same for script and transcript); not changed.
- README: the L3 text already covered models and RAM; added a "Languages and translation" section, the `Translation__*` settings and `VTT_EVAL_SET`. The Docker memory minimum is stated as not measured. `.env.example` has no `Translation__Provider` line (outside the file list; the README says to set it in `.env`).
- No new dependency. No ⚠ VERIFY facts.

### Verified

- `dotnet build` and `dotnet test`: 915 passed, 10 skipped (live/STT/evaluation), 0 failed in the API tests; Evaluation project 78 passed, 1 skipped (the paid run), including the new tests (set choice, Ukrainian set loads 10 scenarios with `uk`, language check, JSON shape, scoring sheet, STT language, Cyrillic WER).
- `node scripts/check.mjs`: all checks passed.

- Paid Ukrainian run, human go-ahead 2026-11-20 ("you can do the paid testing"), `VTT_EVAL_SET=uk VTT_EVAL_AUDIO=1`, both models, prompt hash `a03cbb8f`: `eval/results/20261120-2123-uk/`. Text path, 19 calls per model: 19 of 19 valid on the first attempt (both), ticket language `uk` 19 of 19 (both), type correct 7 of 7 (both), types stable on the repeated scenarios (both). Trap hits: Haiku NOISY-01 `10%` and Sonnet BUG-02 `токен`, both only inside missing-information questions (to judge in scoring, not counted automatically). Audio path (5 recordings: AMBIGUOUS-01, BUG-01, FEATURE-01, MIXED-01, NOISY-01; the other 5 have no recording): `large-v3`, pooled WER 8.8 % (BUG-01 5.2 %, FEATURE-01 2.3 %, AMBIGUOUS-01 7.8 %, MIXED-01 9.0 %, NOISY-01 19.3 %), 18.6–26.7 s per recording; 5 of 5 audio tickets valid, language `uk`, types equal to the script path (both models). Scoring-sheet fields (facts, invention, usability) are still empty; scoring is T5.4/the human.

### Not verified

- The gate "Ukrainian transcripts usable" was passed by the human on 2026-11-20 (5 recordings, large-v3; the agent did not judge it). The large-v3-turbo fallback was not needed or tried.
- The English re-run: not run (optional, only if the human asks). Only 5 of 10 Ukrainian scenarios have recordings, so the audio path covers 5. Ticket quality (facts, invention, usability) is not scored.
- `Translation__Provider=Claude` and the Haiku id: unchanged from L6/L7 (not covered by an automated test).
- Web and e2e were not touched, not run.
### Reviews

- 2026-11-20, round 1: APPROVE. 0 blocker, 0 major, 1 minor (English audio path now sends `en` explicitly; same result, keep in mind when comparing audio runs). Reviewer re-ran the Evaluation tests only (78 passed, 1 skipped).
### Notes for the study

- Built test-first in one pass; the reviewer approved in round 1 with one minor note. No human correction was needed on the code.
- The agent found by reading that `ʼ` counts as a letter in .NET, which the Ukrainian WER tests then pinned. The go-ahead for the paid run came with the recordings, in the same message.
- The harness gates held: no paid run before the go-ahead. It cannot judge transcript quality, so the gate stayed with the human.
