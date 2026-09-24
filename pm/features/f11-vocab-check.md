# Feature Plan — Vocab Check

**Status**: 🟡 IN PROGRESS — *opened 2026-09-23; s00 planning: three open questions for the sponsor, then stress-test.*
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
  Which 20 is open question 2.
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
- **Schedule and review history untouched** by default. An optional per-item interval reset is open
  question 3.

### Exclusions

- **Correcting the Urdu term itself.** The `urdu` echo is the guard that stops a reply landing on the
  wrong item; see open question 1.
- **A server-side LLM "Check" button** (Worker calls OpenAI): belongs with f08 `vocab-enrich`, on hold
  (260918f).
- **Voice edits**: f10 FR-F8, one item per spoken exchange.
- **A "last checked" date or rotation through the whole vault**: needs a migration; see open question 2.
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
  `review_events` unchanged (and, if question 3 lands yes, reset exactly as FR-F8).
- **Input tests:** strict parse of the corrections shape (unknown keys, missing `reason`, over 20).
- **Client tests:** the check prompt's shape and item listing; the preview model (diff rows, ticks).
- **Phone smoke (smoke-test-11):** a real round trip with ChatGPT on the installed app: one accepted
  correction, one rejected, one item edited between preview and apply, then the Vocab tab and a
  review confirm the schedule is unchanged.

### Done When

- smoke-test-11 is green on the installed phone app.
- `pnpm check` is green; PRD FR-F9, AGENTS Project state and PLAN are rippled.

### Roadmap

0. **s00 plan:** sponsor answers the open questions; `/pm-stress-test`.
1. **s01 Worker:** corrections input parser, `POST /api/handoffs/corrections` with `preview`, the
   still-old-value guard, tests.
2. **s02 client:** check prompt, paste + preview with old → new diff and ticks, apply; client tests.
3. **s03 phone:** sponsor deploys (no migration expected), smoke-test-11, close.

s01–s02 are fully testable locally with `pnpm dev`; no OpenAI key involved.

## Status

### Recently Completed

- 2026-09-23: drafted and opened from the sponsor's request (bulk accuracy check via the ChatGPT
  round trip), grounded in the FR-F7 revisions code.

### Next Steps

- Sponsor answers open questions 1–3, then `/pm-stress-test f11`, then s01.

### Open Questions

1. **Suspect Urdu spelling** (sponsor). Recommended: the chat may add `urdu_suggestion`; the preview
   shows it as a flag with a link to the item, never applied. Alternative: allow changing `urdu`
   (reworks the match guard and duplicate check — not recommended for v0).
2. **Which items go in a batch** (sponsor). Recommended: the Vocab list as currently filtered
   (search / tag / due-only, current sort), first 20; step through by paging. Alternative: a
   `checked_at` column and "20 least recently checked" rotation (migration 0004).
3. **Interval reset on a correction** (sponsor). Recommended: a per-item "reset to first rung"
   tick in the preview, off by default, with FR-F8's semantics (active ladder rung 0, `due_at` from
   the existing `last_reviewed_at`, no review event). Alternative: never reset here; use the Vocab tab.

## Decisions

- 2026-09-23: New feature f11 rather than reopening f06 (closed) or folding into f10 (voice-only,
  opens after f07). Built on the ChatGPT paste path, not an API call, for zero spend (260918f);
  overwrites existing values, which 260918g deferred to "a later edit-in-place feature".
