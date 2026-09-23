# f06 coach-contract — journal

**Current state (2026-09-23):** 🟢 closed. smoke-test-06 green; the two polish fixes ride the next deploy.

## 2026-09-23 (260923b) — smoke-test-06 green, two fixes, closed

The sponsor ran B5–B7 and all of Parts C and D: green. B1–B2 (Copy prompt) waived, since `vocab-json` replaces it in practice; the button stays as the fallback. Two findings, both fixed and committed: the CHATGPT section moved above the list (`bbdd132`), and saving fill-ins now replaces the stale "Fill-in prompt copied (N items…)" note with a fresh count (`48786f6`). `pnpm check` green at 465; one earlier run had a single unidentified test failure that did not recur in three runs. Closed; the phone check of both fixes went to TODO.

## 2026-09-23 (260923a session) — vocab-json Project instructions, first real paste

Sponsor's ask: Airtable is superseded, so the only way to add words was typing them in; could a ChatGPT chat add its end-of-conversation vocab list? Laid out the options: Stage 1 was already built and deployed; ChatGPT writing directly stays v1 (260918f); f08 would spend on parsing ChatGPT does free.

- `src/handoff/chatgpt-project-instructions.md`: a standing version of `newVocabPrompt` for the sponsor's "Urdu Coach" ChatGPT Project. Typing `vocab-json` turns the chat's latest list into a handoff. The chat mints its own `handoff_id` (`vocab-YYYYMMDD-` + 6 random), which the Worker accepts as is (any non-empty string ≤ 100). `prompts.ts` points to it; the sponsor restructured it under a Commands heading.
- The sponsor pasted it into the Project, got clean JSON, and pasted it into **Paste new vocab** on the phone: new words added. Recorded in smoke-test-06 (A1, B3, B4); B1–B2's Copy prompt is superseded in practice by `vocab-json`.
- Not yet known: whether ChatGPT reliably mints a fresh id per command (a reused one shows "already imported"), and B5–B7 / Part C.

## 2026-09-18 (260918e session) — Stages 1–2 built

Resumed with "implement f06". Built both paste-path stages in one go, since they share the handoff table, the panel and the prompt conventions.

- Worker: `worker/domain/handoff-input.ts` (strict, whole-payload validation reusing the vocab field parsers, now exported), `worker/domain/handoff.ts` (import via `createVocab` with `source: "coach"`, the revision planner, `incompleteVocab`), `worker/routes/api-handoff.ts` mounted before `vocabRoutes` so `/api/vocab/incomplete` is not taken as an id. `CreateInput.source` widened to any `VocabSource`.
- Client: `src/handoff/prompts.ts` (both prompts, fence-stripping parse, labels) and `HandoffPanel.tsx` (copy with a manual-copy fallback when the clipboard is refused; paste sheets; fill-in preview, then save).
- Decisions recorded in the feature doc (contract details, `example_english`, key-matched `urdu`).
- Tests: `test/handoff.test.ts` 28, `src/handoff/prompts.test.ts` 9; full suite 396 green; `pnpm check` green (64 s).
- Not done: nothing seen on the phone, and no real ChatGPT reply pasted yet → `smoke-tests/smoke-test-06.md`. A handoff id is the app's own ULID, so a model that invents its own id just creates a fresh handoff; the smoke test will show whether ChatGPT copies it faithfully.
