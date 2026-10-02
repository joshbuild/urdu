# Mini-plan — Review ahead by hours

**Status**: 🟢 CLOSED — *closed 2026-10-02. s01–s03 built 2026-09-27; s04 phone met by daily use (the sponsor uses the slider).*
**Handle**: `mp03`
**Created**: 2026-09-27 · **Updated**: 2026-10-02

**Owner docs it serves**:
- `pm/PRD.md` FR-E1 (review ahead: whole days today, becomes a duration)
- `pm/features/archive/f05-review-archive.md` (shipped f05; this refines its review-ahead control)

**Companions**: f12 `day-anchored-ladders` (its entry rung sits below one day, which is why
hour-sized look-ahead now matters).

> **One-line:** replace the whole-days "Review ahead" number box with a slider that snaps
> through fixed stops from Now to 1 year (1 h, 2 h, 3 h … 1 d … 1 y), show the chosen duration
> and how many more items it adds, and have the Worker take the look-ahead in seconds.

> **As shipped (2026-10-02).** Review ahead is a stop slider (Now, 1–20 h, days, weeks, months, 1 y) with a live count of the extra items; the Worker takes `ahead_seconds` and `GET /api/vocab/upcoming` serves the count. Live truth: PRD FR-E1, the review start screen and its tests. Evidence: `smoke-tests/archive/smoke-test-mp03_archive.md` (closed on the sponsor's report of daily use). The slider sometimes landing on a stop the sponsor didn't pick is tracked in TODO (2026-10-02, likely the f17 Intake button shifting the layout) and doesn't block the close.

Sponsor request 2026-09-27: the days-only box is too coarse; they want 2–3 hours. They picked the
stop slider over chips.

---

## As-is

- `GET /api/vocab/due?ahead=N` takes whole days, 0–365 (`worker/routes/api-vocab.ts`), and sets
  the cutoff to exactly now + N × 86 400 s. It does not round to a date.
- The Review tab has a number box, "Review ahead (days)". `parseAheadDays` turns anything that
  isn't a whole number, such as `2.5`, into 0 without saying so (`src/review/session.ts`).
- Nothing tells you how many items a given look-ahead would add.

## Design

- **Stops.** `AHEAD_STOPS` in `src/review/session.ts`, in seconds, each with a label:
  Now · 1 h · 2 h · 3 h · 5 h · 8 h · 12 h · 16 h · 20 h · 1 d · 2 d · 3 d · 5 d · 1 w · 2 w ·
  1 mo (30 d) · 3 mo (91 d) · 6 mo (182 d) · 1 y (365 d). That is 19 stops. 1 y keeps today's
  365-day reach. Stops are a UI choice, so they live in the client, not in `shared/`.
- **Control.** `<input type="range">` over the stop index (min 0, max 18, step 1), default 0 on
  every visit. The label row reads `Review ahead` with the stop label on the right ("3 hours").
  `aria-valuetext` carries the same label.
- **Count.** A hint under the slider: at Now, "Only items due now."; otherwise "N more items fall
  due in the next 3 hours. Grades count from now." If the count hasn't loaded or failed to load,
  the hint drops the number: "Also includes items due in the next 3 hours. Grades count from now."
- **Where the count comes from.** New `GET /api/vocab/upcoming` → `{ now, due_at: string[] }`:
  the due times of items not yet due (`due_at > now`) and due within 365 days, ascending. `now` is
  the Worker's clock, so the count doesn't depend on the phone's clock. The client counts
  `due_at <= now + stop` for each stop. The list grows with the vault; a few thousand ISO strings
  are still small.
- **Worker look-ahead.** `/api/vocab/due` swaps `ahead` (days) for `ahead_seconds`
  (0–31 536 000). `ahead` is no longer read. The PWA is the only client and ships in the same
  deploy.
- **Start button.** Disabled only when nothing is due and the slider is at Now, as today. It is
  not disabled on a count of 0, because the count is a snapshot.

## Stages

- **Stage 0 — plan** (this doc): done 2026-09-27.
- **Stage 1 — build** s01–s03 on `main`.
- **Stage 2 — phone** s04, sponsor.

## Slices

- **mp03-s01 Worker.** `ahead_seconds` on `/api/vocab/due` (replacing `ahead`), with
  `MAX_AHEAD_SECONDS` exported; `upcomingDueTimes(db, now, until)` in `worker/domain/vocab.ts`;
  `GET /api/vocab/upcoming`, registered before `/api/vocab/:id`; `UpcomingResponse` in
  `shared/api.ts`. Tests in `test/vocab.test.ts`: `ahead_seconds` includes an item 2 h out at
  3 h and not at 1 h; bad values → 400; upcoming excludes never-reviewed (null) and already-due
  items, excludes items past 365 d, is ascending, and needs a session.
- **mp03-s02 Client.** `AHEAD_STOPS`, `aheadStop`, `countWithin` and a `dueQuery` that takes
  seconds, in `src/review/session.ts`, replacing `parseAheadDays`/`MAX_AHEAD_DAYS`. The slider,
  value label, hint and upcoming fetch in `ReviewScreen.tsx`. The fetch re-runs each time the
  start screen shows, so it picks up the due times a finished session moved. Range styling in `app.css`. Unit
  tests in `src/review/session.test.ts`: stops ascending and starting at 0, labels,
  `countWithin` edges (exactly at the cutoff counts), query string.
- **mp03-s03 Docs.** PRD FR-E1 reworded; `smoke-tests/smoke-test-mp03.md` for the phone.
  `scripts/smoke.ts` doesn't use `ahead` (checked).
- **mp03-s04 Phone (sponsor).** Deploy (it can ride the f12 deploy), then run smoke-test-mp03.

## Done When

- `pnpm check` green with the s01–s02 tests.
- PRD FR-E1 describes the stop slider and `ahead_seconds`.
- smoke-test-mp03 ticked on the phone: the slider snaps through the stops, the label and count
  change, and a 3 h session queues only what the count promised (up to the session limit).
  *Met by daily use 2026-10-02; the scripted steps were waived.*

---

## Open Questions

- (none)

---

## Decisions

- **2026-09-27** Stop slider, not chips or a free log scale (sponsor). Stops are fixed and
  human-sized so 2 h vs 3 h is reachable.
- **2026-09-27** The count comes from a list of due times the client counts, not per-stop counts
  from the Worker, so the Worker never learns the UI's stops (agent).
- **2026-09-27** Rename the Worker parameter to `ahead_seconds` rather than reinterpret `ahead`,
  so no request can mean days to one side and seconds to the other (agent).
- **2026-09-27 stress test** — see the resolved list below.

### Stress test (2026-09-27)

1. *Clock skew:* counting against the phone's clock could disagree with the queue the Worker
   builds. → Resolved: upcoming returns the Worker's `now` and the client counts from it.
2. *Stale count after a session:* grading moves due times, so the old list overstates. →
   Resolved: refetch each time the start screen shows; `finish()` returns to it. (Planned as
   "on each `status` change"; built on the phase, since the effect never reads `status`.)
3. *Items becoming due while the tab is open:* an item in the "upcoming" list may now be due
   and also in `status.due`, so it's counted twice. → Accepted: both numbers are snapshots from
   the same visit, and the queue the Worker builds at Start is always exact. The next status
   refresh fixes the snapshot.
4. *Session limit:* the count can exceed the per-session limit. → Resolved: the existing "Up to N
   items per session" hint stays right under the Start button. No new wording.
5. *Never-reviewed items (`due_at` null):* they're already due and counted in `status.due`. →
   Resolved: upcoming excludes them (`due_at IS NOT NULL AND due_at > now`).
6. *Tag filter:* `/api/vocab/due` accepts `tag`, but the Review tab doesn't send one. → Out of
   scope; upcoming takes no tag.
7. *Stale installed PWA sending `ahead=3`:* after the deploy, old JS would get due-only. →
   Accepted: the deploy ships the client with the Worker, and the next load picks it up.
8. *Worker cap vs last stop:* both 365 d, so the last stop is always valid. Test pins
   `ahead_seconds=31536000` → 200 and `31536001` → 400.
9. *Range input on Android:* a 19-stop track on a ~320 px panel gives ~15 px per stop, which is
   tight but draggable; the label beside confirms the snap. The input must not inherit the
   global `input` padding/border/min-height. → Resolved: a `input[type="range"]` rule resets
   them and sets `accent-color`.
10. *Unverifiable acceptance:* "count matches the queue" needs a known state. → Resolved: the
    smoke test reads the count at a stop, starts, and compares the session length (bounded by the
    limit).
