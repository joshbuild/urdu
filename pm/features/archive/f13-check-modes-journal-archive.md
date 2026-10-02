# Journal — f13 Check Modes

**Current state:** 🟢 shipped, closed 2026-10-02. s05 phone met by the sponsor's daily use of the check through the options dialog.

Newest first.

## 2026-10-02 — closed

Migration 0006 reached production with the f17 deploy (0005–0007 in one apply), and the sponsor reported days of checking vocab with no trouble. smoke-test-13's steps are waived on that report; the Worker tests cover the scope rules, ignored fields and per-mode stamps. Badge flipped to shipped, tombstone written, smoke archived.

## 2026-09-28 — planned, stress-tested, opened; s01–s04 built

The sponsor asked for a second pair of buttons for a completeness check, because the check (f11) rarely filled missing fields such as examples. It could also be a single check with a dialog. Reading the code showed a fill-in pair (f06 FR-F7) already existed. It looked broken because `incompleteVocab` served the oldest 20 incomplete items every time with no rotation, and the prompt says notes are optional. So items the chat declined stayed at the front, and later items never got examples.

Grill (three questions, all recommendations taken): one **Check options** dialog behind Copy check prompt, with the fill-in pair removed; **one stamp per mode** (`checked_at`, new `filled_at`); a **cap of 50**, default 20.

Stress test: 11 findings, all resolved by the agent. The main ones: s01 split into batch/apply; apply keeps mode and fields in the payload so a repeat can report its mode; legacy f11 batches keep f11's rules and report correctness; the dialog disables Copy prompt on invalid options, and each empty case has its own note.

Built:
- **s01** (`90f588a`): migration 0006 (`filled_at`, index `vocab_fill`; applied locally), `CheckOptions` + `parseCheckOptions` (every key optional; `{}` is f11's request), per-mode selection: correctness over items with a chosen field present, on `checked_at`; completeness over items missing one, on `filled_at`; both on the older stamp, the fill stamp counting only while a field is missing. The response carries `candidates`/`unchecked` in place of `never_checked`.
- **s02** (`6e2d574`): `planCorrection` takes the batch scope and moves disallowed changes to `ignored`; apply stamps per mode (numbered SQL params so `both` binds the time once); `mode` on preview, apply and repeat.
- **s03** (`bd3b7ed`): `src/handoff/checkOptions.ts` (defaults, validation, decode, guarded localStorage `urdu.checkOptions`), `CheckOptionsSheet`, mode-aware `checkPrompt` with per-item `missing` lists, the ignored line in the preview, and "marked checked / filled / checked and filled" wording.
- **s04** (`d6c9fa2`): removed the fill-in buttons and sheet, `fillInPrompt`/`missingFields`, `/api/handoffs/revisions`, `/api/vocab/incomplete`, `reviseVocab`, `incompleteVocab`, `parseRevisions`, their types, tests and CSS. `revised` stays in `HANDOFF_STATUSES`. PRD FR-F7 is marked superseded and FR-F9 describes the modes (built, phone pending); Appendix A has `filled_at`. smoke-test-13 is written, and smoke-test-11's D2 is reworded for the dialog.

`pnpm check` green at 548 (553 before the fill-in tests were removed). One `pnpm check` run showed a single failed test that didn't recur in three later runs; its name wasn't captured.

Not done: the dialog hasn't been rendered in a browser (unlocking `pnpm dev` needs the secret typed in), so smoke-test-13 Part B is the first look. s05 phone is next.
