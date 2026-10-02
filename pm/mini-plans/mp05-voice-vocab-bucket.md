# Mini-plan — Voice vocab: whole-vault lookup and a Voice harvest bucket

**Status**: 🟡 IN PROGRESS — opened 2026-10-02; s01 build next (no migration)
**Handle**: `mp05`
**Created**: 2026-10-02 · **Updated**: 2026-10-02

**Owner docs it serves**:
- `pm/PRD.md` FR-G (voice Coach tools), FR-K (queue, sources and harvests)
- `pm/features/f07-coach-client.md` (voice tools, Coach prompt)
- `pm/features/f17-vocab-intake.md` (queued items, harvests; its "voice adds are released" rule changes here)

**Companions**: f10 `coach-followups` (planned: vocab-edit voice tool). This mini-plan is
separate: it touches lookup and add only.

> **One-line:** the voice Coach can answer "do I have this word?" across the whole vault with a
> new `find_vocab` tool, and words it adds land queued in a per-day Voice harvest on the Harvest
> tab, where the sponsor checks and fills them before releasing them into review.

Sponsor request 2026-10-02: `get_vocab` returns at most 50 items, newest first, so with hundreds
of words the Coach cannot see most of the vault. Instead of feeding it the vault, add a bucket
of proposed vocab the sponsor checks later. Options weighed in the session (A lookup tool, B
Voice harvest, C new proposals table, D bigger limit or paging, E transcript-to-handoff); the
sponsor chose A + B.

---

## As-is

- `get_vocab` (`worker/coach/prompt.ts`, `worker/domain/voice.ts`): scope `due` or `all`,
  optional tag, `limit` ≤ 50 (`MAX_VOICE_VOCAB_LIMIT`). `all` is newest first, so older words are
  invisible to the Coach.
- `add_to_vault` already dedupes against the whole vault server-side (`createVocab` reports
  `duplicate` with the existing meaning). Adds are released at once (f17 Scope), with only
  urdu, roman, english and kind filled.
- `matchVocab` (`worker/domain/vocab.ts`, f14) matches a word list on `urdu_key` across the
  whole vault; `listVocab`'s `q` searches urdu_key, roman and english with LIKE.
- Tool calls arrive in the browser and are posted to `POST /api/voice/tools/:name`
  (`src/voice/events.ts` dispatches by name; `worker/routes/api-voice.ts` validates and runs).

## Design

1. **`find_vocab` tool (A).** Args `{ terms: string[] }`, 1–20 terms. Each term is Urdu, Roman
   or English. Per term: an exact `urdu_key` match first (as `matchVocab`); otherwise the
   `listVocab` `q` search, up to 5 hits. Result per term: `{ term, matches: [{ id, urdu, roman,
   english, mastery, queued }] }`, empty when nothing matches. Read-only, so no `once` record.
   Coach prompt: "is X in my vocab" and "what's my word for Y" go to the backend's find tool;
   `get_vocab` stays for due lists and recent words.
2. **Voice harvest (B).** `add_to_vault` creates items **queued** (`released_at` null) and
   linked to today's Voice harvest:
   - One source named "Voice" (no URL), its id kept in a `settings` row `voice_source_id`,
     created lazily on the first voice add. If the row is missing or its source was deleted, a
     new source is created and the row rewritten.
   - One harvest per HOME_TZ day under that source (filter "voice"), found by `created_at`
     falling in today, created lazily.
   - Duplicates are unchanged: reported, not linked.
   - The add result's `created` outcome gains `queued: true`, and the Coach says the word is in
     today's Voice harvest for checking, not that it is in review.
3. **Checking the bucket.** The Voice harvest appears on the Harvest tab like any other. The
   sponsor fills notes and examples with the existing harvest/ChatGPT flow and releases with
   Release now or Intake. s03 confirms which of those already work from a harvest and closes
   any gap.
4. **Review of a queued voice word.** Unchanged f17 rule: a tracked review releases it. So a
   word quizzed by voice before it is checked enters review anyway; that is acceptable.

## Stages

- **Stage 1 — build** (s01–s03), no migration.
- **Stage 2 — phone** (s04), rides any deploy; live voice runs against the deployment only
  (DECISIONS 260921a).

## Slices

- **mp05-s01 `find_vocab`.** Tool schema in `prompt.ts`, arg parser in `voice-input.ts`,
  `voiceFindVocab` in `voice.ts`, route case in `api-voice.ts`, client dispatch in
  `src/voice/events.ts`, Coach and backend prompt lines. Verify: `test/voice.test.ts` cases for
  exact Urdu, Roman/English search, no match, term limit; targeted run first.
- **mp05-s02 Voice harvest.** Lazy source and per-day harvest in `harvest.ts` (or `voice.ts`),
  `voiceAddToVault` creates queued items with `harvestId`, result gains `queued`, prompt line.
  Verify: tests for first add (source + harvest created), second add same day (same harvest),
  next day (new harvest), deleted source recreated, duplicate not linked, item not due.
- **mp05-s03 bucket UI check.** Walk the Voice harvest on the Harvest tab under `pnpm dev`
  (seed via the tool route): it lists, its items can be filled and released. Fix any gap found.
  Ripple: f17 Scope ("voice adds are released") → PRD FR-K, FR-G; AGENTS Project state at close.
- **mp05-s04 phone.** `smoke-tests/smoke-test-mp05.md`: ask by voice about an old word (found),
  a missing word (not found), add two words (queued, in today's Voice harvest), fill and release
  them, see them in review.

## Done When

1. `find_vocab` finds an item older than the newest 50 by Urdu, Roman and English, in tests and
   by voice on the phone.
2. A voice add creates a queued item in today's Voice harvest; it is not due until released;
   a duplicate is reported and not linked.
3. The Voice harvest can be checked, filled and released from the Harvest tab.
4. `pnpm check` green; PRD FR-G/FR-K and f17's voice-add rule rippled; smoke-test-mp05 green.

---

## Open Questions

- Per-day harvest vs per voice session: per day chosen as simpler to review; revisit if a day
  holds several unrelated sessions. Agent call, open to the sponsor.

---

## Decisions

- 2026-10-02 (sponsor) — **A + B.** A whole-vault lookup tool and a queued Voice harvest; not a
  separate proposals table (duplicates the queue), not a bigger `get_vocab` limit (cost and
  latency grow with the vault), not transcript-to-handoff.
- 2026-10-02 (sponsor, by choosing B as proposed) — **Voice adds are queued**, not released, so
  the Voice harvest is a real check-before-review bucket.
