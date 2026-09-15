# Status - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: The **thin hub** — a cross-front map of where things stand *right now*. Not a journal, not a sessions log. Verbose per-front narration lives in each front's `*-journal.md`; what-happened one-liners live in `SESSIONS.md`. Keep this file scannable.

*As of: 2026-09-14*

## Open Workfronts
*Work items actively in flight. One line each → its doc/journal. Closed fronts drop off (rosters keep the full list).*

- 🟡 f01 `urdu-core-foundation` (Phase 1) — s01–s05 done (scaffold, shared rules, schema, auth, vocab); s06 review next → `features/f01-urdu-core-foundation.md` · journal `features/f01-urdu-core-foundation-journal.md`

## Next Session Pointers
*The 1–3 concrete next actions for a cold start.*

1. f01 s06 review + export: `worker/domain/review.ts` (batch with stale-mastery guard), `POST /api/vocab/:id/reviews`, `GET /api/export`.
2. s07 PWA shell can run in parallel with s06.
