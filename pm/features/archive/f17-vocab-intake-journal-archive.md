# f17 vocab-intake — journal

**Current state (2026-10-02):** 🟢 closed. s01–s07 built 2026-10-01; 0005–0007 applied remotely and deployed by the sponsor; confirmed in daily use.

## 261002 — close

The sponsor reported days of normal use: words found, added through the ChatGPT loop and queued, reviews daily. On 2026-10-02 Review showed new words without Intake being tapped, so the daily top-up runs in production. smoke-test-17 was closed on that report and its other steps waived (AGENTS "Smoke tests": daily use counts as evidence). Done When 2's `scripts/smoke.ts` run against `pnpm dev` was never done; production use covers it. One follow-up stays in TODO: the review-ahead slider sometimes takes a stray stop, probably because the Intake button appears or vanishes above it.

## 261001e

Orchestrated run, s01–s07. The sponsor chose to build on main ahead of the pending 0005/0006 deploy, so any deploy from here carries f17 and 0007.

**s01** (`2d4e8ce`) added migration 0007:
- the `sources` and `harvests` tables, plus `vocab.harvest_id` and `released_at`;
- a backfill setting `released_at` to `added_at`.

The due predicate now excludes queued items and orders `due_at` nulls last. `createVocab` takes `queued`/`harvestId`, the Airtable insert releases at `added_at`, a tracked review releases via `coalesce`, and the export carries the new tables. Tests were written first, with 6 assertion reds (e.g. `expected null to be '2026-10-01T20:11:42.926Z'`). Three existing tests changed for the FR-A7 order and the export keys, and `pnpm check` then went red on the schema test's exact table list, which was fixed. On a local copy (38 rows), 0007 released every row at its `added_at` and queued none. The `scripts/smoke.ts` run against `pnpm dev` was not done: reading the secret from `.dev.vars` was denied, so it is owed to the sponsor. Review found no bugs. It found one gap (the Airtable release was untested), now pinned.

**s02** (`db17166`) added:
- `worker/domain/intake.ts`: the top-up with its claim, Intake, Release one and the batch size;
- `/api/intake/release` and `/api/vocab/:id/release`;
- the intake counts on status;
- the top-up at the status, due, dash and voice call sites.

The red was route 404s and `status.intake` undefined. The domain top-up tests passed on their first run, because `intake.ts` had been written before them. Review found the concurrency test passed even without the SQL claim guard (the second call saw a full pile anyway). The write half was split out as `claimAndRelease` and tested against a stale claim. A voice due-tool test was added, and the `updated_at` assertions were made meaningful by backdating.

**s03** (`528f72d`) added source and harvest CRUD, the overview, the details and the harvest paste. 23 reds (`expected 404 to be 201`) went green on the first build. Review found that `http:x.test` passed the URL check, which would make a second source for the same page. The check now requires `//`, and PATCH validation tests were added.

**s04** (`92e620f`): the Dash leaves queued items out of J1, J2 and J5, and J5 counts `started` by `released_at`. It had 4 reds.

**s05** (`6b3eb04`): the Harvest tab, the tank, the moved round trip and the tab swap. The tabs test went red first; the tank and request modules were written alongside their tests. The headless 360 px check used `renderToStaticMarkup` in a 360 px iframe, with `preloaded` props added so views render without fetching. Nothing was clipped, and the six tabs fit.

On re-reading `VocabDetail`, the agent noticed that the CSRF `requireJson` guard returns 415 on a bodyless DELETE, which the Harvest deletes would have hit on the phone; the review had missed it. Review also found:
- a stale `SourceView` after opening another source;
- no Back while a harvest fails to load;
- the delete error showing outside its sheet;
- the 401 wording;
- labels on a repeated paste.

All were fixed.

**s06** (`472891e`):
- the Review start counts, the compact tank and Intake;
- a Queued badge, a Queued only filter (Worker `?queued=true`, with a red of `expected 4 to be 3`) and Release now;
- New words per day.

A headless check showed "10 / new" breaking in the heading, so each count is now joined to its word with a no-break space. Review found a double tap on Intake could release two batches (the button re-enabled before the refreshed counts arrived), now held until the status changes. It also found shared Release/Delete busy labels.

**s07** (`ba09dd0`) rippled the change into:
- PRD: FR-A6/A7, D1/D2, E1, F6, I1, J1/J2/J5, FR-K (built) and Appendix A;
- AGENTS: the invariant, Project state and the PWA component;
- CHANGELOG;
- smoke-test-17;
- smoke-test-16's tab line;
- the Project instructions' note.

## 261001d

Sponsor note: harvesting a big batch on the weekend of 2026-09-26 overloaded review. Asked for a
workflow that covers harvest, recording the source, batching and ingest. Options memo
`research/vocab-intake.md` (A outside the app, B staged bare words, C queued vault items with a
daily limit). Sponsor chose C.

The sponsor's answers:
- Batch size defaults to 10, plus a manual Intake button and a tank meter.
- FIFO release.
- A sources list on its own screen.
- No re-queue.

Round 2:
- Harvest takes Read's tab; Read is parked for 30 days.
- Auto-release stays.
- Low tank at 3 days.
- Queued items show with a badge.

Drafted f17 and stress-tested it. Four forks went to the sponsor, who took all four
recommendations:
- the new pile tops up to the batch size;
- new words come after due ones (an FR-A7 change);
- a paste learns its source from the harvest it is pasted into, not from a ChatGPT header;
- the app opens on Review.

Resolved in the doc:
- the queued state as `released_at`;
- a lazy top-up with a per-call claim, not a cron;
- release doesn't bump `updated_at`;
- a tracked review releases a queued item;
- a source's URL is its identity;
- every paste goes through a harvest;
- the Dash excludes queued items.

The seven slices were split along schema, domain, API and client lines. The deploy-order
dependency on the pending 0005/0006 is noted.
