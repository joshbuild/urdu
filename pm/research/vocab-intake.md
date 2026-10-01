# Research memo — vocab intake pipeline

*Opened 2026-10-01 · direction chosen and open questions settled 2026-10-01; next step is a feature doc*

## The problem

The sponsor harvests vocab from stories (online sources, ChatGPT pointed at them, a filter such as
"CEFR A2+"). Today a harvest goes `vocab-list` → **Find new words** (f14) → `vocab-json` →
**Paste new vocab**, and every pasted item is created on the entry rung, due now (FR-F2). Adding
a vocab item schedules it, so a big weekend harvest becomes a big review load the next week. That
happened the weekend of 2026-09-26.

Wanted: harvest a source in one go, record what was harvested (source name, URL, filter, date),
and release the words into review at about 10 a day. Today the batches would be tracked by hand.

## Options considered

**A. Keep the queue outside the app** (the ChatGPT chat, a note, a sheet). Nothing to build.
Duplicate detection doesn't see unreleased words, the record of which sources have been harvested
sits apart from the vault, and the sponsor does the batching by hand every day. This is the
current state, and it is what failed. *Rejected.*

**B. In-app inbox of bare words, enriched per batch.** Store the `vocab-list` output as staged rows
with the source. Each day, release 10 and send them through `vocab-json` and paste. Every day
needs a ChatGPT round trip, staged words are a second list that matching and search must also
check, and "mark batch ingested" is something to remember. *Rejected.*

**C. Queue full entries in the vault and release them at a daily rate (chosen).** This is how
Anki handles new cards. Harvest pastes create real vocab items marked **queued**: not scheduled
and not due. Review introduces them a batch at a time. An item is placed on the entry rung at its
first tracked review, not when it is created. The vault records each source and harvest.

Why C:

- **Adding words no longer means reviewing them.** Release is a rule in Urdu Core, so there are no
  batches to manage by hand.
- **One sitting covers a harvest.** All the ChatGPT work for a source happens together, and after
  that the sponsor just reviews.
- **Existing features keep working.** Queued items are ordinary vault rows, so `urdu_key`
  duplicate checks, Find new words, search, edit and the f11/f13 checks all see them.
- **It's in line with the invariants.** ChatGPT only proposes entries. Whether an item is queued,
  the release order and the scheduling all stay in Urdu Core, and a queued item has no schedule
  until its first tracked review.

## Sponsor answers (2026-10-01)

1. **Daily amount.** Add an intake batch-size setting, default 10. Days vary: some days have a big
   review load and others have time for more new words. So add an **Intake** button on the Review
   screen that pulls in another batch by hand. Also show a **tank meter** of the queued words (like
   a battery meter, shaped like a tank). It is a signal to harvest more when it runs low.
2. **Release order:** FIFO.
3. **Unharvested sources:** yes, keep a list of them. Harvesting should have **its own screen**.
4. **One-off "re-queue never-reviewed items":** no. Not in scope.

## Refined shape (agent proposal, to be confirmed in the feature doc)

**Release.**
- Each local day, up to *batch size* queued items are released automatically, FIFO by harvest
  date and then by order in the paste.
- Released new items come **after** the due items in a session. On a heavy day, stopping early
  leaves them unseen.
- The allowance counts new items *seen* (first tracked review), not items released. So unseen
  items stay at the front of the queue, and nothing piles up or rolls over.
- **Intake** on the Review screen adds one more batch to today's session, as many times as the
  sponsor wants. It is labelled with the count, e.g. "Intake +10".

**Tank meter.**
- It shows the queued count and the days of supply at the batch size (queued ÷ batch size).
- It turns to a low state below a threshold, for example 3 days of supply.
- It appears on the Review screen and the Harvest screen, and could also go on the Dash.

**Harvest screen.**
- **Sources** are listed with a name and URL and a status: *to harvest* or *harvested*. The
  sponsor can add a source they found and harvest it later.
- **Harvests** are listed per source: filter (e.g. "CEFR A2+"), date, word count, and progress
  (seen/total). One source can be harvested more than once at different filters, so "checked
  off" means the source has at least one harvest. Pasting the URL of a source that was harvested
  before shows the earlier harvests.
- The new-vocab round trip moves here from the Vocab tab's CHATGPT section: **Copy new-vocab
  prompt**, **Find new words** and **Paste new vocab**. A paste is tied to a source. The
  `vocab-json` reply gains a `harvest` header (`{name, url, filter}`), so the Worker can match or
  create the source and harvest rows.
- Manual adds, Reader adds and voice adds stay immediate. A paste can be marked to start now
  instead of being queued.

**Data (sketch).**
- `sources` (id, name, url unique-ish, notes, created_at)
- `harvests` (id, source_id, filter, created_at, item_count)
- `vocab.harvest_id` (nullable)
- a queued marker on `vocab` (`queued` 0/1, or a nullable `introduced_at`)
- the batch size, and possibly the low-tank threshold, in `settings`.

## Sponsor answers, round 2 (2026-10-01)

1. **Harvest screen placement.** It takes the Read tab's place in the tab bar. The Read tab is
   **parked**: removed from the tab bar, code kept, with a TODO to review in 30 days
   (2026-10-31). The sponsor doesn't use it and reads with ChatGPT instead.
2. **Automatic daily release:** keep it.
3. **Low-tank threshold:** fixed at 3 days of supply.
4. **Queued items in Vocab search:** shown, with a "queued" badge.

Deferred: whether a new item starts in recognition (`ur_en`) only for its first days. This is a
ladder question.
