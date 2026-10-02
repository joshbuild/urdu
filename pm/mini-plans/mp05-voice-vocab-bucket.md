# Mini-plan — Voice vocab: whole-vault lookup and a Voice harvest bucket

**Status**: 🟡 IN PROGRESS — opened and stress-tested 2026-10-02; s01 build next (no migration)
**Handle**: `mp05`
**Created**: 2026-10-02 · **Updated**: 2026-10-02

**Owner docs it serves**:
- `pm/PRD.md` FR-G (voice Coach tools), FR-K (queue, sources and harvests), FR-F9 (check/fill)
- `pm/features/f07-coach-client.md` (voice tools, Coach prompt)
- `pm/features/f17-vocab-intake.md` (queued items, harvests; its "voice adds are released" rule changes here)
- `pm/DECISIONS.md` 261002a (Voice harvest words are held from automatic release)

**Companions**: f10 `coach-followups` (planned: vocab-edit voice tool). This mini-plan is
separate: it touches lookup and add only.

> **One-line:** the voice Coach can answer "do I have this word?" across the whole vault with a
> new `find_vocab` tool, and words it adds land queued and held in a per-day Voice harvest on the
> Harvest tab, where the sponsor lists, fills and releases them into review.

Sponsor request 2026-10-02: `get_vocab` returns at most 50 items, newest first, so with hundreds
of words the Coach cannot see most of the vault. Instead of feeding it the vault, add a bucket
of proposed vocab the sponsor checks later. Options weighed in the session (A lookup tool, B
Voice harvest, C new proposals table, D bigger limit or paging, E transcript-to-handoff); the
sponsor chose A + B. The stress test (2026-10-02) added the hold rule and the bucket UI (s03–s05).

---

## As-is

- `get_vocab` (`worker/coach/prompt.ts`, `worker/domain/voice.ts`): scope `due` or `all`,
  optional tag, `limit` ≤ 50 (`MAX_VOICE_VOCAB_LIMIT`). `all` is newest first, so older words are
  invisible to the Coach.
- `add_to_vault` already dedupes against the whole vault server-side (`createVocab` reports
  `duplicate` with the existing meaning). Adds are released at once (f17 Scope), with only
  urdu, roman, english and kind filled.
- `matchVocab`/`findIdByKey` (`worker/domain/vocab.ts`) match on `urdu_key` across the whole
  vault; `listVocab`'s `q` searches urdu_key, roman and english with LIKE.
- Tool calls arrive in the browser and are posted to `POST /api/voice/tools/:name`
  (`worker/routes/api-voice.ts` validates and runs; `src/voice/events.ts` labels each call and
  its result in the tool lines).
- The daily top-up and Intake (`worker/domain/intake.ts`) release the whole queue oldest first,
  whatever harvest an item came from. Harvest detail (`src/screens/HarvestScreen.tsx`
  `HarvestView`) shows counts and the new-vocab round trip, but not its words, and has no
  release. Fill/check (`worker/domain/check.ts`, f11/f13) selects across the whole vault.
- **Deploy prerequisite:** sources, harvests and `released_at` are migration 0007 (f17), applied
  locally only. mp05 adds no migration, but its phone check needs f17's deploy first.

## Design

1. **`find_vocab` tool (A).** Args `{ terms: string[] }`: 1–20 strings, each trimmed to 1–100
   characters; an unknown key is a 400, like the other tools. Each term is Urdu, Roman or
   English. Per term, in order:
   - **Exact Urdu:** `findIdByKey(urduKey(term))` when the key is non-empty. A hit returns that
     one item, `total: 1`.
   - **Search:** otherwise `listVocab` with `q: term`, `sort: "added"`, limit 20. Hits whose
     `roman` or `english` equals the term (trimmed, case-insensitive) come first, the rest
     newest first. The first 5 are returned, with `total` the search's full count.
   - Result `FindVocabResult = { results: [{ term, total, matches: [{ id, urdu, roman, english,
     mastery, queued }] }] }`; `matches` is empty when nothing matches. `queued` is
     `released_at === null`. Added to `VoiceToolResult` in `shared/api.ts`.
   - Read-only: no `once` record, no top-up. Queued items are found like any other.
   - Coach prompt: "is X in my vocab" and "what's my word for Y" ask the backend to find it;
     "what's due" and "my recent words" still get the vocabulary. Backend prompt: `find_vocab`
     for whether words are in the vault, `get_vocab` for due or recent words.
2. **Voice harvest (B).** `add_to_vault` creates items **queued** (`released_at` null) and
   linked to today's Voice harvest:
   - One source named "Voice" (no URL, notes "Words the voice Coach added"), its id in a
     `settings` row `voice_source_id`. If the row is missing or names a deleted source, a new
     source is created and the row upserted.
   - One harvest per HOME_TZ day under that source, with a null filter: the source's latest
     harvest is reused when `todayIn(HOME_TZ, created_at)` equals today; otherwise a new one is
     created. If `createHarvest` returns null (the source vanished meanwhile), the source is
     recreated once and the harvest retried; a second failure throws, so nothing is recorded
     and the Coach's retry can succeed.
   - The bucket is resolved on the first item not already in the vault (`findIdByKey`), so a
     call made only of duplicates or rejects creates no source or harvest.
   - Duplicates are unchanged: reported, not linked. Earlier voice adds stay released and
     unlinked.
   - The `created` outcome gains `queued: true`. The Coach says the word is saved in today's
     Voice harvest for checking, not that it is in review.
   - `voiceAddToVault` takes the time zone; the route passes `c.env.HOME_TZ`.
