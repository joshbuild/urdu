# Status - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: The **thin hub** — a cross-front map of where things stand *right now*. Not a journal, not a sessions log. Verbose per-front narration lives in each front's `*-journal.md`; what-happened one-liners live in `SESSIONS.md`. Keep this file scannable.

*As of: 2026-09-28*

## Open Workfronts
*Work items actively in flight. One line each → its doc/journal. Closed fronts drop off (rosters keep the full list).*

- f07 `coach-client` — 🟡 IN PROGRESS, s01–s04 built (migration 0003 applied remotely and deployed 2026-09-23); s05 prompt tuning next → `features/f07-coach-client.md`
- f11 `vocab-check` — 🟡 IN PROGRESS, s01–s03 built 2026-09-24; s04 phone under way (0004 remote + deployed; smoke-test-11 at B1) → `features/f11-vocab-check.md`
- f12 `day-anchored-ladders` — 🟡 IN PROGRESS, s01–s04 built 2026-09-27; s05 phone next (0005 remote, deploy, smoke-test-12) → `features/f12-day-anchored-ladders.md`
- f13 `check-modes` — 🟡 IN PROGRESS, opened 2026-09-28 (grilled, stress-tested); s01 batch next (migration 0006, local) → `features/f13-check-modes.md`
- mp03 `review-ahead-hours` — 🟡 IN PROGRESS, s01–s03 built 2026-09-27; s04 phone next (smoke-test-mp03, rides the f12 deploy; no migration) → `mini-plans/mp03-review-ahead-hours.md`

## Next Session Pointers
*The 1–3 concrete next actions for a cold start.*

1. **f12 `day-anchored-ladders`**: the sponsor backs up, applies 0005 remotely, deploys, and runs `smoke-tests/smoke-test-12.md`; then AGENTS Project state and `/pm-close f12`. The same deploy carries mp03: run `smoke-tests/smoke-test-mp03.md` (no migration), then `/pm-close mp03`.
2. **f11 `vocab-check`**: s04 phone. The sponsor deploys the strict-JSON prompt fix (`52259a6`), re-pastes `src/handoff/chatgpt-project-instructions.md` into the ChatGPT Project, and continues `smoke-tests/smoke-test-11.md` from B1 (A1–A2 green). After it is green: ripple PRD FR-F9 / Appendix A, AGENTS Project state and PLAN, then `/pm-close f11`.
3. **f07 `coach-client`**: s04 spend is deployed; the sponsor compares Settings spend with the OpenAI dashboard later on 2026-09-23 (TODO). Then s05 prompt tuning. The rest of the s03 checks ride smoke-test-07. The OpenAI key is a Cloudflare secret only, so live voice checks run against the deployment, never `pnpm dev` (260921a). Once f07 closes, open f10 `coach-followups` (planned 2026-09-22 from the grill of the two Coach scope calls, DECISIONS 260922a): a vocab-edit voice tool, tappable Urdu in bubbles, the last transcript kept on the device. Toolchain: AVG Hardened Mode + CyberCapture off; never add exceptions.
