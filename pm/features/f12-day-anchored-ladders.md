# Feature Plan — Day-Anchored Ladders

**Status**: 🟡 IN PROGRESS — *opened 2026-09-27; plan stress-tested; s01 next.*
**Handle**: `f12`
**Created**: *2026-09-27* · **Updated**: *2026-09-27*

**Owner docs it serves**:
- `shared/ladders.ts`, `shared/mastery.ts` and their tests — the as-built ladder rules
- `pm/PRD.md` — FR-A2, FR-F2, Appendix A (settings default)
- `pm/VISION.md` §6, `AGENTS.md` invariants — the ladder wording
- `pm/DECISIONS.md` — supersedes the 3-hour base of 260918c/e

> **One-line:** Five new ladder versions built outwards from an exact 1-day rung (down to about 1–2 h, up to 10 y), renamed Very dense / Dense / Balanced / Wide / Very wide; a new word starts one rung below a day so a plain Correct lands on 1 day; no decimals in the Settings picker or the pill.


## Intent

### Vision

f09's ladders start at 3 h and a new word starts on that bottom rung, so a new word graded Correct
comes back 6–12 h later and climbs through several same-day reviews. Learning many words at once
then carries a heavy up-front repetition load. The sponsor wants a new word answered correctly to
come back in about a day, and a word that is not sticking to be pulled in closer than 3 h. Anchoring
every ladder on a 1-day rung and starting new words just below it does both with the existing grade
deltas.

### Scope

- **Ladders.** Five new immutable versions in `shared/ladders.ts`, generated around a 1-day anchor:
  rungs `round(86400 × m^i)` for integer i, from the lowest rung ≥ 3600 s up to the first value at
  or past the 3650-day cap (which becomes the cap, once). m = 2^(q/4), q = 4–8.

  | id | name | × | rungs (display) |
  |---|---|---|---|
  | 7 | Very dense | 2 | 2 h · 3 h · 6 h · 12 h · **1 d** · 2 d · 4 d · 8 d · 2 wk · 5 wk · 2 mo · 4 mo · 8 mo · 17 mo · 3 y · 6 y · 10 y |
  | 8 | **Dense (default)** | 2.38 | 2 h · 4 h · 10 h · **1 d** · 2 d · 6 d · 13 d · 5 wk · 3 mo · 6 mo · 14 mo · 3 y · 7 y · 10 y |
  | 9 | Balanced | 2.83 | 1 h · 3 h · 8 h · **1 d** · 3 d · 8 d · 3 wk · 2 mo · 6 mo · 17 mo · 4 y · 10 y |
  | 10 | Wide | 3.36 | 2 h · 7 h · **1 d** · 3 d · 11 d · 5 wk · 4 mo · 14 mo · 4 y · 10 y |
  | 11 | Very wide | 4 | 2 h · 6 h · **1 d** · 4 d · 2 wk · 2 mo · 8 mo · 3 y · 10 y |

  Ids 2–6 stay as literals (never edited), become `selectable: false`, and are renamed with a
  `v1` suffix ("Moderate v1") so no retired name collides with a new one. Their successor is
  id + 5 (same multiplier).
- **Entry rung.** `entryStep(ladder)` = the rung below the ladder's 1-day rung (the rung
  log-nearest to 86400 s, minus one, floor 0). New items (PWA add, handoff, voice add) are created
  on the active ladder's entry rung, never reviewed, due now. `scheduleReview` is unchanged, so the
  first review lands (recognition, Dense): Wrong 2 h · Partial 4 h · Hesitant 10 h · Correct 1 d ·
  Confident 2 d.
- **Migration 0005** (data only, no schema change):
  1. `settings.active_ladder_id` 2→7, 3→8, 4→9, 5→10, 6→11 (any other value left alone; the code
     already falls back to the default for an unselectable id). The entry rung in step 2 is read
     from the mapped value: 7→3, 8→2, 9→2, 10→1, 11→1, anything else → Dense's.
  2. Untouched new items (`last_reviewed_at IS NULL AND ladder_step = 0`, any ladder, including
     legacy level-0 imports) move to the active ladder's entry rung (`ladder_id`, `ladder_step`,
     `interval_seconds`). `due_at` stays null; `updated_at` is not touched (system move, like f11's
     stamping). Never-reviewed items on a higher rung were placed there deliberately and are left.
- **Default.** `DEFAULT_LADDER_ID` = 8; the test harness seeds 8.
- **Mastery band.** "New" becomes never reviewed or a zero interval (`maxSeconds: 0`), so a
  reviewed word dropped to a 2 h rung reads "Learning • 2 h", not "New". Legacy bands unchanged.
- **Mastery sort.** Never-reviewed items sort first (`last_reviewed_at IS NOT NULL, interval_seconds
  ASC, …`); otherwise new words on a 10 h entry rung would sort after reviewed 2 h words.
- **No decimals on screen.** `formatInterval`: under 548 days shows months ("14 mo", "17 mo"), from
  there whole years ("3 y"); a span that rounds to 24 h reads "1 d", so a word due in just under a
  day shows "Due in 1 d", not "Due in 24 h". The Settings picker drops the "×2.38" multiplier text;
  its rows already round to whole numbers.
- **Docs.** PRD FR-A2, FR-F2 ("entry rung"), Appendix A (settings default 8); VISION §6; AGENTS
  invariants; DECISIONS entry; a pointer note at the top of the research report; smoke-test-12.

### Exclusions

- **Reset semantics unchanged.** "Reset to first rung" (Vocab edit, f11 check, f10's planned voice
  reset) still means step 0, the bottom rung: a reset is a deliberate "relearn this", so it pulls
  in close. Not the entry rung. A reset on a never-reviewed item therefore also lands on step 0.
