# Journal — f11 vocab-check

*Verbose per-front record. Hub: `pm/STATUS.md`; doc: `f11-vocab-check.md`.*

**Current state:** 🟡 in progress; s01 rotation and s02 corrections built 2026-09-24. s03 client is next (`checkPrompt`, Copy check prompt / Paste corrections, the preview with per-field and reset ticks, the result screen, smoke-test-11). Migration 0004 is applied locally only; the sponsor applies it remotely before the s04 deploy.

## 2026-09-24 — s02 corrections built

- `shared/api.ts`: `Correction`, `CorrectionAccept`, `CorrectionsRequest`, `FieldChange`, `CorrectionPlan` (preview), `CorrectionResult` (apply), `RESET_OUTCOMES`, `CorrectionsResponse`.
- `worker/domain/handoff-input.ts` `parseCorrections(body, preview)`: the correction is a revision plus a required `reason` and an optional `urdu_suggestion` (empty or null reads as none). `corrections` may be empty; `list()` gained an `allowEmpty` flag. `accept` is refused on a preview and required on apply. Each entry must name a pasted correction and only the fields it proposes, and must tick a field or the reset. Old values are not trimmed, because they are compared exactly with the stored ones.
- `worker/domain/check.ts`: `correctVocab` reads the batch row. No row is `NOT_ISSUED` (400 on `handoff_id`), another status is `ID_CONFLICT` (409), and `checked` is a repeat. `planCorrection` checks the batch, then the item, then the `urdu` key, then drops unchanged values and a same-key suggestion. `applyCorrections` issues one D1 batch: a single-field `UPDATE … WHERE <f> IS old` per accepted field, the guarded `correctStep(0)` reset, the stamp (no `updated_at`), and the `check_issued` → `checked` transition. Each statement also requires the row to still be `check_issued`. Results are corrected from `meta.changes` after the batch; a tripped guard triggers a follow-up rewrite of the stored outcome.
- Route `POST /api/handoffs/corrections` (`?preview=1`).
- Tests: `test/corrections.test.ts` (21). The parse cases, preview writes nothing, the rejected reasons, the flags, 400/409, the apply with a remove, an add, a declined field and a stamp that leaves `updated_at` alone, the preview-then-edit race, the reset against `correctStep(0)` with no event, the stale-read race through `applyCorrections` (reset skipped, field kept, stored outcome corrected), a deleted accepted row, and `accept: []` followed by a repeat on both apply and preview.
- One call against the plan, recorded in the doc's Decisions: an accept for a row rejected at apply reports it rejected rather than refusing the apply, because Scope said so and the Testing line said otherwise.
- `pnpm check` green: 34 files, 493 tests, 70 s.

## 2026-09-24 — s01 rotation built

- `migrations/0004_vocab_check.sql`: `vocab.checked_at` (nullable) and the index `vocab_check (checked_at, added_at)`. It's applied to local D1, where all 36 rows now have `checked_at` null.
- `shared/api.ts`: `VocabItem.checked_at`, `HANDOFF_STATUSES` += `check_issued`, `checked`, `MAX_CHECK_BATCH = 20`, `CheckBatchResponse`. `createVocab` sets `checked_at: null`. Every read is `SELECT *` through `toItem`, so the list, the item, due and export all carry the column without further edits.
- `worker/domain/check.ts` `issueCheckBatch`, mounted as `POST /api/handoffs/check-batch`. It orders by `checked_at ASC NULLS FIRST, added_at ASC, id ASC`, limit 20, counts `never_checked` across the vault, and inserts a `check_issued` handoffs row with payload `{vocab_ids}` and a SQL-null outcome. Each copy mints a new ULID. An empty vault returns `handoff_id: null` and records nothing.
- Tests: `test/check.test.ts` (6) covers the order with every tiebreak, the cap of 20 with a vault-wide `never_checked`, one row per copy, the empty vault, and `checked_at` surviving an edit (including a rung change), a review and an Airtable re-import, plus the export carrying it. `test/migration.test.ts` gained 0004 on seeded rows: `checked_at` null, rows otherwise equal, index present. Client fixtures gained `checked_at: null`.
- `pnpm check` green: 33 files, 472 tests. It took 73 s, so the AVG toggles were holding.
- Toolchain note: a `git stash` round trip rewrote the touched files with CRLF and Biome flagged them all as format errors. Restored with `sed -i 's/
$//'`. Avoid stashing to compare lint baselines here.

## 2026-09-24 — stress-tested

Ran `/pm-stress-test f11` against the handoff code (`reviseVocab`, `parseRevisions`, `updateVocab`, `correctStep`, the `review.ts` optimistic guard). The sponsor settled the two escalations:

- **The Worker records the batch.** Copy check prompt becomes `POST /api/handoffs/check-batch`, which writes a `check_issued` handoffs row with the 20 ids under a server-minted `handoff_id`. The alternative, a list held in localStorage, was rejected: Android can discard the PWA mid-round-trip, the list couldn't cross devices, and the Worker couldn't reject an out-of-batch id.
- **Per-field ticks, on by default** (not per item).

Resolved by the agent (details in the doc's Decisions):
- A contradiction: FR-F7's non-empty `list()` would have rejected an all-fine reply, so `corrections` may now be empty.
- The draft's never-clobber guard couldn't work, because the preview stores nothing and the server couldn't know what the preview had shown. Apply now sends each accepted field's old value, and each write is a single-field `UPDATE … WHERE <f> IS old`.
- Specified: the guarded rung-0 reset, the stamp that doesn't bump `updated_at`, the `check_issued` → `checked` transition, and how apply treats items deleted or edited since the preview.
- A correction may remove a field (null) or fill an empty one. Open links appear only on the result screen. The prompt spells out what to check.
- s01 was split into rotation and corrections, and s04 (phone) was added. Done When gained the local and remote migration rows and names the ripple.
- The preview-then-edit race moved from the phone smoke to a Worker test, because the phone preview can't survive navigation.

Ripples: PRD FR-F9 (Worker-recorded batch, per-field ticks), PLAN roster and bullet, STATUS pointer. Docs only; no tests run.

## 2026-09-23 — drafted and opened; planning questions settled

The sponsor asked for a bulk accuracy check of existing vocab. f11 was drafted on the FR-F7 revisions code, since f06 was closed and f10 is voice-only. It adds PRD FR-F9 (planned), a PLAN roster row and a STATUS workfront. The sponsor then answered the three planning questions:
- A suspect Urdu spelling is flagged, never applied.
- Batches rotate by a new `vocab.checked_at` (migration 0004). The sponsor chose this over the recommended filtered-list batch.
- Each item gets a reset tick with FR-F8 semantics.

PRD Appendix A gained `checked_at` (planned). This session wasn't wrapped at the time; this entry is written retroactively (commits `9783729`, `55e7694`).
