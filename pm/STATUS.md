# Status - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: The **thin hub** — a cross-front map of where things stand *right now*. Not a journal, not a sessions log. Verbose per-front narration lives in each front's `*-journal.md`; what-happened one-liners live in `SESSIONS.md`. Keep this file scannable.

*As of: 2026-09-16*

## Open Workfronts
*Work items actively in flight. One line each → its doc/journal. Closed fronts drop off (rosters keep the full list).*

- 🟡 f01 `urdu-core-foundation` (Phase 1) — s01–s06 done (scaffold, shared rules, schema, auth, vocab, review + export); s07 PWA shell next → `features/f01-urdu-core-foundation.md` · journal `features/f01-urdu-core-foundation-journal.md`

## Next Session Pointers
*The 1–3 concrete next actions for a cold start.*

1. Codex runtime: resolve Windows subprocess `EPERM`; rerun `pnpm check` and verify `pnpm dev` over local HTTP. PM skill access is working; see the f01 journal's 260916a handoff.
2. f01 s07 PWA shell: manifest + icons (from `design/icon/icon_1254.png`), unlock screen, status screen, lock.
3. f01 s08 deploy + phone: `scripts/smoke.ts`, CLAUDE.md commands, then the sponsor runbook in the f01 doc.
