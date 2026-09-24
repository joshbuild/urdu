# Feature Plan — Vocab Check

**Status**: 🟡 IN PROGRESS — *opened 2026-09-23; s00 planning: open questions settled 2026-09-23, stress-test next.*
**Handle**: `f11`
**Created**: *2026-09-23* · **Updated**: *2026-09-23*

**Owner docs it serves**:
- `pm/PRD.md` — FR-F9 (new, planned), beside FR-F7 fill-ins and FR-D2 edit rules
- `pm/DECISIONS.md` — 260918f (ChatGPT paste path first), 260918g (fill-ins never overwrite; "a later edit-in-place feature if wanted" — this is it), 260922a (FR-F8 overwrite rules and interval reset)
- Code it extends: `worker/domain/handoff.ts` (`reviseVocab`), `worker/domain/handoff-input.ts`, `worker/routes/api-handoff.ts`, `src/handoff/prompts.ts`, `src/handoff/HandoffPanel.tsx`

> **One-line:** A ChatGPT copy–paste round trip that checks existing vocab entries for accuracy and, after a per-item old → new preview the sponsor accepts, overwrites the wrong fields.

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

- **Copy check prompt** on the Vocab tab's CHATGPT section: a self-contained prompt (like
  `fillInPrompt`) listing up to 20 items with id and every present field, asking for corrections only
  where a field is wrong or unidiomatic, each with a short `reason`, and omitting items that are fine.
- **Rotation (migration 0004):** a nullable `vocab.checked_at`. The batch is the 20 least recently
  checked: never-checked first, then oldest `checked_at`, ties by `added_at`. Applying a batch stamps
  every item that was *in the batch*, including ones the chat left alone and corrections the sponsor
  rejected, so the sweep moves on; a batch with nothing to correct is still applied ("Mark checked").
  How the Worker learns the batch's ids is a stress-test item. A Vocab-tab edit does not touch
  `checked_at`. The export carries the column.
- **Paste corrections**: `{handoff_id, corrections:[{vocab_id, urdu, roman?, english?, notes?,
  example_urdu?, example_english?, reason, urdu_suggestion?}]}` validated strictly, invalid JSON
  rejected with the reason, never repaired.
- **Preview** (server-computed, writes nothing): per item, each changed field as old → new plus the
  reason; the sponsor ticks which items to apply. An unchanged proposed value is dropped, not shown.
- **Apply**: overwrites the accepted fields under the Vocab-tab edit rules. Guards carried from FR-F7:
  the echoed `urdu` must match the stored item by `urdu_key`, unknown ids are reported not guessed, a
  repeated `handoff_id` is a no-op returning the stored outcome. New guard: a field is written only if
  it still holds the previewed old value, so an edit made between preview and apply is never
  clobbered.
- **Suspect Urdu spelling:** the chat may add `urdu_suggestion`; the preview shows it as a flag
  linking to the item. It is never applied.
- **Schedule and review history untouched** by default. Each preview item has a "reset to first
  rung" tick, off by default, with FR-F8's semantics: rung 0 of the active ladder, `due_at` recomputed
  from the existing `last_reviewed_at`, no review event.

### Exclusions

- **Correcting the Urdu term itself.** The `urdu` echo is the guard that stops a reply landing on the
  wrong item; a suspect spelling is flagged only and fixed on the Vocab tab.
- **A server-side LLM "Check" button** (Worker calls OpenAI): belongs with f08 `vocab-enrich`, on hold
  (260918f).
- **Voice edits**: f10 FR-F8, one item per spoken exchange.
- **Choosing the batch by the Vocab list's filters**: rotation by `checked_at` replaced it.
- **Tags, favourite, kind**: not proposed by the chat; edited on the Vocab tab.
- **Auto-apply without preview**: the chat's output is a proposal (260918g).

### User Stories

- As the learner, I copy a check prompt for a batch of my words, paste ChatGPT's reply, and see only
  the entries it thinks are wrong, so that I can fix mistakes without reading every entry myself.
