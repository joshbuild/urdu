# Status - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: The **thin hub** — a cross-front map of where things stand *right now*. Not a journal, not a sessions log. Verbose per-front narration lives in each front's `*-journal.md`; what-happened one-liners live in `SESSIONS.md`. Keep this file scannable.

*As of: 2026-09-17*

## Open Workfronts
*Work items actively in flight. One line each → its doc/journal. Closed fronts drop off (rosters keep the full list).*

- f02 `airtable-import` — 🟡 IN PROGRESS (Stages 1–3 done; Stage 4 is the sponsor's production run). Phase 1's remaining exit condition. → `features/f02-airtable-import.md`

## Next Session Pointers
*The 1–3 concrete next actions for a cold start.*

1. **f02 Stage 4 is the sponsor's**: work through `smoke-tests/smoke-test-02.md` — dry run, deploy, import, verify, phone. Exit 0 with a clean report closes Done-When #4/#5; exit 1 brings the report back. Verified locally already: 36 rows in, idempotent on re-run, report clean.
2. When that checklist comes back green, record it in the f02 journal and close the front — that is Phase 1's exit condition.
3. Toolchain is healthy when AVG **Hardened Mode** and **CyberCapture** are off (sponsor toggles these per session; never add AVG exceptions — measured harmful). Do not bump Biome without re-testing execution on this machine.
