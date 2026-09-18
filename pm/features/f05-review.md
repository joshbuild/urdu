# Feature Plan — Review

**Status**: 🟡 IN PROGRESS — *opened 2026-09-18; s01 next.*
**Handle**: `f05`
**Created**: *2026-09-18* · **Updated**: *2026-09-18*

**Owner docs it serves**:
- `pm/PRD.md` — FR-E1..E4 (uses FR-A4 recording, FR-A7 due selection, FR-I1 session limit)
- `pm/PLAN.md` — Phase 2 roster row
- `shared/mastery.ts` — grade names and order (display only; the Worker applies them)

> **One-line:** A due-item review session on the phone: pick a direction, flip each card, grade it on the five-step ladder or skip, and see a short tally at the end.

## Intent

### Vision

The vault is only worth keeping if items come back at the right time. f01 built the ladder, due selection and atomic review recording. f05 is the screen that uses them daily: open the Review tab, tap Start, work through what's due in a few minutes with one thumb, and trust that every grade moved the item correctly. It replaces the Airtable review routine.

### Scope

- **FR-E1** Review tab start panel: due count, direction choice (Urdu→English default, English→Urdu), Start. Queue from `GET /api/vocab/due?limit=<readSessionLimit()>`, fetched once at start.
- **FR-E2** Card: the prompt side (Urdu in Nastaliq RTL with a speak button, or English); Reveal shows Urdu (speakable), Roman, English, notes and example.
- **FR-E3** After reveal, five grade buttons in ladder order; a tap POSTs `/api/vocab/:id/reviews` `{grade, direction}` and advances. Skip advances without recording (available before or after reveal).
- **FR-E4** End panel: counts graded and skipped; back to start (which refreshes the due count).
- Ending early: an End button shows the same tally.
- **Worker changes:** none expected. Both routes exist with tests (f01 s05/s06).

### Exclusions

- **Streaks, statistics, history charts** — FR-E4 excludes them.
- **Tag-filtered sessions** — the due route supports `tag`, but FR-E1 does not ask for it; deferred to v1 unless the sponsor asks.
- **Typed answers or AI grading** — self-grading only; the Coach (f06/f07) covers free-form grading.
- **Undo a grade** — no route to reverse a review event; deferred (the Vocab edit can correct mastery, without an event).
- **Offline queueing of grades** — offline-first is a v0 non-goal; a failed POST stays on the card with a retry.

### User Stories

- As the sponsor, I want to start a review in one tap from the Review tab, so that daily review has no friction.
- As the sponsor, I want to hear the Urdu on the card, so that I review pronunciation as well as meaning.
- As the sponsor, I want to practise English→Urdu recall as well, so that I can produce words, not just recognise them.
- As the sponsor, I want to skip an item I can't judge right now without hurting its mastery.

### Non-Functional Requirements

- One-handed: grade buttons large (≥44 px), at the bottom, in a stable position so thumbs learn them.
- A grade is never recorded twice: buttons disable while the POST is in flight; the card advances only on 201.
- Errors do not lose the session: a failed POST (network, 409, 5xx) shows an inline message and keeps the card; 404 (item deleted meanwhile) counts as skipped and advances; 401 goes to lock.
- No mastery arithmetic in the client. Grade labels come from `shared/mastery.ts`.

## Planning

### Testing

- **Client unit (node project):** session reducer: start → reveal → grade/skip → next → end; tally counts; direction decides the prompt side; grade blocked before reveal; 404 treated as skip; retry after failure keeps the index.
- **Worker:** existing review/due tests cover recording; no new routes.
- **Smoke-test-05 on the phone:** both directions, speak on both faces, all five grades move next review as expected (spot-check in Vocab detail), skip leaves the item unchanged, end-early tally, empty-due state, failed-network retry.

### Done When

1. FR-E1..E4 work on the installed phone PWA (smoke-test-05 green).
2. Graded items show updated mastery and next review in the Vocab tab; skipped items are unchanged.
3. `pnpm check` green; deployed.

### Roadmap

- **s01** Session state module (`src/review/session.ts`), a pure reducer plus tests.
- **s02** Start panel: due count, direction, Start; loads the queue with the session limit; empty state.
- **s03** Card: prompt face, speak, Reveal, full answer face.
- **s04** Grade bar and Skip wired to the POST; in-flight, error and retry; End early; end tally.
- **s05** Smoke-test-05 written; sponsor deploys and runs it on the phone.

## Status

### Recently Completed

- 2026-09-18 — Doc written and front opened.

### Next Steps

- Build s01, then s02–s04 in order.

### Open Questions

- None blocking. Tag-filtered sessions and undo are deferred (see Exclusions); raise either with the sponsor if the phone test asks for them.

## Decisions

- 2026-09-18 — **Client only.** The due and review routes shipped in f01 and already meet FR-A4/A7; f05 adds no Worker surface.
- 2026-09-18 — **Grades need a reveal first; Skip does not.** Grading an unseen answer makes no sense, and Skip must stay a free exit.
- 2026-09-18 — **Queue fetched once at start.** Items graded in the session drop out of the due set anyway; refetching per card would add latency for no gain.
