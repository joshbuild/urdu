# Journal — mp03 Review Ahead by Hours

**Current state:** 🟢 closed 2026-10-02; archived.

## 2026-10-02 — closed

- Deployed with the f17 build. The sponsor uses the slider in daily reviews and reports it
  working, so smoke-test-mp03 was waived and mp03 closed. The stray-stop observation stays in
  TODO (2026-10-02) as its own item.

## 2026-09-27 — planned, stress-tested, opened, built s01–s03 (260927d)

- Sponsor found review ahead too coarse and asked whether it rounds to days. It doesn't: the
  Worker took whole days and cut off at exactly now + N × 24 h, and the client turned `2.5` into
  0 without saying so. Sponsor picked a stop slider (Now … 1 y) over chips or a free log scale.
- Stress test resolved ten points in the doc (clock skew, stale count, session limit, null due
  times, cap vs last stop, range-input styling, and more); nothing escalated.
- Built: `/api/vocab/due` takes `ahead_seconds` (0 to one year) in place of `ahead`;
  `GET /api/vocab/upcoming` returns the Worker's `now` and the due times still to come;
  `AHEAD_STOPS` / `aheadStop` / `countWithin` in `src/review/session.ts`; the slider, stop label
  and count hint on the Review tab; range styling in `app.css`. PRD FR-E1 rippled;
  smoke-test-mp03 written.
- One change from the plan: the count refetches each time the start screen shows (keyed on the
  phase) rather than on `status`, which the effect never reads.
- `pnpm check` green at 524. Rendered the control with the app CSS in headless Edge; not seen in
  the running app or on the phone yet.
- Same session, pm-clean: dropped the Features Index links to f08/f10 docs that were never
  drafted, removed the stale AVG "turn back on after" TODO (AGENTS owns that guidance), and noted
  in f07 to archive `mp02-coach-instructions.md` at close.
- Next: sponsor deploys (with f12) and runs smoke-test-mp03, then `/pm-close mp03`.