3. **Hold (sponsor, DECISIONS 261002a).** Items in a harvest of the Voice source are **held**:
   the daily top-up and Intake skip them, and `intakeCounts.queued` (the tank and the Intake
   offer) excludes them. They enter review only by Release now (one item), Release all (the
   harvest, s04) or a tracked review (unchanged f17 rule). Deleting the Voice source unlinks
   its items, which then join the ordinary queue. In SQL the guard is
   `(harvest_id IS NULL OR harvest_id NOT IN (SELECT id FROM harvests WHERE source_id =
   (SELECT value FROM settings WHERE key = 'voice_source_id')))`; a bare `NOT IN` drops
   unlinked rows, because `NULL NOT IN (…)` is null. With no `voice_source_id` row, nothing is
   held.
4. **Checking the bucket (sponsor: list, release and scoped fill).** On every harvest's detail,
   not only Voice:
   - **Words:** the harvest's items, newest first, up to 200 (`MAX_LIMIT`), with "showing 200
     of *n*" past that: Urdu, Roman, English and a Queued badge. Tapping a word opens it in the
     Vocab tab (`onOpenVocab`), where it can be edited or released one at a time.
   - **Release all (*q*)**, shown while the harvest has queued items, behind a confirm sheet
     ("Release *q* words into review?"), because a big harvest can flood review and there is no
     re-queue.
   - **Fill and check:** the Vocab tab's check rows (mode, fields, count, only unchecked, Copy
     check prompt, Paste corrections), limited to this harvest's items. The corrections paste
     and apply rules are unchanged.
5. **Review of a queued voice word.** Unchanged f17 rule: a tracked review releases it, held or
   not. The due tool never offers held words, so this happens only when the sponsor asks for a
   specific word.

## Stages

- **Stage 1 — worker** (s01–s03), no migration.
- **Stage 2 — Harvest tab** (s04–s05), client plus small worker additions.
- **Stage 3 — docs and phone** (s06–s07). Live voice runs against the deployment only
  (DECISIONS 260921a), after f17's deploy has applied 0007 remotely (or in the same deploy).

## Slices

- **mp05-s01 `find_vocab`.** Tool schema in `prompt.ts` (`terms`: array of strings,
  `minItems` 1, `maxItems` 20), `parseFindVocab` in `voice-input.ts`, `voiceFindVocab` in
  `voice.ts`, route case in `api-voice.ts`, `FindVocabResult` in `shared/api.ts`, the tool's
  label and result detail in `src/voice/events.ts`, Coach and backend prompt lines (Design 1).
  Verify: `test/voice.test.ts` — an item older than the newest 50 found by Urdu, by Roman and
  by English; exact Roman/English ranked first; a queued item flagged; no match; more than 5
  hits (5 returned, `total` right); 0 and 21 terms, an empty and a 101-character term, and an
  unknown key rejected; `src/voice/events.test.ts` for the label. Targeted runs first.
- **mp05-s02 Voice harvest.** `voiceBucket(db, now, timeZone)` in `harvest.ts`;
  `voiceAddToVault` resolves it lazily and creates with `{ queued: true, harvestId }`; the
  `created` outcome gains `queued: true` in `shared/api.ts`; the route passes HOME_TZ; prompt
  lines (Design 2). Verify (`test/voice.test.ts`): the first add creates the source, the
  settings row and a harvest; a second add the same HOME_TZ day reuses the harvest; an add the
  next HOME_TZ day makes a new one under the same source; a deleted source is recreated and the
  row rewritten; a duplicates-only call creates no source or harvest; a duplicate is not
  linked; a created item is queued and not in the due read; a replayed `call_id` creates
  nothing.
- **mp05-s03 Hold rule.** The guard in `topUpIntake`/`claimAndRelease`, `releaseNext` and
  `intakeCounts` (Design 3). Verify (`test/intake.test.ts`): top-up and Intake skip held items
  and still release ordinary ones in FIFO order; `intakeCounts.queued` excludes held items;
  Release now and a tracked review release a held item; after the Voice source is deleted its
  former items are released by top-up; with no `voice_source_id` row nothing is held.
- **mp05-s04 Harvest words and Release all.** Worker: `GET /api/vocab?harvest=<id>`
  (`ListQuery.harvest`, combinable with the other filters); `POST /api/harvests/:id/release`
  releases every queued item of the harvest, held or not, and returns `{ released }`; 404 for an
  unknown harvest. Client: the Words list and Release all with its confirm sheet in
  `HarvestView` (Design 4). Verify: `test/harvest.test.ts` (filter; release all on a mixed
  harvest, an empty one and an unknown id; `released_at` set and `updated_at` unchanged),
  `HarvestScreen.test.ts` (the list's text, the button's label and hidden state), headless
  360 px screenshots of a harvest detail with words and the confirm sheet.
