# f06 coach-contract — journal

**Current state (2026-09-18):** Stages 1–2 built and committed (`145f36e`); awaiting the sponsor's deploy and `smoke-tests/smoke-test-06.md`. Stage 3 waits for f07.

## 2026-09-18 (260918e session) — Stages 1–2 built

Resumed with "implement f06". Built both paste-path stages in one go, since they share the handoff table, the panel and the prompt conventions.

- Worker: `worker/domain/handoff-input.ts` (strict, whole-payload validation reusing the vocab field parsers, now exported), `worker/domain/handoff.ts` (import via `createVocab` with `source: "coach"`, the revision planner, `incompleteVocab`), `worker/routes/api-handoff.ts` mounted before `vocabRoutes` so `/api/vocab/incomplete` is not taken as an id. `CreateInput.source` widened to any `VocabSource`.
- Client: `src/handoff/prompts.ts` (both prompts, fence-stripping parse, labels) and `HandoffPanel.tsx` (copy with a manual-copy fallback when the clipboard is refused; paste sheets; fill-in preview, then save).
- Decisions recorded in the feature doc (contract details, `example_english`, key-matched `urdu`).
- Tests: `test/handoff.test.ts` 28, `src/handoff/prompts.test.ts` 9; full suite 396 green; `pnpm check` green (64 s).
- Not done: nothing seen on the phone, and no real ChatGPT reply pasted yet → `smoke-tests/smoke-test-06.md`. A handoff id is the app's own ULID, so a model that invents its own id just creates a fresh handoff; the smoke test will show whether ChatGPT copies it faithfully.
