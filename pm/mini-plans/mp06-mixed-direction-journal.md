# Journal — mp06 Mixed-direction review

**Current state:** s01–s03 built 2026-10-15 (`b600b71`, not deployed). s04 is the sponsor's:
deploy, then use Mixed in normal review (`smoke-tests/smoke-test-mp06.md`). No migration.

## 2026-10-15 — built s01–s03 (261015d)

- s01: `shared/direction.ts` (`productionChance` bands on `interval_seconds`, `chooseDirection`
  with injectable `random`, no English → `ur_en`); 3 tests on each band edge and both draws.
- s02: `SessionState.direction` became `directions`, aligned with `queue` and carried into the
  done phase so Back from the tally keeps it. `cardDirections(items, mode, random)` runs in the
  screen and goes in on the `start` action, keeping the reducer pure. A fixed `en_ur` session
  gives `ur_en` to items with no English, which fixes the mislabel. Start screen: Mixed first
  and default, its hint under the radios. Card: the direction on a second eyebrow line under
  the count (beside it would crowd Back/Skip/End at 360 px). 4 new session tests.
- Headless Edge over CDP on `pnpm dev` (port 5288) at 360 px: start screen, cards in both
  directions, a revealed card with the grade grid still on one screen. The cards were skipped,
  so no local grades were written.
- s03: PRD §2 and FR-E1, AGENTS `shared/` row, CHANGELOG, `smoke-tests/smoke-test-mp06.md`.
- `pnpm check` green at 833; Biome's three descending-specificity warnings are old (grade bar).

## 2026-10-15 — opened (261015c)

- Trigger: the sponsor went to do production reviews because the Dash's production recall read
  "not enough reviews yet", and found nothing due. Both directions share one schedule.
- Weighed how other apps handle it: Anki gives each direction its own card and schedule; WaniKani
  makes every part of an item pass; Memrise and Duolingo keep one item and vary the exercise. A
  rung-gated direction and a full per-direction split were both discussed. The sponsor asked
  about random; the agent recommended weighting it by interval and keeping the fixed options.
  The sponsor approved. DECISIONS 261015a.
- Found while reading `src/review/session.ts`: fixed English → Urdu on an item with no English
  shows the Urdu side but records `en_ur`. s02 fixes it.
- Opened as a doc only; `pnpm check` green before the commit (`4e6b2b9`).
