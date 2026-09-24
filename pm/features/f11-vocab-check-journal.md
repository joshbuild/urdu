# Journal — f11 vocab-check

*Verbose per-front record. Hub: `pm/STATUS.md`; doc: `f11-vocab-check.md`.*

**Current state:** 🟡 in progress; s00 planning done (stress-tested 2026-09-24). s01 rotation is next (migration 0004 `checked_at`, `POST /api/handoffs/check-batch`). No code written yet.

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
