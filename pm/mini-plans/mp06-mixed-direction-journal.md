# Journal — mp06 Mixed-direction review

**Current state:** opened 2026-10-15; s01–s04 planned, s01 `shared/direction.ts` build next. No
migration, no Worker or API change.

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