- **mp05-s05 Harvest-scoped fill.** `CheckOptions.harvest_id` (optional) in `shared/api.ts`
  and the check-batch parser; `issueCheckBatch` adds `harvest_id = ?` to its candidates as a
  bound parameter, so both counts are scoped too; an unknown harvest yields no items. Client:
  the check rows in `HarvestView` with the harvest fixed, reusing the Vocab tab's components
  (extract them if they are not reusable as they stand). Verify: `test/check.test.ts` (scoped
  selection and counts; unscoped behaviour unchanged), a client test that the harvest's id is
  sent, a headless 360 px screenshot.
- **mp05-s06 Doc ripple and local walk.** Under `pnpm dev`, seed two words through
  `POST /api/voice/tools/add_to_vault` and walk the Voice harvest: listed, held out of Intake,
  filled through a check prompt, released by Release all. Ripple: PRD FR-G (`find_vocab`, queued
  voice adds), FR-K1 (voice adds queued in the Voice harvest), FR-K2 (held items), FR-K3 (Words,
  Release all, scoped fill), FR-K4 (the tank excludes held items), FR-F9 (harvest scope); f17
  Scope line ("voice adds are released" → changed by mp05); f07 tool list; CHANGELOG
  `[Unreleased]`; `smoke-tests/smoke-test-mp05.md`. AGENTS Project state and the due/queue
  invariant ("Voice harvest words are held from top-up and Intake") at close.
- **mp05-s07 phone.** Sponsor, on a deploy that has 0007 remotely: smoke-test-mp05. Ask by voice
  about an old word (found) and a missing one (not found); add two words (queued, in today's
  Voice harvest, not offered by Intake or the tank); fill them through the harvest's check
  prompt; Release all; see them in review.

## Done When

1. s01's `find_vocab` tests pass, including an item older than the newest 50 found by Urdu,
   Roman and English. *(s01)*
2. s02's Voice harvest tests pass: queued, linked to the HOME_TZ day's harvest, not due;
   duplicates reported and not linked; no empty bucket from a duplicates-only call. *(s02)*
3. s03's hold tests pass: top-up and Intake skip Voice harvest words, the tank count excludes
   them, and manual release and tracked reviews still release them. *(s03)*
4. s04's harvest filter and Release all tests and s05's scoped check tests pass. *(s04, s05)*
5. `pnpm check` green. The headless 360 px screenshots of the harvest detail (Words, the
   confirm sheet, the check rows) show no clipped or overlapping text. *(s04, s05; agent
   eyeball, owed)*
6. The local walk in s06 passes, and the ripple is written: PRD FR-G, FR-K1–K4, FR-F9; f17
   Scope; f07 tool list; CHANGELOG; `smoke-tests/smoke-test-mp05.md`. *(s06)*
7. The sponsor runs smoke-test-mp05 green on the phone. *(s07; sponsor eyeball, owed)*

---

## Open Questions

- None blocking.

---

## Decisions

- 2026-10-02 (sponsor) — **A + B.** A whole-vault lookup tool and a queued Voice harvest; not a
  separate proposals table (duplicates the queue), not a bigger `get_vocab` limit (cost and
  latency grow with the vault), not transcript-to-handoff.
- 2026-10-02 (sponsor, by choosing B as proposed) — **Voice adds are queued**, not released, so
  the Voice harvest is a real check-before-review bucket.
- 2026-10-02 (sponsor, stress test) — **Voice harvest words are held** from the daily top-up and
  Intake until released by hand or by a tracked review (DECISIONS 261002a). Without it, top-up
  would release an unchecked word the next day when the queue is short, or bury it behind a big
  harvest when it is long. Keyed on the Voice source, so no migration; rejected: a plain FIFO
  queue, a `held` column.
- 2026-10-02 (sponsor, stress test) — **The bucket gets a words list, Release all and a
  harvest-scoped fill** on the harvest detail. Today's harvest detail can do none of the three,
  and the vault-wide fill rotation would reach new voice words last. Rejected: list and release
  only; no new UI.
- 2026-10-02 — One harvest per HOME_TZ day, not per voice session: a day is the unit the
  sponsor checks, and a session id means nothing on the Harvest tab.
- 2026-10-02 — The Voice harvest's filter is null; the source's name says what it is. The
  ChatGPT round trip stays on it unchanged (harmless; not worth a special case).
- 2026-10-02 — Words, Release all and scoped fill work on every harvest, not only Voice: one
  code path, and an ordinary harvest benefits too. Release all asks for confirmation; Intake
  doesn't, because it is capped at the batch size.
- 2026-10-02 — `find_vocab` tries the exact `urdu_key` first, then a search with exact
  Roman/English hits ranked first, 5 per term with the full count, so "water" finds پانی ahead
  of newer "watermelon" items, and the Coach knows when there are more.
- 2026-10-02 — The bucket is created on the first genuinely new word, so a duplicates-only
  voice add leaves no empty harvest behind.
