# Feature Plan — SRS Ladder

**Status**: 🟢 SHIPPED — *closed 2026-09-22. s01–s04 done; migration 0002 applied remotely; smoke-test-09 green on the phone.*
**Handle**: `f09`
**Created**: *2026-09-18* · **Updated**: *2026-09-18*

**Owner docs it serves**:
- `research/urdu-vocabulary-srs-research-and-design.md` — the accepted design (DECISIONS 260918c), minus its grade deltas (260918d)
- `pm/PRD.md` — FR-A2..A4, A7, FR-D1/D2, FR-E1, Appendix A (rewritten by this front)
- `pm/VISION.md` §6, `AGENTS.md` invariants — the ladder wording

> **One-line:** Replace the fixed 0/1/5/25/125/625/3125-day ladder with immutable, versioned geometric ladders (3 h to 10 y, five presets, Moderate 2^1.25 default), exact due timestamps, richer review events and non-retroactive ladder switches. Grade deltas are unchanged.


## Archived — as shipped (2026-09-22)

**Status:** 🟢 shipped. All three Done-When conditions met: `pnpm check` green at 465 tests;
migration 0002 applied to production D1 on 2026-09-18 with no row or event lost and no due time
moved; `smoke-tests/archive/smoke-test-09_archive.md` green end to end (Parts A–D), including the
23/23 scripted smoke against the deployment.

**What shipped:** versioned immutable ladders in `shared/ladders.ts` (id 1 Legacy ×5, ids 2–6
geometric 3 h → 10 y, Moderate id 3 the default), each literal pinned to its generator by test;
one schedule per item (`ladder_id`, `ladder_step`, `interval_seconds`, `last_reviewed_at`,
`due_at`) replacing `mastery`/`last_reviewed_on`/`next_review_on`; `scheduleReview` with
log-nearest remapping for items on a non-active ladder (ties → shorter); review events carrying
the full before/after transition plus `applied_delta` and `prompt_support`; a `settings` table with
`active_ladder_id` and `GET`/`PATCH /api/settings`; migration 0002 rebuilding both tables with
legacy dates at 08:00 UTC; mastery as a display band derived from the interval ("Firm • 3 wk");
the Settings review-spacing picker; and the import/export/smoke ripples.

**Verified in production:** on 2026-09-22 the vault read 42 vocab / 55 events / 35 on the legacy
ladder / active 3 — the six words added and the one item reviewed since the migration having moved
to the active ladder exactly as `scheduleReview` and vocab creation intend. Changing the preset
moved no due time (D2).

**Where the truth lives now:** `shared/ladders.ts` and `shared/mastery.ts` with their tests are the
authority on intervals, grading and bands; `migrations/0002_srs_ladder.sql`;
`worker/domain/review.ts`, `worker/domain/settings.ts`; `src/screens/SettingsScreen.tsx`. The rules
are mirrored in `pm/PRD.md` Appendix A and the AGENTS.md invariants — code wins if they drift.

**Carried forward:** the deferred SRS follow-ups (per-direction statistics and automatic direction
choice, due-time and workload analytics, an apply-immediately ladder remap with preview,
same-session relearning) sit in `pm/TODO.md` under `#agent-research`, to revisit once a few weeks
of review history exist. Every input they need is already on the review event.

## Intent

### Vision

Two-rung moves on a ×5 ladder turned one confident answer into a ×25 scheduling commitment. The new ladder pulls the ordinary step in to ×2.378, starts at three hours so a new word comes back the same day, and makes the spacing a visible setting the sponsor can change without corrupting progress.

### Scope

Mapped to the report's §10 acceptance criteria (AC):