- **Same-session relearning** (research §11) stays deferred in TODO. Review sessions load their
  queue once, so a 2 h rung means "next session".
- **Retroactive remap of reviewed items.** Non-retroactive as in f09: a reviewed item on ids 1–6
  moves to the active ladder (log-nearest rung) at its next review; no due time is rewritten.
- **An exact 1 h bottom rung on every ladder.** Rejected by the sponsor 2026-09-27: it would need an
  irregular rung; the geometric floor is 1.1–2.1 h.

### User Stories

- As the sponsor, when I add many new words and get one right, I want it back in about a day, not
  the same evening.
- As the sponsor, I want a word I keep missing to come back within a couple of hours.
- As the sponsor, I want the spacing names to be distinct and the numbers whole.

### Non-Functional Requirements

- Old ladder versions keep their exact intervals (pinned by test to the f09 formula).
- The migration loses no row, changes no `due_at`, and touches only never-reviewed step-0 rows and
  the one settings row.
- The Worker alone writes schedule state; the client only formats.


## Planning

### Testing

- **shared (`ladders.test.ts`):** ids 7–11 equal `generateIntervals(q)`; each contains 86400
  exactly, starts ≥ 3600 s with its next-lower candidate < 3600 s, rises strictly, ends at the cap
  once; ids 2–6 still equal the f09 formula (kept in the test as `f09Intervals`) and are not
  selectable; names are unique; `entryStep` = 3/2/2/1/1 for ids 7–11; first-review landings for
  Dense in both directions (the table above); `formatInterval` for Dense's rungs has no "." and
  reads as the scope table; `DEFAULT_LADDER_ID` is Dense.
- **shared (`mastery.test.ts`):** a reviewed 2 h interval is Learning; interval 0 reviewed is New;
  legacy names unchanged.
- **client:** `spacing.test.ts` rows for Dense; `MasteryPill`/list labels updated.
- **worker:** create (PWA, handoff, voice) lands on the entry rung; first review Correct → 1 d,
  Wrong → bottom rung; settings accepts 7–11 and rejects 2–6; mastery sort puts never-reviewed
  first; export includes 11 ladders; migration test: 0005 maps each old setting to its successor,
  moves untouched new rows (geometric and legacy) to the entry rung, leaves reviewed rows,
  higher-rung unreviewed rows and all `due_at`/`updated_at` values alone.
- **scripts/smoke.ts:** new item on `entryStep`; Correct lands on the next rung (1 d).
- **smoke-test-12 on the phone** after the sponsor applies 0005 remotely and deploys.

### Done When

1. `pnpm check` green, including every test above.
2. Migration 0005 applied remotely; `active_ladder_id` is the old value + 5; vocab and event counts
   unchanged.
3. smoke-test-12 green on the phone: the picker lists Very dense / Dense / Balanced / Wide / Very
   wide with no decimals; a new word graded Correct shows "Learning • 1 d"; a new word graded Wrong
   shows "Learning • 2 h".
4. PRD, VISION, AGENTS and DECISIONS carry the new ladders.

### Roadmap

- **s01 shared.** Generator around the anchor, ids 7–11, old ids retired and renamed,
  `entryStep`, default 8, band and `formatInterval` changes, tests.
- **s02 Worker + migration.** Create on the entry rung, mastery sort, migration 0005 and its test,
  harness seed, worker test updates, `scripts/smoke.ts`.
- **s03 client.** Picker without the multiplier, label tests.
- **s04 docs + smoke-test-12.** PRD/VISION/AGENTS/DECISIONS/research note; sponsor runbook.
- **s05 phone** (sponsor): remote 0005, deploy, smoke-test-12.

Order: s01 before s02/s03 (they import it). In production, apply 0005 and then deploy straight
away. Either order is safe (old code reads id 8 as unknown and falls back to its default 3; new
code reads 3 as unselectable and falls back to 8), but a word added between the two steps would
land on the wrong ladder's rung until its first review.

**Cross-front dependency.** f11's in-flight `smoke-tests/smoke-test-11.md` C9 expects a reset item
"due about 3 h after its last review". Once f12 is deployed that reads about 2 h. The sponsor holds
uncommitted edits to that file, so f12 does not touch it; the sponsor reads C9 as "the bottom rung,
about 2 h" if f12 deploys first.


## Status

### Recently Completed

- 2026-09-27 — Investigated, sponsor approved the day-anchored spreads and naming; opened and
  stress-tested (5 findings resolved: "24 h" label, migration entry lookup for already-new ids,
  deploy order, f11 C9 dependency, reset on a never-reviewed item).

### Next Steps

- Build s01–s04, then the sponsor runs smoke-test-12.

### Open Questions

- None.


## Decisions

- **2026-09-27 — New words start on an entry rung, not a special first-review rule** (agent).
  Storing the entry rung at creation keeps `scheduleReview` unchanged and makes a new item's state
  honest in the rung select. Rejected: a `last_reviewed_at IS NULL` branch in `scheduleReview`
  (a second scheduling path, and it would override a rung set by hand before the first review).
- **2026-09-27 — Migration 0005 maps the setting and moves untouched new rows** (agent). Rejected:
  a successor table in code (a stale id forever in D1); leaving old new rows at 3 h (they would
  remap to the 4 h rung and first-land at 10 h).
- **2026-09-27 — Retired ladders renamed "… v1"** (agent). Only ids are stored; names are display
  and export only, and "Dense" now means ×2.38.
- **2026-09-27 — Reset keeps meaning the bottom rung** (agent; see Exclusions).
