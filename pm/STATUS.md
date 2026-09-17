# Status - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: The **thin hub** — a cross-front map of where things stand *right now*. Not a journal, not a sessions log. Verbose per-front narration lives in each front's `*-journal.md`; what-happened one-liners live in `SESSIONS.md`. Keep this file scannable.

*As of: 2026-09-17*

## Open Workfronts
*Work items actively in flight. One line each → its doc/journal. Closed fronts drop off (rosters keep the full list).*

- f02 `airtable-import` — 🟡 IN PROGRESS (Stage 1, import endpoint). Phase 1's remaining exit condition. → `features/f02-airtable-import.md`

## Next Session Pointers
*The 1–3 concrete next actions for a cold start.*

1. f02 Stage 1: build `worker/domain/import.ts` + `worker/routes/api-admin.ts` + `test/import.test.ts` (idempotent upsert by `airtable_id`). Sponsor answers Q1–Q3 in the f02 doc; Q1 gates Stage 2, Q2 gates the endpoint's auth shape.
2. Two carried-forward items from f01 are in `TODO.md`: `preview_urls` defaulted on at deploy, and the bundle secret scan covers `dist/client` only. Small; fold into the next slice rather than a front of their own.
3. Toolchain is healthy when AVG **Hardened Mode** and **CyberCapture** are off (sponsor toggles these per session; never add AVG exceptions — measured harmful). Do not bump Biome without re-testing execution on this machine.
