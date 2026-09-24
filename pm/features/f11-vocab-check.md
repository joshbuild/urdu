# Feature Plan — Vocab Check

**Status**: 🟡 IN PROGRESS — *opened 2026-09-23; s00 planning done 2026-09-24 (questions settled, stress-tested); s01 next.*
**Handle**: `f11`
**Created**: *2026-09-23* · **Updated**: *2026-09-24*

**Owner docs it serves**:
- `pm/PRD.md` — FR-F9 (new, planned), beside FR-F7 fill-ins and FR-D2 edit rules
- `pm/DECISIONS.md` — 260918f (ChatGPT paste path first), 260918g (fill-ins never overwrite; "a later edit-in-place feature if wanted" — this is it), 260922a (FR-F8 overwrite rules and interval reset)
- Code it extends: `worker/domain/handoff.ts` (`reviseVocab`), `worker/domain/handoff-input.ts`, `worker/routes/api-handoff.ts`, `shared/api.ts` (`HANDOFF_STATUSES`, `VocabItem`), `shared/ladders.ts` (`correctStep`), `worker/domain/review.ts` (its optimistic schedule guard is the pattern for the reset), `src/handoff/prompts.ts`, `src/handoff/HandoffPanel.tsx`

> **One-line:** A ChatGPT copy–paste round trip that checks existing vocab entries for accuracy and, after a per-field old → new preview the sponsor accepts, overwrites the wrong fields.

## Intent

### Vision

The vault holds entries from Airtable, the reader, ChatGPT and the Coach, and some of them are wrong: a
stiff or Hindi-leaning meaning, an academic Roman spelling, an example that isn't everyday Pakistani
Urdu. Today the only fix is noticing one while reviewing and editing it by hand. This feature lets the
sponsor sweep a batch at a time: copy a prompt listing the entries, paste it into ChatGPT, paste the
reply back, and see only the entries ChatGPT would change, each field as old → new with a reason.
Accepted corrections are written; everything else is left alone. It costs nothing beyond the ChatGPT
subscription, and the AI only proposes (VISION invariant): Urdu Core validates and writes.

### Scope

- **Rotation (migration 0004):** a nullable `vocab.checked_at` (UTC instant) and an index
  `vocab_check (checked_at, added_at)`. The batch is the 20 least recently checked:
  `ORDER BY checked_at ASC NULLS FIRST, added_at ASC, id ASC LIMIT 20`. A Vocab-tab edit, a review
  and an import never touch `checked_at` (they write explicit column lists, so this holds by
  construction; a test pins it). `VocabItem` gains `checked_at`, so the export carries it.
- **Recorded batch:** **Copy check prompt** calls `POST /api/handoffs/check-batch`, which selects the
  batch, mints a ULID `handoff_id`, and records a `handoffs` row with status `check_issued`, payload
  `{vocab_ids:[…]}` and outcome null. It returns `{handoff_id, items, never_checked}`
  (`never_checked` counts the whole vault, for the copy note). An empty vault returns no items and
  records nothing. Every copy records a batch; one never pasted back stays as a harmless
  `check_issued` row that the export carries.
- **Check prompt:** self-contained (like `fillInPrompt`), carrying the server's `handoff_id`, listing
  each item's `vocab_id`, `urdu` and every present fillable field. It asks ChatGPT to check each
  field against the house conventions (everyday Pakistani Urdu; practical Roman Urdu; concise
  English; a natural everyday example whose English translates it; accurate notes), and to return
  only items with something wrong. A correction supplies the corrected fields, sets a wrong field
  to null to remove it, may add a missing field, carries one short `reason`, and never changes
  `urdu`, which it copies exactly. A suspect spelling of the Urdu goes in `urdu_suggestion`. If
  every item is fine, the reply is `"corrections": []`.
