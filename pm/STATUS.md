# Status - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: The **thin hub** — a cross-front map of where things stand *right now*. Not a journal, not a sessions log. Verbose per-front narration lives in each front's `*-journal.md`; what-happened one-liners live in `SESSIONS.md`. Keep this file scannable.

*As of: 2026-09-17*

## Open Workfronts
*Work items actively in flight. One line each → its doc/journal. Closed fronts drop off (rosters keep the full list).*

- 🟡 f01 `urdu-core-foundation` (Phase 1) — s01–s07 built and committed, `pnpm check` green; s07 browser verification outstanding → `features/f01-urdu-core-foundation.md` · journal `features/f01-urdu-core-foundation-journal.md`

## Next Session Pointers
*The 1–3 concrete next actions for a cold start.*

1. Finish f01 s07's browser gate: `pnpm dev`, then unlock/reload/lock plus wrong-secret and offline error paths, and Chrome device emulation for the narrow layout and 48 px targets. Agent HTTP probing is permission-denied, so this is a sponsor-run check (journal 260917b).
2. f01 s08 deploy + phone: `scripts/smoke.ts`, AGENTS.md commands, then the sponsor runbook in the f01 doc.
3. Toolchain is healthy when AVG **Hardened Mode** and **CyberCapture** are off (sponsor toggles these per session; never add AVG exceptions — measured harmful). Do not bump Biome without re-testing execution on this machine.
