# Feature Plan — Dash

**Status**: 🟡 IN PROGRESS — opened and stress-tested 2026-10-01; s01 next
**Handle**: `f16`
**Created**: *2026-10-01* · **Updated**: *2026-10-01*

**Owner docs it serves**: `pm/PRD.md` FR-J (and FR-E4); `pm/DECISIONS.md` 261001a; `shared/mastery.ts`.

> **One-line:** A sixth tab that shows what I know, what's coming, how well it sticks, and what to fix.

## Intent

### Vision

Progress on a spaced-repetition app is invisible: each session looks like the last one. The Dash makes real progress visible and turns the review history into decisions. Every element must measure knowledge rather than activity, and must change what the learner does next: add words or hold off, review, fix an item, or change the ladder. Nothing goes on the page just because it would look good.

### Scope

Six elements (FR-J1–J6), top to bottom:

1. **Known**: the headline count of items whose current interval is ≥ 14 days (the sponsor's bar: a threshold of its own, not a band edge), with a stacked area chart of items per mastery band over time.
2. **Due forecast**: bars for each of the next 14 HOME_TZ days, with the overdue count first. Drives: add new words today or not.
3. **Recall rate**: over 30 days, recognition vs production, with a target band (80–90%) and a one-line ladder hint (above the band → a wider ladder would cut reviews; below → a denser ladder, or fewer new words). Shows `n=`; below the minimum sample it says "not enough reviews yet".
4. **Trouble items**: up to 8 items with the most Wrong or Partially correct grades in 30 days; tapping one opens it on the Vocab tab (`openVocab`). Drives: rewrite the entry, add an example, drill it with the Coach.
5. **Learning backlog**: items in New, Learning or Basic now, with items added and items reaching Known per week. A growing backlog means intake is outrunning absorption.
6. **Review calendar**: 12 weeks of days shaded by tracked review count. No streak number.

### Exclusions

- Streaks, XP, badges, levels; total reviews or time spent; CEFR estimate; voice spend; tag and word-vs-phrase breakdowns (DECISIONS 261001a).
- No writes. Viewing the Dash changes no schedule and records nothing.
- No schema change, no stored aggregates, no chart library.

### User Stories

- As the learner, I want to see how many words I really know and watch that grow, so the daily reviews feel like they add up.
- As the learner, I want to see the coming review load before I add new words, so I don't bury myself.
- As the learner, I want to know whether my ladder is too tight or too loose, so the Settings choice is evidence-based.
- As the learner, I want the items I keep missing in front of me, so I can fix their entries.

### Non-Functional Requirements

- Derivations live in `shared/` beside the mastery bands (new `KNOWN_MIN_SECONDS = 14 d`), tested there; the client renders only. The Dash and the Review/Vocab tabs can never disagree on a band.
- One read, `GET /api/dash`, under the NFR's 500 ms p95 at the vault's size; HOME_TZ day bucketing via `shared/dates.ts`.
- Charts are hand-rolled SVG, coloured from CSS variables, readable at phone width; numbers are whole units.

## Planning

### Metric definitions

All six are pure functions in `shared/` (new `shared/dash.ts`) over the full `vocab` and `review_events` rows plus `now` and HOME_TZ. HOME_TZ days come from `todayIn`/`addDays` (`shared/dates.ts`); a week starts Monday. "Lapse" = `wrong` or `partial`.

- **J1 Known**: items with `last_reviewed_at` not null and current `interval_seconds` ≥ `KNOWN_MIN_SECONDS` (14 d, new constant in `shared/mastery.ts`). An overdue item still counts: the interval is the schedule's claim, and overdue load shows in J2.
  - **Band history**: an item exists from its `added_at` day. Its band on day D is `bandForInterval(interval_after)` of its last event on or before the end of D. Before its first event it is New if that event's `due_before` is null, else `bandForInterval(interval_before)`. An item with no events uses its current `masteryBand`. Range: from the day of the earliest review event (today if none) to today; one point per day up to 90 days, per week beyond. Drawn once there are ≥ 2 days; before that, the headline alone with "History builds as you review".
- **J2 Due forecast**: **Overdue** = `due_at` ≤ now. **New** = never reviewed (`due_at` null), its own count, not overdue. Then one bar per HOME_TZ day by `due_at`: today (now → end of today) and the next 13 days.
- **J3 Recall rate**: events in the last 30 days (`reviewed_at` ≥ now − 30 d) with `due_before` not null and `prompt_support = 'none'`, any source. Recalled = `hesitant`, `correct`, `confident`. Recognition = `ur_en`; production = `en_ur` + `oral`. Review-ahead events count. Each direction shows rate and `n`; below 30 events it shows "not enough reviews yet (n)" and no hint.
  - **Ladder hint**, from the recognition rate (production shown alongside): > 90% → "Recall is high: a wider ladder would mean fewer reviews", or on Very wide (id 11) "Recall is high, on the widest ladder"; 80–90% → "On target"; < 80% → "Recall is low: try a denser ladder or add fewer new words", or on Very dense (id 7) "Recall is low: add fewer new words for a while". The server returns the band (`high` / `on_target` / `low` / `insufficient`); the client words it.
- **J4 Trouble items**: items with ≥ 2 lapses in the last 30 days (any direction, any prompt support), ordered by lapse count desc, latest lapse desc, then `urdu`; at most 8. Each row: Urdu, English, lapse count, current band name; tapping it calls `openVocab(id)`. None → "No trouble items in the last 30 days".
- **J5 Learning backlog**: now = items in bands 0–2 (New, Learning, Basic). Per week, the last 8 weeks including the current partial one: items added (`added_at`), and distinct items with an event crossing `interval_before` < 14 d → `interval_after` ≥ 14 d.
- **J6 Review calendar**: 84 HOME_TZ days ending today, Monday-start columns, shaded by that day's review events (any source) in five steps: 0, 1–9, 10–19, 20–39, 40+.

### API and UI

- `GET /api/dash` (session cookie, like the other `/api/*` reads) returns `DashResponse` (in `shared/api.ts`): the six blocks plus `active_ladder_id` and `generated_at`. The Worker reads `vocab` and `review_events` in full and runs `shared/dash.ts`. Revisit with SQL aggregates if the route exceeds 100 ms locally on a 5,000-event fixture.
- Read-only: the route writes nothing; no D1 migration.
- **Tab**: `dash`, label "Dash", order Read · Vocab · Review · Dash · Voice · Settings; Read stays the default. If six labels crowd at 360 px, tighten tab padding or font; no icon set (no new dependency).
- Fetched each time the tab opens (as Review refreshes its due count), with loading text and an error line with Retry. Each element owns its empty state; an empty vault shows all six without errors.
- Charts are hand-written SVG React components in `src/dash/`, coloured from new chart tokens on the app's `:root`. The app has a light theme only; no dark mode is added. No chart library.

### Testing

- `shared/dash.test.ts`: Known edge (exactly 14 d counts; never-reviewed excluded); band replay before the first event, between events, and for event-less imports; forecast split of overdue/new/today across a HOME_TZ midnight and a DST change; recall filters (`due_before` null, prompt support, 30-day edge), direction split, min-sample cut-off, and the recall bands; trouble threshold, order and cap; backlog week bucketing and Known crossings; calendar steps and the 84-day window.
- Worker (`test/dash.test.ts`): 401 without a session; empty vault; a seeded vault returns the expected blocks; the route leaves `vocab` and `review_events` unchanged.
- Client: the Dash renders empty, sparse (2 days, below min sample) and full fixtures; tapping a trouble item calls `openVocab`; the hint wording at both ladder ends (Very dense id 7, Very wide id 11), which only the client knows.
- Visual (agent): render the Dash from the three fixtures to static HTML with `app.css` in the scratchpad and screenshot headless at 360 px.

### Done When

1. `shared/dash.test.ts`, the worker test and the client tests pass, then `pnpm check` is green. *(s01–s03)*
2. Headless 360 px screenshots of the empty, sparse and full fixtures show no overlapping or clipped text, axes or bars. *(s03; agent eyeball, owed)*
3. AGENTS Project state, CHANGELOG and `smoke-tests/smoke-test-16.md` are written; PRD FR-J is marked built. *(s04)*
4. Sponsor runs smoke-test-16 on the installed phone after deploy (no migration): six tabs fit; each element reads sensibly; Known and the backlog are plausible against the Vocab tab; grading one due item then reopening Dash moves today's calendar cell and the forecast; a trouble item opens on Vocab. *(s04; sponsor eyeball, owed)*

### Roadmap

- **s01** `KNOWN_MIN_SECONDS` and `shared/dash.ts`, with `shared/dash.test.ts`. No I/O.
- **s02** `DashResponse` in `shared/api.ts`, `GET /api/dash`, worker test. Needs s01.
- **s03** Dash tab: wiring, SVG chart components, the six sections with loading/error/empty states, client tests, headless check. Needs s02. No mock gate (sponsor, 2026-10-01).
- **s04** Docs and smoke-test-16; the sponsor deploys and runs it on the phone.

## Status

### Recently Completed

- 2026-10-01 — Proposal agreed with the sponsor; DECISIONS 261001a, PRD FR-J, PLAN and STATUS updated; f16 opened. Stress-tested the same day: metric definitions pinned, the first slice split into derivations (s01) and route (s02), Done When made checkable.

### Next Steps

- s01: `KNOWN_MIN_SECONDS` and `shared/dash.ts` with `shared/dash.test.ts`.

### Open Questions

- None blocking.

## Decisions

- 2026-10-01 — A Hesitantly correct grade counts as recalled for the recall rate: the answer was produced, and its delta (0) keeps the item in place rather than demoting it. This is the usual pass/fail line for SRS retention targets.
- 2026-10-01 — Review-ahead events count towards the recall rate. Excluding them needs a cut-off for "early" that mp03's hour-level spans make arbitrary, and the rate is computed, never stored, so this is a one-commit change if the rate sits above the band.
- 2026-10-01 — Never-reviewed items show as New beside the forecast, not as overdue: they are intake, not a missed schedule.
- 2026-10-01 — Known counts an overdue item: the interval is the schedule's claim, and overdue load is J2's job.
- 2026-10-01 — Trouble needs ≥ 2 lapses in 30 days; one miss is ordinary forgetting.
- 2026-10-01 — The server returns the recall band and the client words the hint, so wording changes need no API change.
- 2026-10-01 — Two full-table reads in the Worker, not SQL aggregates: the derivations stay pure, testable functions in `shared/`, and the scan is cheap at this size.
- 2026-10-01 — Sponsor: no mock gate before s03; the Dash tab goes after Review, and Read stays the default tab.
- 2026-10-01 (s01) — The band history's today point uses each item's current band, not the replayed one, so it always matches the Known headline and the Vocab tab after a step correction or check reset (neither records an event). A jump between yesterday and today is the honest picture.
- 2026-10-01 (s01) — Beyond 90 days the history is a point every 7 days counting back from today, not Monday-aligned: the last point is always today. The Monday week applies to the backlog and calendar.
- 2026-10-01 (s01) — Trouble ties on lapses and latest lapse sort by `urdu` code point, not a locale collation: deterministic in Node and workerd alike.
- 2026-10-01 (s02) — Cost: `buildDash` on 800 items × 5,000 events runs 21–30 ms warm and about 60 ms cold in Node, inside the plan's 100 ms trigger, after memoising the home day per 15-minute slot. The Workers free plan's 10 ms CPU cap is the open risk; the phone smoke checks that the route loads. SQL aggregates are the fallback.
