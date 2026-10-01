# Feature Plan — Dash

**Status**: 🟡 IN PROGRESS — opened 2026-10-01; s01 next
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

- **Recall event**: a review event with `due_before` not null (the item had been reviewed before) and `prompt_support = 'none'`, source PWA or Coach. **Recalled** = `hesitant`, `correct` or `confident`; `wrong` and `partial` are lapses. Recognition = `ur_en`; production = `en_ur` + `oral`. Minimum sample: 30 events per direction.
- **Band history**: replay each item's events in order (`interval_after`) from `added_at`; items imported from Airtable start on their imported interval at `added_at`. One point per HOME_TZ day.
- **Reaching Known** in a week: an event whose `interval_before` < 14 d and `interval_after` ≥ 14 d.
- **Overdue**: `due_at` ≤ now, plus never-reviewed items (null `due_at`).

### Testing

- `shared/`: recall classification and split, band replay, Known crossing, forecast bucketing across a HOME_TZ day boundary and DST, trouble ranking ties.
- Worker: `GET /api/dash` against seeded vocab and events; empty vault; requires a session.
- Client: Dash renders the sparse first weeks (short history, below-minimum recall) without broken charts.
- Phone: six tabs fit the bar; each chart reads at phone width in light and dark; tapping a trouble item opens it on Vocab.

### Done When

1. Focused tests and `pnpm check` pass.
2. Sponsor verifies `smoke-tests/smoke-test-16.md` on the installed phone after deployment.

### Roadmap

- **s01** `shared/` metric derivations and `GET /api/dash`, with tests.
- **s02** Dash tab: layout mock first (both themes, phone width), then the six elements as SVG.
- **s03** Docs (AGENTS Project state, changelog), smoke-test-16, deploy and phone verification.

## Status

### Recently Completed

- 2026-10-01 — Proposal agreed with the sponsor; DECISIONS 261001a, PRD FR-J, PLAN and STATUS updated; f16 opened.

### Next Steps

- s01: add `KNOWN_MIN_SECONDS` and the metric functions in `shared/`, then the Worker route.

### Open Questions

- Should review-ahead events (reviewed before `due_before`) count towards the recall rate? They are easier than on-time reviews and inflate it; mp03 makes them common. Leaning: count them, and revisit if the rate sits above the band.
- Six tabs on the phone bar: check the fit in s02; shorten labels or use icons if it crowds.

## Decisions

- 2026-10-01 — A Hesitantly correct grade counts as recalled for the recall rate: the answer was produced, and its delta (0) keeps the item in place rather than demoting it. This is the usual pass/fail line for SRS retention targets.