- As the learner, I see each change as old → new with a reason and pick which to accept, so that a bad
  suggestion never overwrites a good entry.
- As the learner, a correction doesn't disturb my review schedule unless I ask, so that fixing a typo
  doesn't cost me progress.

### Non-Functional Requirements

- **No spend:** no API call; the chat runs in the sponsor's ChatGPT subscription.
- **Deterministic writes:** Urdu Core validates, matches and writes; the client computes nothing but
  the tick list.
- **Never clobber:** an apply cannot overwrite a value that changed after its preview.
- **Reply reliability:** batch of 20, as FR-F7.
- **Device:** installed Android Chrome; the old → new preview must be readable at phone width, Urdu
  fields RTL in Nastaliq.

## Planning

### Testing

- **Worker tests:** preview writes nothing (not even the handoff row); apply overwrites only accepted
  fields; `urdu` mismatch and unknown id rejected with reasons; an unchanged value is dropped; a field
  edited since preview is kept and reported; repeated `handoff_id` is a no-op; schedule fields and
  `review_events` unchanged; the reset tick matches FR-F8 exactly (rung 0, due from the existing
  `last_reviewed_at`, no event); every batch item is stamped `checked_at`, and a batch with no
  corrections still stamps; the batch query orders never-checked, then oldest checked, then
  `added_at`.
- **Migration test:** 0004 adds `checked_at` as null on every existing row, rows intact; local D1 run.
- **Input tests:** strict parse of the corrections shape (unknown keys, missing `reason`, over 20).
- **Client tests:** the check prompt's shape and item listing; the preview model (diff rows, ticks).
- **Phone smoke (smoke-test-11):** a real round trip with ChatGPT on the installed app: one accepted
  correction, one rejected, one with the reset ticked, one item edited between preview and apply;
  then the Vocab tab confirms the schedule is unchanged except the reset item, and the next Copy
  check prompt lists a fresh batch.

### Done When

- smoke-test-11 is green on the installed phone app.
- `pnpm check` is green; PRD FR-F9, AGENTS Project state and PLAN are rippled.

### Roadmap

0. **s00 plan:** sponsor answers the open questions; `/pm-stress-test`.
1. **s01 Worker:** migration 0004 `checked_at`, the batch route, corrections input parser,
   `POST /api/handoffs/corrections` with `preview`, the still-old-value guard, reset, stamping, tests.
2. **s02 client:** check prompt, paste + preview with old → new diff and ticks, apply; client tests.
3. **s03 phone:** sponsor applies migration 0004 remotely **before** deploying, then deploys;
   smoke-test-11, close.

s01–s02 are fully testable locally with `pnpm dev`; no OpenAI key involved.

## Status

### Recently Completed

- 2026-09-23: drafted and opened from the sponsor's request (bulk accuracy check via the ChatGPT
  round trip), grounded in the FR-F7 revisions code.

### Next Steps

- `/pm-stress-test f11`, then s01. Known stress-test item: how apply learns the batch's ids (the
  client-held batch from the copy step vs. a server-recorded batch keyed by `handoff_id`).

### Open Questions

- None open. The three planning questions were settled by the sponsor on 2026-09-23 (see Decisions).

## Decisions

- 2026-09-23: New feature f11 rather than reopening f06 (closed) or folding into f10 (voice-only,
  opens after f07). Built on the ChatGPT paste path, not an API call, for zero spend (260918f);
  overwrites existing values, which 260918g deferred to "a later edit-in-place feature".
- 2026-09-23: Sponsor settled the three planning questions. (1) A suspect Urdu spelling is flagged
  in the preview, never applied (agent recommendation). (2) Batches rotate through the whole vault by
  a new `vocab.checked_at`, 20 least recently checked, migration 0004 (sponsor chose this over the
  recommended filtered-list batch). (3) A per-item reset tick, off by default, with FR-F8 semantics
  (agent recommendation).