- **Corrections input:** `{handoff_id, corrections:[{vocab_id, urdu, roman?, english?, notes?,
  example_urdu?, example_english?, reason, urdu_suggestion?}]}`, strict as FR-F7: unknown keys, a
  missing or empty `reason`, a repeated `vocab_id` or more than 20 entries reject the whole
  payload with the field path, never repaired. `corrections` **may be empty** (an all-fine batch,
  unlike FR-F7's non-empty `revisions`). A fillable field is a string, or null (or `""`) meaning
  remove it.
- **Handoff id states:** no row → 400 on `handoff_id` ("not a check batch this app issued; copy a
  fresh check prompt"); `check_issued` → proceed; `checked` → repeat, returns the stored outcome
  and writes nothing; any other status → 409 conflict, as today. `HANDOFF_STATUSES` gains
  `check_issued` and `checked`.
- **Preview** (`POST /api/handoffs/corrections?preview=1`, server-computed, writes nothing): per
  correction, one of — `rejected` with a reason (id not in this batch; no item has this id, e.g.
  deleted since the copy; echoed `urdu` does not match by `urdu_key`) · `correct` with
  `changes:[{field, old, new}]`, `reason` and any `urdu_suggestion` · `nothing` when no proposed
  value differs from the stored one (compared after the parser's trim; null equals null). An
  unchanged proposed value is dropped, and so is an `urdu_suggestion` whose key equals the item's.
  A `nothing` row is shown only if it still carries a flag; otherwise the preview counts it with
  the fine items.
- **Ticks (sponsor, 2026-09-24):** every old → new line has its own tick, **ticked by default**;
  each `correct` or flagged item has one "reset to first rung" tick, off by default. Rejected rows
  are listed with their reason and have no ticks.
- **Apply** (same route, no `preview`): the pasted document plus
  `accept:[{vocab_id, fields:{<field>: <old value the preview showed>}, reset}]`, one entry per
  item with at least one ticked field or its reset ticked. A preview request carrying `accept` is
  invalid; an apply request must carry it (empty is allowed, and is **Mark checked**). An entry
  for a vocab_id absent from the pasted `corrections`, or a field that correction doesn't
  propose, rejects the apply whole (a client bug, not a chat error). Everything else is judged
  against the plan recomputed at apply: an accepted item rejected since the preview (e.g.
  deleted) is reported rejected, and an accepted field whose stored value no longer equals the
  sent old value is kept and reported. In one D1 batch:
  - each accepted field is its own `UPDATE vocab SET <f> = ?, updated_at = ? WHERE id = ? AND <f> IS ?`
    (the old value), so a field edited since the preview is kept and reported, never clobbered;
  - each ticked reset runs `correctStep(0, active, last_reviewed_at)` (FR-F8 semantics: the active
    ladder's rung 0, `due_at` recomputed from the existing `last_reviewed_at`, no review event),
    guarded on the `ladder_id`, `ladder_step` and `last_reviewed_at` read at apply, like
    `review.ts`; a review landing in between skips the reset and reports it;
  - every batch id is stamped `checked_at = now`, including items the chat left out, rejected
    rows and unticked changes, **without** touching `updated_at` (a stamp isn't an edit, and
    `review.ts` guards on `updated_at`); ids deleted since the copy match no row;
  - the `handoffs` row moves to `checked` (`imported_at` = apply time, payload = the batch ids,
    the pasted corrections and `accept`, outcome = the results), conditioned on
    `status = 'check_issued'`.
  The outcome is computed from a read made just before the batch (as `reviseVocab` plans before
  its COALESCE backstop); the SQL guards remain the backstop. Per item it reports fields written,
  fields kept because they had changed since the preview, fields declined (unticked), and reset
  applied / skipped / not asked.
- **Suspect Urdu spelling:** `urdu_suggestion` is shown as a flag and never applied. Its **Open**
  link appears on the result screen after apply, not in the preview, so opening an item never
  discards an unapplied preview.

### Exclusions

- **Correcting the Urdu term itself.** The `urdu` echo is the guard that stops a reply landing on the
  wrong item; a suspect spelling is flagged only and fixed on the Vocab tab.
- **A server-side LLM "Check" button** (Worker calls OpenAI): belongs with f08 `vocab-enrich`, on hold
  (260918f).
- **Voice edits**: f10 FR-F8, one item per spoken exchange.
- **Choosing the batch by the Vocab list's filters**: rotation by `checked_at` replaced it.
- **Tags, favourite, kind**: not proposed by the chat; edited on the Vocab tab.
- **Auto-apply without preview**: the chat's output is a proposal (260918g).
- **A ChatGPT Project command** for the check: the prompt is self-contained, like the fill-in prompt;
  `chatgpt-project-instructions.md` stays new-vocab only.
- **Pruning abandoned `check_issued` rows**: not worth code at one row per copy.

### User Stories

- As the learner, I copy a check prompt for a batch of my words, paste ChatGPT's reply, and see only
  the entries it thinks are wrong, so that I can fix mistakes without reading every entry myself.
- As the learner, I see each change as old → new with a reason and untick any I disagree with, so
  that a bad suggestion never overwrites a good entry.
- As the learner, a correction doesn't disturb my review schedule unless I ask, so that fixing a typo
  doesn't cost me progress.

### Non-Functional Requirements

- **No spend:** no API call; the chat runs in the sponsor's ChatGPT subscription.
- **Deterministic writes:** Urdu Core records the batch, validates, matches and writes; the client
  sends back only the tick list and the old values the preview showed it.
- **Never clobber:** an apply cannot overwrite a value that changed after its preview.
- **Reply reliability:** batch of 20, as FR-F7.
- **Device:** installed Android Chrome; the old → new preview must be readable at phone width, Urdu
  fields (`urdu`, `example_urdu`, `urdu_suggestion`) RTL in Nastaliq, the rest LTR.

## Planning

### Testing

- **Migration test (s01):** 0004 adds `checked_at` null on every existing row, rows intact, index
  present; local D1 run.
- **Worker tests, batch (s01):** the order is never-checked, then oldest `checked_at`, then
  `added_at`, then id; at most 20; `never_checked` counts the vault; a `check_issued` row records
  the ids; an empty vault records nothing; `updateVocab`, a review and `createVocab` leave
  `checked_at` unchanged.
- **Input tests (s02):** strict parse of corrections (unknown keys, missing/empty `reason`,
  repeated `vocab_id`, over 20, empty list accepted, `""` read as null); `accept` refused on
  preview and required on apply.
- **Worker tests, corrections (s02):** preview writes nothing (no field, no stamp, the handoff row
  still `check_issued`); unknown `handoff_id` → 400; `checked` → repeat returns the stored outcome
  and writes nothing; another status → 409; not-in-batch, deleted and `urdu`-mismatch rows
  rejected with reasons; unchanged values dropped; a same-key `urdu_suggestion` dropped; apply
  writes only accepted fields, including a remove (null) and an add to an empty field; a field
  edited between preview and apply is kept and reported; an accept entry for a rejected row
  rejects the apply; schedule fields and `review_events` unchanged without reset; the reset
  matches `correctStep(0)` from the existing `last_reviewed_at` with no event; a reset whose rung
  moved since the read is skipped and reported; every batch id is stamped, `updated_at` untouched
  by the stamp; `accept: []` still stamps and moves the row to `checked`.
- **Client tests (s03):** the check prompt's shape and item listing; the preview model (diff rows,
  default-on field ticks, default-off reset, the accept list built from ticks with old values,
  Mark checked when nothing is ticked).
- **Phone smoke (smoke-test-11, written in s03, run in s04):** a real ChatGPT round trip on the
  installed app with, in one batch: an item with every change accepted, an item with one field
  accepted and one unticked, an item with reset ticked, and an item left out by the chat. The
  Vocab tab then shows the accepted values only, the reset item on rung 0 and every other
  schedule unchanged; the next Copy check prompt lists a fresh batch; a second paste of the same
  reply reports a repeat. The between-preview-and-apply edit is covered by the Worker test only:
  on the phone, leaving the preview sheet discards it.

### Done When

- `pnpm check` is green with the s01–s03 tests above (Worker, migration, input and client).
- Migration 0004 applied to local D1 (s01) and, by the sponsor, to remote **before** the deploy
  that carries it (s04).
- smoke-test-11 is green on the installed phone app.
- Ripples: PRD FR-F9 and Appendix A `checked_at` lose their *planned* marker; AGENTS Project state
  and PLAN roster updated; the f11 journal records the build.

### Roadmap

0. **s00 plan:** ✅ questions settled 2026-09-23; stress-tested 2026-09-24.
1. **s01 rotation:** migration 0004 (`checked_at`, `vocab_check` index) and its test;
   `VocabItem.checked_at`; `HANDOFF_STATUSES` += `check_issued`, `checked`;
   `POST /api/handoffs/check-batch`; batch tests.
2. **s02 corrections:** `parseCorrections` (preview and apply shapes);
   `POST /api/handoffs/corrections` with `?preview=1`; plan, field-guarded apply, guarded reset,
   stamping, handoff row transition; tests.
3. **s03 client:** `checkPrompt`; Copy check prompt and Paste corrections in the CHATGPT section;
   preview with per-field ticks and reset ticks; Apply / Mark checked; result screen with flags
   and Open links; client tests; write `smoke-tests/smoke-test-11.md`.
4. **s04 phone:** sponsor applies migration 0004 remotely **before** deploying, then deploys and
   runs smoke-test-11; ripple and close.

Each slice needs the one before it. s01–s03 are fully testable locally with `pnpm dev`; no OpenAI
key involved.

## Status

### Recently Completed

- 2026-09-23: drafted and opened from the sponsor's request (bulk accuracy check via the ChatGPT
  round trip), grounded in the FR-F7 revisions code.
- 2026-09-24: stress-tested; sponsor chose the Worker-recorded batch and per-field ticks; plan
  hardened (see Decisions).

### Next Steps

- s01 rotation.

### Open Questions

- None open.

## Decisions

- 2026-09-23: New feature f11 rather than reopening f06 (closed) or folding into f10 (voice-only,
  opens after f07). Built on the ChatGPT paste path, not an API call, for zero spend (260918f);
  overwrites existing values, which 260918g deferred to "a later edit-in-place feature".
- 2026-09-23: Sponsor settled the three planning questions. (1) A suspect Urdu spelling is flagged
  in the preview, never applied (agent recommendation). (2) Batches rotate through the whole vault by
  a new `vocab.checked_at`, 20 least recently checked, migration 0004 (sponsor chose this over the
  recommended filtered-list batch). (3) A per-item reset tick, off by default, with FR-F8 semantics
  (agent recommendation).
- 2026-09-24 (sponsor, stress test): **the Worker records the batch.** Copy check prompt writes a
  `check_issued` handoffs row holding the 20 ids under a server-minted `handoff_id`; apply stamps
  from it. Chosen over a client-held list in localStorage because it survives Android discarding
  the PWA mid-round-trip, works across devices, and lets the Worker reject a correction for an
  item outside the batch. Cost accepted: one row per copy, abandoned ones kept.
- 2026-09-24 (sponsor, stress test): **per-field ticks, on by default,** over per-item ticks
  (on or off): a mixed suggestion keeps its good fields without a hand edit.
- 2026-09-24 (agent, stress test):
  - The never-clobber guard is per field: apply sends the old value the preview showed for each
    accepted field and each write is conditioned on it. An item-level `updated_at` token was
    rejected because a review between preview and apply would block every field needlessly.
  - `corrections` may be empty, so an all-fine batch can be applied (Mark checked); FR-F7's
    non-empty `list()` rule would have contradicted this.
  - A correction may remove a field (null) or fill an empty one; the preview shows either, and the
    sponsor can untick it.
  - Stamping `checked_at` leaves `updated_at` alone, since a stamp is not an edit, and a
    stamp can't trip `review.ts`'s `updated_at` guard.
  - The reset reuses `correctStep(0, …)` (identical to an FR-D2 rung edit to 0) behind a
    `review.ts`-style schedule guard. f10's FR-F8 tool should reuse the same helper.
  - The **Open** link for a flag lives on the result screen, so leaving the preview never loses it.
  - The preview-then-edit race is proven by a Worker test, not the phone smoke, because the phone
    preview can't survive navigation.
  - s01 was split in two (rotation / corrections): the draft s01 held a migration, a route, a
    parser, a second route and four write rules.
