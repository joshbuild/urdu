# Feature Plan — Vocab Intake

**Status**: 🟡 IN PROGRESS — *opened 2026-10-01; s01–s06 built and the s07 doc ripple written the same day; sponsor deploy and smoke-test-17 next*
**Handle**: `f17`
**Created**: *2026-10-01* · **Updated**: *2026-10-01*

**Owner docs it serves**:
- `pm/PRD.md`: new FR-K (this feature); amends FR-A7 (due order), FR-E1 (start screen), FR-I1 (setting), FR-J2/J5 (Dash counts), Appendix A; parks FR-C (Reader)
- `pm/DECISIONS.md` 261001b
- Research: `pm/research/vocab-intake.md` (options, the sponsor's answers)
- Code it extends: `worker/domain/vocab.ts`, `worker/domain/review.ts`, `worker/domain/handoff.ts`, `worker/domain/export.ts`, `worker/domain/settings.ts`, `shared/api.ts`, `shared/dash.ts`, `src/screens/tabs.ts`, `src/screens/ReviewScreen.tsx`, `src/handoff/HandoffPanel.tsx`, `src/vocab/*`, `src/screens/SettingsScreen.tsx`

> **One-line:** Harvested words wait in a queue and enter review a batch at a time. A Harvest tab, which replaces the parked Read tab, keeps a record of sources and harvests, and a tank meter shows how many days of new words are left.

## Intent

### Vision

The sponsor harvests vocab from stories with ChatGPT. Today every pasted word is due at once,
so the weekend of 2026-09-26 turned one big harvest into a week of heavy reviews. Adding a word
should no longer mean reviewing it straight away. A harvest goes into a queue in one sitting, and
the app releases about 10 new words a day, oldest first. When there is time for more, **Intake**
pulls in another batch. A tank meter shows when the queue is running low and it is time to
harvest again. Sources and their harvests (URL, filter such as "CEFR A2+", date) are recorded, so
the sponsor can see which stories have been harvested and how far each harvest has got.

### Scope

- **Queued items.** A new `vocab.released_at`; `NULL` means queued. A queued item is a normal
  vault row (search, edit, checks and Find new words all see it), but it is not due and has no
  review history. Paste through a harvest creates queued items by default. Manual adds, voice
  adds and Airtable imports are released when they are created.
- **Daily top-up.** Once per HOME_TZ day, the queue tops up the **new pile** to the batch size.
  The new pile is released items that have never been reviewed. Queued items are released oldest
  first. Lazy: it runs on the first qualifying request of the day (§Release rules).
- **Intake.** A button on the Review start screen releases the next batch on demand.
- **Due order (FR-A7 change).** Due items come first, and never-reviewed items come after them,
  so stopping early on a heavy day leaves new words unseen.
- **Sources and harvests.** A source (name, optional URL, notes) can be *to harvest* or
  *harvested*. A harvest (source, filter, date) collects one or more pastes.
- **Harvest tab** in the Read tab's place: the tank, the sources list, each source's harvests,
  and the new-vocab round trip (it moves here from the Vocab tab).
- **Tank meter** on the Harvest tab and the Review start screen.
- **Queued in the Vocab tab:** a "Queued" badge, a Queued filter, and **Release now** on a queued
  item.
- **Setting:** "New words per day" (the batch size), 1–50, default 10, stored in the vault.
- **Read parked:** removed from the tab bar, code and tests kept, review on 2026-10-31 (TODO).
- **Dash:** queued items are excluded from its counts (§Dash).

### Exclusions

- No re-queue of items already released or reviewed (sponsor, 2026-10-01).
- No change to the `vocab-json` reply or the FR-F4 handoff schema. A paste learns its source
  from the harvest it is pasted into, not from ChatGPT (sponsor, 2026-10-01).
- No scheduled Worker (cron). The top-up is lazy.
- No first-days recognition-only rule for new items (a ladder question, deferred).
- No tank on the Dash.
- Reader code is not deleted.

### User Stories

- As the learner, I want to harvest a whole story in one sitting without facing all of it in
  review the next day.
- As the learner, I want about 10 new words a day without managing batches, and more when I have
  time.
- As the learner, I want to see which sources I've harvested, at what level, and how far each
  harvest has got.
- As the learner, I want a glance to tell me when my queue is running low.

### Non-Functional Requirements

- The release rules are deterministic Urdu Core code with Worker tests. ChatGPT proposes entries
  and nothing else (AGENTS invariant).
- The top-up is idempotent and race-safe: two concurrent first-of-day requests release one batch,
  not two.
- No new dependency. The tank is hand-written SVG coloured from CSS variables, like the Dash.
  The app has a light theme only.
- Six tabs still fit at 360 px (the tab count is unchanged).

## Planning

### Data (migration `0007_vocab_intake.sql`)

- `sources`: `id` (ULID) · `name` (trimmed, 1–200) · `url` (nullable, trimmed, ≤ 2000,
  `http://` or `https://`) · `notes` (nullable) · `created_at` · `updated_at`. A unique index on
  `url` where it is not null: the URL is the source's identity. Comparison is exact after
  trimming; no other normalisation.
- `harvests`: `id` (ULID) · `source_id` (NOT NULL, references `sources`) · `filter` (nullable,
  trimmed, ≤ 100, free text such as "CEFR A2+") · `created_at`.
- `vocab.harvest_id` (nullable, references `harvests`) and `vocab.released_at` (nullable
  instant). The backfill sets `released_at = added_at` on every existing row, so nothing already
  in the vault becomes queued.
- `settings` keys: `intake_batch_size` (default 10 when absent) and `intake_topup` (the top-up
  claim, `<HOME_TZ date>:<ulid>`).
- Deletes are explicit in domain code in one `db.batch`, so they don't depend on the FK pragma.
  Deleting a source deletes its harvests and sets `harvest_id = NULL` on their items; the items
  stay in the vault, queued or not. A harvest can be deleted only while it has no items.
- Migration order: 0007 follows 0005 and 0006, which are not yet applied remotely (f12, f13). A
  remote `migrations apply` applies all three in order.

### Release rules (`worker/domain/intake.ts`)

- **Queued** = `released_at IS NULL`. **New pile** = `released_at IS NOT NULL AND
  last_reviewed_at IS NULL`. **Queue order (FIFO)** = `added_at ASC, id ASC`.
- **Due predicate** (FR-A7): `released_at IS NOT NULL AND (due_at IS NULL OR due_at <= ?)`.
  **Due order**: `due_at ASC NULLS LAST, added_at ASC, id ASC`. Due items come first by due
  time, then the new pile in FIFO order. The Vocab list's "next review" sort uses the same order,
  with queued items after everything else. Every caller of `dueVocab` gets this: the review
  session, review ahead and the voice Coach's due tool.
- **Top-up** `topUpIntake(db, now)`:
  1. Claim today: upsert `intake_topup` to `<today>:<new ulid>` only where the stored date is
     before today (or the row is absent).
  2. In the same `db.batch`, release `max(0, batch size − new pile)` queued items in FIFO order,
     guarded on `intake_topup` equalling this call's value. A losing concurrent call releases
     nothing.
  3. Release sets `released_at = now`. `updated_at` is not bumped, because release is not an
     edit and must not trip the review or check stale-guards.
- **Top-up call sites**: `GET /api/status`, `GET /api/vocab/due`, `GET /api/dash`,
  `GET /api/harvest`, and the voice due tool. It runs before the read. A failed top-up is
  logged, and the read still answers.
- **Intake** `POST /api/intake/release`, body `{count?}` (integer 1–50, default batch size;
  strict: unknown key → 400). It releases the next `count` queued items in FIFO order, ignores
  the claim, and returns `{released, queued}`. With an empty queue it returns `released: 0`.
- **Release one**: `POST /api/vocab/:id/release`. It releases a queued item (200 with the item),
  is a no-op on a released item (200), and returns 404 if the id is unknown.
- **A tracked review releases.** `applyReview` sets `released_at = now` on a queued item (for
  example a word the voice Coach graded). Otherwise the item would be scheduled but never due.
  Supported, logged-only events (`logSupported`) leave it queued.
- **Batch size**: `GET/PATCH /api/settings` gains `intake_batch_size` (integer 1–50). A change
  applies from the next top-up or Intake; it does not release or hide items.
- **Tank**: queued count `Q`, batch size `N`. Days of supply `D = ceil(Q / N)`. **Low** when
  `Q < 3 × N` (less than three full days) and `Q > 0`. **Empty** when `Q = 0`. Fill fraction
  `min(Q / (14 × N), 1)`, so two weeks of supply reads as full. `GET /api/status` returns
  `intake: {queued, new, batch_size}`.

### Harvest tab

- **Tabs**: `harvest · vocab · review · dash · voice · settings`, label "Harvest".
  `DEFAULT_TAB = "review"`. A stored `"read"` fails `isTab` and falls back to Review.
  `ReaderScreen` is no longer rendered; its code and tests stay.
- **Overview** (`GET /api/harvest`): the tank, then the sources. *To harvest* sources (no
  harvests) come first, newest first. *Harvested* sources follow, by latest harvest, newest
  first. Each row shows the name, the URL's host, the status chip and, if harvested, the latest
  filter and date.
- **Sources**: **Add source** takes a name (required), a URL (optional) and notes. Edit. Delete
  asks for confirmation ("*k* words stay in your vault"). Adding or editing to a URL that another
  source has → 409 with that source's id; the sheet says "Already in your sources" and opens that
  source, along with its earlier harvests and filters.
- **Source detail** lists its harvests: filter, date, and counts *total · queued · started*
  (started = reviewed at least once). An empty harvest has Delete. **New harvest** takes the
  filter (optional, prefilled with this source's last filter).
- **Harvest detail**: the new-vocab round trip, moved from the Vocab tab's CHATGPT section with
  its ⓘ help:
  1. **Copy harvest request**: copies `vocab-list` followed by the source URL (or name) and "at
     <filter> or above" when a filter is set. It runs the f14 command that already exists; the
     Project instructions don't change.
  2. **Find new words** (f14, unchanged).
  3. **Copy new-vocab prompt** (FR-F6, unchanged).
  4. **Paste new vocab**: posts to `POST /api/harvests/:id/handoffs` with the FR-F4 JSON as the
     body and `?start=1` when the **Start now** box is ticked. The box is off by default; the
     default is "Queue these words".
- **Paste outcome**: `importHandoff` takes `{harvestId, queued}`. Created items get the
  `harvest_id`, with `released_at = NULL` (queued) or `now` (start now). A duplicate stays linked
  to its original harvest, if any. A repeated `handoff_id` returns the stored outcome and creates
  no links. The result view adds "*n* queued" or "*n* started".
- **Vocab tab CHATGPT section**: keeps the check rows (f11/f13). The new-vocab rows are removed.
  Every new-vocab paste goes through a harvest, so for an ad-hoc chat the sponsor makes a source
  such as "ChatGPT chat". `POST /api/handoffs` stays in place under the FR-F4 contract, though
  the app no longer calls it.

### Review, Vocab, Settings

- **Review start screen**: "*d* due · *n* new" (new = the new pile, counted inside due as
  today), the tank (compact), and **Intake +*k*** with `k = min(N, Q)`, hidden when `Q = 0`.
  Intake releases, then refetches the status; there is no confirm step. Intake is on the start
  screen only, not during a session.
- **Vocab list and detail**: a queued item shows a "Queued" badge instead of its mastery pill
  and "Queued" instead of a due time (`src/vocab/list.ts` `isDue` and the due label account for
  `released_at`). A **Queued** filter. The detail shows **Release now** on a queued item.
  Editing, a step correction or a check on a queued item leaves it queued.
- **Settings**: "New words per day", a number input from 1 to 50, with the hint "Released each
  day when the new pile is below it; also the size of Intake."

### Dash

- **J2**: "New" counts the new pile only; queued items are not counted.
- **J1** band history: an item exists from its `released_at` day; queued items are excluded. The
  Known headline is unchanged, because queued items are never Known.
- **J5**: "now" excludes queued items. "Items added" per week becomes "items started" per week,
  by `released_at` (the label changes to "started").
- Everything else is unchanged.

### Export

`GET /api/export` gains `sources` and `harvests` arrays. Vocab rows carry `harvest_id` and
`released_at`. The export format's version is bumped if it has one.

### Testing

- Worker, intake (`test/intake.test.ts`):
  - **Top-up**: tops up to the batch size when the new pile is short; releases 0 when the pile
    is full; releases only once per HOME_TZ day; releases again after midnight; concurrent
    first calls release one batch; FIFO order; empty queue.
  - **Intake and release**: Intake and per-item release (count bounds, empty queue, already
    released, unknown id).
  - **Due**: the due predicate excludes queued items, and the due order puts the new pile after
    due items.
  - **Reviews**: a tracked review releases a queued item; a supported event doesn't.
  - **Settings**: batch size bounds.
  - **Migration**: backfill leaves every existing row released.
- Worker, harvest (`test/harvest.test.ts`):
  - **Sources and harvests**: source CRUD and URL conflict; harvest create and delete (empty
    only); source delete unlinks items.
  - **Paste**: queued vs start now; a duplicate keeps its link; a repeated `handoff_id` is a
    no-op.
  - **Overview**: order and counts.
  - **Export**: includes the new tables and fields.
- Shared: `shared/dash.test.ts` adds queued items to the fixtures (excluded from J1, J2 and J5)
  and covers J5 "started" by `released_at`.
- Client: the tank's thresholds (full, ok, low at `Q < 3N`, empty) and fill; the tab list and
  default (a stored `read` falls back to Review); the harvest request text with and without a
  filter or URL; the Vocab queued badge and label; the Intake button label and hidden state.
- Visual (agent): headless 360 px screenshots, framed in a 360 px iframe (improve-log
  2026-10-01), of the Harvest overview, a harvest detail, the Review start screen with the tank
  ok, low and empty, and the six-tab bar.

### Done When

1. Every test in §Testing passes, then `pnpm check` is green. *(s01–s06)*
2. A local run of `pnpm wrangler d1 migrations apply urdu --local` on a copy of the current
   schema leaves every existing row released, and `scripts/smoke.ts` passes against `pnpm dev`.
   *(s01)*
3. The headless 360 px screenshots in §Testing show no clipped or overlapping text, and the six
   tabs fit. *(s05–s06; agent eyeball, owed)*
4. The doc ripple is written: PRD FR-K, FR-A7, FR-C (parked), FR-E1, FR-I1, FR-J2/J5 and
   Appendix A; AGENTS Project state and the Invariants (due order); CHANGELOG;
   `smoke-tests/smoke-test-17.md`. *(s07)*
5. The sponsor backs up, applies migrations remotely (0005–0007, whichever are pending), deploys
   and runs smoke-test-17 on the phone. It checks that:
   - a harvest is created and pasted into, and its words are queued;
   - the next day the new pile tops up to the batch size;
   - Intake adds a batch;
   - the tank goes low below 3 days;
   - new words come after due ones;
   - existing items are untouched;
   - the Read tab is gone and the app opens on Review.

   *(s07; sponsor eyeball, owed)*

### Roadmap

- **s01** Schema and the due rule: migration 0007; `VocabItem` gains `released_at` and
  `harvest_id` (fixtures across the test suite change with it); `createVocab` takes
  `queued`/`harvestId`; the due predicate and order; a tracked review releases a queued item;
  export. Worker tests. Lands only after the sponsor's pending deploy of 0005/0006 if possible
  (§Dependencies).
- **s02** Intake domain: `topUpIntake` with the claim, Intake and per-item release routes, the
  batch-size setting, `/api/status` intake counts, the top-up call sites. Needs s01.
- **s03** Sources and harvests: CRUD routes, `GET /api/harvest`, harvest paste through
  `importHandoff`. Needs s01.
- **s04** Dash: queued exclusions and J5 "started" in `shared/dash.ts`. Needs s01.
- **s05** Client, Harvest tab: tab swap (Read parked, default Review), Harvest overview, source
  and harvest sheets, the moved round trip with **Copy harvest request** and **Start now**, the
  tank component, client tests, headless check. Needs s02 and s03.
- **s06** Client, Review/Vocab/Settings: the start-screen counts, tank and Intake button; the
  queued badge, filter and Release now; the setting. Client tests, headless check. Needs s02 and
  s05 (the tank component).
- **s07** Doc ripple and smoke-test-17; the sponsor applies migrations, deploys and runs it.

### Dependencies

- **Deploy order.** Once s01 lands, a deploy of `main` needs 0007 applied remotely, after 0005 and
  0006. Several fronts are waiting for a phone check behind 0005/0006 (f12, f13, mp03, f11, f14,
  f15, f16). Recommended: the sponsor deploys those first, then f17 ships with 0007 alone. Not a
  blocker: one remote apply covers all three.
- **f16 is open.** s04 edits `shared/dash.ts` while f16 waits for its phone check. Nothing
  conflicts, but f16's smoke should run on a deploy without f17's Dash changes, or smoke-test-17
  re-checks J2/J5.

## Status

### Recently Completed

- 2026-10-01: Built s01–s06 in one orchestrated run and wrote the s07 doc ripple. `pnpm check` is green at 739 tests. Commits: s01 `2d4e8ce`, s02 `db17166`, s03 `528f72d`, s04 `92e620f`, s05 `6b3eb04`, s06 `472891e`. Migration 0007 is applied locally only; on the local copy (38 rows) every row was released at its `added_at` and none was queued. Headless 360 px checks covered the Harvest overview, source, harvest, paste sheet and tank states, and the Review start screen with the tank ok, low and empty: nothing clipped, and six tabs fit.
- 2026-10-01: Options memo and two rounds of sponsor answers (`research/vocab-intake.md`). The
  doc was drafted, opened and stress-tested the same day: the sponsor settled four forks, and the
  rest were resolved in this doc (§Decisions).

### Next Steps

- **Owed, sponsor:** `scripts/smoke.ts` against `pnpm dev` (Done When 2's second half). The agent couldn't read the secret from `.dev.vars`; the local 0007 apply half is done.
- **Owed, sponsor (s07):** back up, apply migrations remotely (0005–0007, whichever are pending), deploy, and run `smoke-tests/smoke-test-17.md` on the phone, over two days for the top-up. Then `/pm-close f17`.

### Open Questions

- None blocking.

## Decisions

- 2026-10-01 (sponsor) — **Top-up, not a flat daily release.** Each day the new pile tops up
  to the batch size, counting manual and voice adds and words left unseen yesterday. A heavy day
  or a burst of adds pauses release by itself, and nothing piles up.
- 2026-10-01 (sponsor) — **New after due.** FR-A7 changes from nulls-first to nulls-last, for
  every new word, not only harvested ones.
- 2026-10-01 (sponsor) — **A paste learns its harvest from the app**, not from a header in
  ChatGPT's JSON. The URL and filter can't be misspelled or invented by ChatGPT, one harvest takes
  several 50-word pastes, and `vocab-json` doesn't change.
- 2026-10-01 (sponsor) — **The app opens on Review** now that Read is parked.
- 2026-10-01 (sponsor, research memo) — Option C: queued items live in the vault. FIFO release.
  A Harvest tab with a sources list in Read's place. Read parked for review on 2026-10-31.
  Auto-release kept. Low tank at 3 days. Queued items shown in Vocab with a badge. No re-queue.
- 2026-10-01 — The queued state is `released_at IS NULL`, not a flag. It also records when the
  item entered review, which J5 "started" needs. The backfill uses `added_at`.
- 2026-10-01 — The top-up is lazy, on reads, not a Cron Trigger. A cron adds configuration and a
  failure mode nobody watches, and every path that shows due items already calls the Worker. Two
  concurrent first calls are settled by a per-call claim value, not `changes()`.
- 2026-10-01 — Release doesn't bump `updated_at`, so it never makes a review or check apply
  look stale.
- 2026-10-01 — A tracked review releases a queued item, so no path leaves a scheduled item
  hidden from due.
- 2026-10-01 — FIFO is `added_at` order, not grouped by harvest. It's literal first in, first
  out, and harvests are pasted in time order anyway.
- 2026-10-01 — Days of supply round up, and low is `Q < 3N` (less than three full days). The tank
  reads full at 14 days of supply.
- 2026-10-01 — The URL is a source's identity: exact match after trimming, with a unique index.
  The "earlier harvests of this URL" check is the 409 that opens the existing source.
- 2026-10-01 — Every new-vocab paste goes through a harvest. A harvest-less paste path on the
  Vocab tab would keep two routes in step for no gain; an ad-hoc chat gets a catch-all source.
- 2026-10-01 — **Copy harvest request** reuses f14's `vocab-list` command with the URL and filter
  filled in, so the Project instructions don't change.
- 2026-10-01 — Intake is on the Review start screen only. During a session, the session limit
  and the new-after-due order would hide the words it pulls in.
- 2026-10-01 — Dash J1/J5 count items from `released_at`, so the backlog measures words in
  review, not words waiting.
