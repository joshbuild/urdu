# Feature Plan — Review correction

**Status**: 🟡 IN PROGRESS — implementation built; phone verification pending
**Handle**: `f15`
**Created**: *2026-09-29* · **Updated**: *2026-09-29*

**Owner docs it serves**: `pm/PRD.md` FR-E2/E3; `shared/api.ts`; `AGENTS.md` review invariants.

> **One-line:** Return to the previous review card to fix a mistaken grade, and tap displayed Urdu to hear it.

## Intent

### Vision

A stray tap during a review should be fixable in the same session, including on the last card. The review card should keep the Urdu text central and use it as the speech control.

### Scope

- Back from a card or the end tally opens the last completed card. Skipped cards can be reviewed; graded cards show their recorded grade and can be regraded or kept.
- Grade correction updates the original PWA review event and recomputes its schedule from that event's before-state. It is refused if the item changed or another review was recorded since.
- Tapping the displayed Urdu term speaks it. Remove the separate Speak button.

### Exclusions

- No correction after leaving the session; no history browser or general event deletion.
- No correction of Coach or handoff reviews.

### User Stories

- As the learner, I want to go back one card and correct a mistaken grade so my next review is scheduled correctly.
- As the learner, I want to tap the Urdu word to hear it without a separate button taking space.

### Non-Functional Requirements

- A correction must never overwrite a newer review or vocab edit. One event remains in history with its original time and id.
- The client does not calculate mastery or due times. Review controls remain operable on a phone.

## Planning

### Testing

- Client reducer: graded and skipped back paths, tally replacement, end-tally back, and in-flight grade guard.
- Worker: correction recomputes from the prior rung, preserves event identity, and refuses stale edits.
- Phone: both directions; tap-to-speak on prompt and answer; correct a grade on a middle and final card; confirm due time in Vocab.

### Done When

1. Focused tests and `pnpm check` pass.
2. Sponsor verifies `smoke-tests/smoke-test-15.md` on the installed phone after deployment.

### Roadmap

- **s01** Guarded grade-correction route and tests.
- **s02** Back/regrade flow, tap-to-speak, and documentation.
- **s03** Deploy and phone verification.

## Status

### Recently Completed

- 2026-09-29 — s01–s02 implemented; focused review tests pass (46). `pnpm check` green: 589 tests, build and secret scan. Worker tests now run one at a time after concurrent runner startup timed out twice.

### Next Steps

- Sponsor deploys and runs `smoke-tests/smoke-test-15.md` on the phone, then closes f15 if green.

### Open Questions

- None blocking.

## Decisions

- 2026-09-29 — Correct an existing PWA event in place. This keeps one review event for one answer and avoids adding a compensation event to the learner's history. The correction uses the event's recorded before-state and original review instant. This is limited to the current session's returned card.