- **Ladders (AC1–3).** `shared/ladders.ts` holds every ladder version as a literal interval array in seconds: id 1 Legacy ×5 (0/1/5/25/125/625/3125 d), ids 2–6 Dense, Moderate, Balanced, Wide, Very wide (`exponent_quarters` 4–8). A generator (`round(10800 × 2^(q·i/4))`, capped at 3650 d, cap included once) exists to produce new versions; a test pins each literal to it. Versions are never edited; a change is a new id.
- **Deltas (AC4–5).** Unchanged: recognition −2/−1/0/+1/+2, production −1/0/0/+1/+2 (260918d). Clamp to the ladder's first and last rung.
- **Shared schedule (AC6).** One state per item: `ladder_id`, `ladder_step`, `interval_seconds`, `last_reviewed_at`, `due_at` (UTC ISO; null = never reviewed = due now). Replaces `mastery`, `last_reviewed_on`, `next_review_on`.
- **Transition.** `shared/ladders.ts` `scheduleReview`: if the item is on the active ladder, base = its step; otherwise base = the log-nearest active rung to its `interval_seconds` (ties → shorter; interval 0 → rung 0). New step = clamp(base + delta); due = reviewed_at + interval. The Worker is the only caller.
- **Review events (AC7).** Add `applied_delta`, `ladder_before_id`, `step_before`, `interval_before`, `due_before`, `ladder_id`, `step_after`, `interval_after`, `due_after`, `prompt_support` (`none|hint|answer_exposed|repetition`, PWA always `none`). `direction` and `source` stay.
- **Active ladder setting (AC8–9).** New `settings` table, `active_ladder_id` default 3 (Moderate). `GET`/`PATCH /api/settings`; only ids 2–6 are selectable. Switching rewrites nothing; each item moves at its next review. Settings screen gets a "Review spacing" picker showing each preset's rungs.
- **Migration (AC10).** `migrations/0002_srs_ladder.sql` rebuilds `vocab` and `review_events` (SQLite cannot drop the 0–6 CHECKs). Every row goes onto Legacy with step = old mastery; dates become `<date>T08:00:00.000Z` (00:00 PST / 01:00 PDT in Vancouver, no DST arithmetic in SQL); due times are unchanged. Migrated events get legacy steps and intervals; their `applied_delta` and due fields are null (unknown).
- **Due selection.** `due_at IS NULL OR due_at <= now` (review ahead: now + N days), ordered `due_at` nulls first, then `added_at`.
- **Mastery display.** "Mastery" becomes a band derived from the interval, keeping the old names so legacy items read as before: New (never reviewed or < 3 h), Learning ≤ 1 d, Basic ≤ 7 d, Firm ≤ 30 d, Strong ≤ 180 d, Stable ≤ 730 d, Permanent beyond. The pill reads "Firm • 3 wk". Sort-by-mastery sorts by interval. The edit form's mastery select becomes a rung select on the active ladder (a correction: no event, due recomputed from last review).
- **Import, export, smoke.** Airtable import writes legacy-ladder rows (still cross-checks Airtable's dates). Export adds `ladders` and `active_ladder_id`. `scripts/smoke.ts` checks the new shapes.
- **Docs.** PRD FR-A/D/E/F1 and Appendix A, VISION §6, AGENTS invariants rewritten to the ladder model.

### Exclusions (deferred, with homes)

- **Direction statistics and automatic direction choice (§4.2, §5.4, AC11).** Direction stays a per-session choice, so the same item cannot meet both directions in one session; two sessions in a day can. Events carry direction, so statistics can be derived later. TODO backlog.
- **Due-time success and workload analytics (§9, AC13).** Every input is now on the event (direction, ladder, intervals, due before/after); the report view is later work. TODO backlog.
- **Voice-tutor evidence rules (§8, AC12).** f06/f07 own them; `prompt_support` and `source` are ready.
- **Immediate remapping (§6.2), same-session relearning, calendar-aware cap (§11).** Not built. The cap is a fixed 3650 days.
- **A DB `ladders` table.** Versions live in code (see Decisions).

### User Stories

- As the sponsor, I want a word I just added and got right to come back later today, not tomorrow.
- As the sponsor, I want one confident answer not to push a word out by years.
- As the sponsor, I want to choose how widely reviews are spaced, and change my mind without my existing schedule jumping.

### Non-Functional Requirements

- No schedule arithmetic in the client beyond display labels; the Worker alone writes schedule state.
- The migration loses no row and no review event; due times of existing items are unchanged.
- Review recording stays atomic and guarded against stale reads.

## Decisions

- **Ladder versions live in code, not D1** (promoted: DECISIONS 260918e). Literal arrays in `shared/ladders.ts`, pinned by tests; D1 stores only `ladder_id`. Rejected: a `ladders` table (a second copy the Worker would read on every review, for no single-user benefit).
- **Legacy dates map to 08:00 UTC** (260918e). Rejected: local midnight via DST arithmetic in SQL.
- **Mastery bands keep the old names** (this doc). Rejected: showing raw rung numbers (0–15 depending on preset) or dropping the pill.
- **`applied_delta` is the grade's delta before clamping** (this doc); the clamped move is `step_after − step_before` on the same ladder.

## Planning

### Testing

- **shared:** generator vs literals for ids 2–6; Moderate within 1% of the report's rungs; cap once; strictly increasing; nearest-rung mapping (log distance, ties shorter, 0 → rung 0); `scheduleReview` for same-ladder, switched-ladder, clamping at both ends, both directions; `formatInterval`; bands incl. legacy levels.
- **worker:** review writes the new columns and event; due/list/status on timestamps; ahead; edit of rung; settings GET/PATCH validation; switching the ladder leaves due times alone and moves an item at its next review; import onto Legacy; export shape; migration test on a second D1 (0001, legacy rows and events, 0002, assert values).
- **client:** list labels ("Due in 7 h"), pill label, edit diff sends `ladder_step`.
- **smoke-test-09 on the phone** after the sponsor applies the remote migration and deploys.

### Done When

1. `pnpm check` green.
2. Remote migration applied; production vocab count and review-event count unchanged, due dates unchanged (spot-check in Vocab).
3. smoke-test-09 green on the phone: a new word graded Correct shows "Due in 7 h"; the Settings picker switches presets without moving due times.

### Roadmap

- **s01** `shared/ladders.ts` + mastery bands + tests.
- **s02** Migration 0002, Worker domain (review, vocab, settings, import, export), Worker tests incl. migration test.
- **s03** Client: pill, list, detail, edit, review text, Settings picker.
- **s04** Scripts (import, smoke), PRD/VISION/AGENTS ripples, smoke-test-09.

## Status

### Recently Completed

- 2026-09-18 — Opened, planned and built s01–s04 in one session.
- 2026-09-22 — smoke-test-09 green on the phone; closed and archived.
