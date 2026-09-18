# Status - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: The **thin hub** — a cross-front map of where things stand *right now*. Not a journal, not a sessions log. Verbose per-front narration lives in each front's `*-journal.md`; what-happened one-liners live in `SESSIONS.md`. Keep this file scannable.

*As of: 2026-09-18*

## Open Workfronts
*Work items actively in flight. One line each → its doc/journal. Closed fronts drop off (rosters keep the full list).*

- **f04 `vocab-ui`** 🟡 in progress (s01 `GET /api/tags` next) → `features/f04-vocab-ui.md`

## Next Session Pointers
*The 1–3 concrete next actions for a cold start.*

1. **f04 `vocab-ui` open** — build s01..s06 per the doc Roadmap (FR-D1..D3 + session limit). Then f05 `review`, then f08 `vocab-enrich`. Phase 1 closed 2026-09-17 (f02 import: 36 rows in production).
2. **f03 `reader` shipped 2026-09-17** — smoke-test-03 green on the phone. Sponsor owes E6: delete the `smoke test` row from production D1 (command given in chat).
3. Toolchain is healthy when AVG **Hardened Mode** and **CyberCapture** are off (sponsor toggles these per session; never add AVG exceptions — measured harmful). Do not bump Biome without re-testing execution on this machine.
