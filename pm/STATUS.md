# Status - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: The **thin hub** — a cross-front map of where things stand *right now*. Not a journal, not a sessions log. Verbose per-front narration lives in each front's `*-journal.md`; what-happened one-liners live in `SESSIONS.md`. Keep this file scannable.

*As of: 2026-09-14*

## Open Workfronts
*Work items actively in flight. One line each → its doc/journal. Closed fronts drop off (rosters keep the full list).*

- 🟡 f01 `urdu-core-foundation` (Phase 1) — s01–s03 done (scaffold, shared rules, schema); s04 auth next → `features/f01-urdu-core-foundation.md` · journal `features/f01-urdu-core-foundation-journal.md`

## Next Session Pointers
*The 1–3 concrete next actions for a cold start.*

1. f01 s04 auth: unlock/lock, session middleware, cookie, JSON guard, last-seen throttle, unlock rate limit. Ask sponsor first: own local `UNLOCK_SECRET` in `.dev.vars` or agent-generated; also make tests set bindings explicitly (spike OpenAI key still in `.dev.vars`).
2. Then s05 vocab + due and s07 PWA shell (s07 can run in parallel with s05/s06).
