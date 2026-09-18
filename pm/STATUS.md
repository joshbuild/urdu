# Status - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: The **thin hub** — a cross-front map of where things stand *right now*. Not a journal, not a sessions log. Verbose per-front narration lives in each front's `*-journal.md`; what-happened one-liners live in `SESSIONS.md`. Keep this file scannable.

*As of: 2026-09-18*

## Open Workfronts
*Work items actively in flight. One line each → its doc/journal. Closed fronts drop off (rosters keep the full list).*

- f05 `review` — 🟡 IN PROGRESS, s01–s04 built; smoke-test-05 with the sponsor → `features/f05-review.md`

## Next Session Pointers
*The 1–3 concrete next actions for a cold start.*

1. **f05 `review`** — sponsor deploys and runs `smoke-tests/smoke-test-05.md`; then `/pm-close` (FR-E1..E4; session limit already in Settings via `src/settings/sessionLimit.ts`). Then f08 `vocab-enrich`.
2. **Inbox: 1 item** (complete missing fields on existing vault items) — `/pm-triage` before or alongside f05; it may shape f08's scope (backfill mode).
3. Toolchain is healthy when AVG **Hardened Mode** and **CyberCapture** are off (sponsor toggles these per session; never add AVG exceptions — measured harmful). Do not bump Biome without re-testing execution on this machine.
