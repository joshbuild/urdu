# Mini-plan — Mixed-direction review

**Status**: 🟡 IN PROGRESS — *opened 2026-10-15; s01–s03 built 2026-10-15 (`b600b71`, not deployed); s04 phone next.*
**Handle**: `mp06`
**Created**: 2026-10-15 · **Updated**: 2026-10-15

**Owner docs it serves**:
- `pm/PRD.md` §2 (drops "mixed-direction review" from the v0 exclusions) and FR-E1 (session direction)
- `pm/DECISIONS.md` 261015a (this change); 260918b/c/d (one shared schedule, asymmetric deltas, automatic direction choice deferred)
- `shared/` (the direction weighting is a domain rule, beside `ladders.ts` and `mastery.ts`)

**Companions**: `research/urdu-vocabulary-srs-research-and-design.md` §3–§5 (shared schedule, direction
choice); f16 `dash` FR-J3 (the recall split this feeds).

> **One-line:** add a **Mixed** direction to the review start screen, made the default, that picks
> Urdu → English or English → Urdu per card at random, with the chance of English → Urdu rising
> with the item's current interval. Items keep one shared schedule.

Background (sponsor, 2026-10-15): the Dash's production recall shows "not enough reviews yet". The
sponsor tried to run production reviews, but nothing was due: the two directions share one
schedule, and recognition passes had already pushed the due times out. A per-direction split
(Anki-style) was weighed and deferred. Mixed builds production evidence in every session and
lets production misses pull intervals back, with no migration and no second due count.

---

## As-is

- The start screen's **Direction** fieldset offers Urdu → English (default) and English → Urdu
  (`src/screens/ReviewScreen.tsx`). The choice applies to the whole session
  (`SessionState.direction` in `src/review/session.ts`).
- Each grade POSTs `{grade, direction}`. The Worker applies the direction's deltas (production
  −1/0/0/+1/+2) and records the direction on the event. f15 correction recomputes from the
  event's own direction (`worker/domain/review.ts`).
- `promptSide` shows the Urdu side for English → Urdu when the item has no English, but the grade
  is still recorded as `en_ur`. That is a recognition review mislabelled as production.

## Design

- **Weighting** (`shared/direction.ts`, new): `productionChance(intervalSeconds)` returns the
  probability of English → Urdu, from the item's current `interval_seconds`. Using the interval,
  not the rung, keeps it independent of the ladder version.

  | Current interval | P(English → Urdu) |
  |---|---|
  | under 1 day (new and entry-rung items) | 0.1 |
  | 1 day to under 1 week | 0.3 |
  | 1 week to under 1 month (30 d) | 0.5 |
  | 1 month to under 6 months (182 d) | 0.7 |
  | 6 months and up | 0.8 |

  The floor gives new words some production from the start. The cap keeps some recognition on
  mature words. These are tuning values, not invariants: the agent chose them, and the sponsor
  may retune after use.
- **Choice per card** (`chooseDirection(item, random)` in the same file): an item with no English
  is always `ur_en`. Otherwise it draws against `productionChance`. `random` is injectable for
  tests.
- **Session** (`src/review/session.ts`): `start` takes a mode (`mixed` | `ur_en` | `en_ur`) and
  fixes each card's direction once, when the session starts, into a `directions` array aligned
  with `queue`. Back and grade correction see the same direction the card was first shown in.
  A fixed mode fills the array with that direction, except that `en_ur` on an item with no English
  becomes `ur_en`, which fixes the mislabel above.
- **Start screen:** the fieldset gains **Mixed** as its first option and the default. The label
  is "Mixed", with a one-line hint: "Mostly Urdu → English for new words, mostly English → Urdu
  for words you know." The choice is not remembered between visits (as now).
- **Card:** a small direction label in the card's top row ("Urdu → English" / "English → Urdu")
  so a Mixed session says which way each card runs. It must fit mp04's one-screen card.
- **Unchanged:** the Worker, the schedule, the deltas, due order, review ahead, the Dash, and Coach
  `oral`. No migration, no API change.

## Stages

- **Stage 0 — plan** (this doc): done 2026-10-15.
- **Stage 1 — build** s01–s03 on `main`: done 2026-10-15 (`b600b71`).
- **Stage 2 — phone** s04, sponsor (daily use counts).

## Slices

- **mp06-s01 Rule.** `shared/direction.ts` with `productionChance` and `chooseDirection`;
  `shared/direction.test.ts`: each band edge (exactly 1 d is 0.3, and so on), no English → `ur_en`
  whatever the draw, and a draw just below or at the chance picks each side.
- **mp06-s02 Client.** Session mode and the `directions` array in `src/review/session.ts`;
  `promptSide` takes the card's direction; `ReviewScreen.tsx` gets the Mixed option, the hint, the
  card label, and the POST sends the card's direction. Tests in `src/review/session.test.ts`:
  directions are fixed at start and survive Back; fixed `en_ur` with no English records `ur_en`;
  Mixed uses the injected `random`. Headless screenshots of the start screen and a card at phone
  width.
- **mp06-s03 Docs.** PRD §2 (drop "mixed-direction review") and FR-E1 (Mixed default, per-card
  choice, weighting in `shared/direction.ts`); AGENTS.md: `direction.ts` in the `shared/` row of
  the authority table; `smoke-tests/smoke-test-mp06.md` (a short phone walk-through).
- **mp06-s04 Phone (sponsor).** Deploy, then use Mixed in normal review. Done on a report that the
  mix feels right and production reviews appear on the Dash.

## Done When

- [x] Mixed is the default on the review start screen; each card shows its direction; Back and
      correction keep it.
- [x] Production reviews of items with no English are recorded as `ur_en`.
- [x] s01/s02 tests pass and `pnpm check` is green.
- [x] PRD §2 and FR-E1, and AGENTS.md, match the as-built.
- [ ] The sponsor has used Mixed on the phone and the Dash's production recall is accumulating.

---

## Open Questions

- **Weighting values** (sponsor, after use): the table above is a starting point. Retune if
  Mixed feels too easy or too hard. A change edits `shared/direction.ts` and its tests; it needs
  no migration because directions are never stored on items.

---

## Decisions

- 2026-10-15: Mixed is a per-card weighted random draw on one shared schedule, not a
  per-direction split and not a hard rung cutoff (sponsor; DECISIONS 261015a).
- 2026-10-15: The weighting reads `interval_seconds`, not `ladder_step`, so it survives ladder
  changes (agent).
- 2026-10-15: Directions are drawn once at session start, so Back and correction see the card as
  it was shown (agent).
- 2026-10-15: The card's direction label sits under the count in the top row, not beside it, so
  Back, Skip and End still fit one row at 360 px (agent).
