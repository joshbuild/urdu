# Status - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: The **thin hub** — a cross-front map of where things stand *right now*. Not a journal, not a sessions log. Verbose per-front narration lives in each front's `*-journal.md`; what-happened one-liners live in `SESSIONS.md`. Keep this file scannable.

*As of: 2026-09-17*

## Open Workfronts
*Work items actively in flight. One line each → its doc/journal. Closed fronts drop off (rosters keep the full list).*

- **f03 `reader`** 🟡 in progress (s01, opened 2026-09-17) — paste-and-read Nastaliq, tap-to-speak, selection action bar, add and define (FR-C1..C8 + the FR-I1 voice picker) → `features/f03-reader.md`

## Next Session Pointers
*The 1–3 concrete next actions for a cold start.*

1. **Phase 1 is done.** f02 closed 2026-09-17: the production import put 36 vocab rows, 3 tags and 0 review events into D1, verified through D1, `GET /api/export` and the phone (total 36 / due 8). Every Phase 1 exit condition is met.
2. **f03 `reader` is open (2026-09-17).** Start s01: a reader screen and minimal navigation behind the existing unlock, on top of `src/App.tsx`. Slices and open questions are in `features/f03-reader.md`. `spikes/speech/` is the working reference for `speak()` (s04) and is deleted once f03 ships it (TODO).
3. Toolchain is healthy when AVG **Hardened Mode** and **CyberCapture** are off (sponsor toggles these per session; never add AVG exceptions — measured harmful). Do not bump Biome without re-testing execution on this machine.
