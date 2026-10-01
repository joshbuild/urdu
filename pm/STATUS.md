# Status - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: The **thin hub** — a cross-front map of where things stand *right now*. Not a journal, not a sessions log. Verbose per-front narration lives in each front's `*-journal.md`; what-happened one-liners live in `SESSIONS.md`. Keep this file scannable.

*As of: 2026-10-01*

## Open Workfronts
*Work items actively in flight. One line each → its doc/journal. Closed fronts drop off (rosters keep the full list).*

- f07 `coach-client` — 🟡 IN PROGRESS, s01–s04 built (migration 0003 applied remotely and deployed 2026-09-23); s05 prompt tuning next → `features/f07-coach-client.md`
- f11 `vocab-check` — 🟡 IN PROGRESS, s01–s03 built 2026-09-24; s04 phone under way (0004 remote + deployed; smoke-test-11 at B1) → `features/f11-vocab-check.md`
- f12 `day-anchored-ladders` — 🟡 IN PROGRESS, s01–s04 built 2026-09-27; s05 phone next (0005 remote, deploy, smoke-test-12) → `features/f12-day-anchored-ladders.md`
- f13 `check-modes` — 🟡 IN PROGRESS, s01–s04 built 2026-09-28; s05 phone next (0006 remote, deploy, smoke-test-13) → `features/f13-check-modes.md`
- f14 `new-word-finder` — 🟡 IN PROGRESS, s01–s03 built 2026-09-28; s04 phone next (deploy only, re-paste the Project instructions, smoke-test-14) → `features/f14-new-word-finder.md`
- mp03 `review-ahead-hours` — 🟡 IN PROGRESS, s01–s03 built 2026-09-27; s04 phone next (smoke-test-mp03, rides the f12 deploy; no migration) → `mini-plans/mp03-review-ahead-hours.md`
- f15 `review-correction` — 🟡 IN PROGRESS, s01–s02 built and `pnpm check` green; s03 phone next (no migration) → `features/f15-review-correction.md`
- f16 `dash` — 🟡 IN PROGRESS, opened and stress-tested 2026-10-01; s01 `shared/dash.ts` next → `features/f16-dash.md`

## Next Session Pointers
*The 1–3 concrete next actions for a cold start.*

1. **f16 `dash`**: build s01, `KNOWN_MIN_SECONDS` and `shared/dash.ts` with `shared/dash.test.ts`, per the stress-tested plan; then s02 the route. No migration.

2. **f15 `review-correction`**: after the next deploy, run `smoke-tests/smoke-test-15.md` on the installed phone; then `/pm-close f15` if green.

3. **f12 `day-anchored-ladders`**: the sponsor backs up, applies 0005 remotely, deploys, and runs `smoke-tests/smoke-test-12.md`; then AGENTS Project state and `/pm-close f12`. The same deploy carries mp03: run `smoke-tests/smoke-test-mp03.md` (no migration), then `/pm-close mp03`.
4. **f11 `vocab-check`**: s04 phone. The sponsor deploys the strict-JSON prompt fix (`52259a6`), re-pastes `src/handoff/chatgpt-project-instructions.md` into the ChatGPT Project, and continues `smoke-tests/smoke-test-11.md` from B1 (A1–A2 green). After it is green: ripple PRD FR-F9 / Appendix A, AGENTS Project state and PLAN, then `/pm-close f11`.
5. **f13 `check-modes`**: rides the same deploy as f12/mp03/f11. The sponsor's `migrations apply --remote` applies 0005 and 0006 in order, then deploy and run `smoke-tests/smoke-test-13.md`; smoke-test-11 continues (its D2 now goes through the dialog). Then `/pm-close f13`.
6. **f14 `new-word-finder`**: rides any deploy (no migration). The sponsor re-pastes `src/handoff/chatgpt-project-instructions.md` into the ChatGPT Project and runs `smoke-tests/smoke-test-14.md`; then AGENTS Project state and `/pm-close f14`.
7. **f07 `coach-client`**: s04 spend is deployed; the sponsor compares Settings spend with the OpenAI dashboard later on 2026-09-23 (TODO). Then s05 prompt tuning. The rest of the s03 checks ride smoke-test-07. The OpenAI key is a Cloudflare secret only, so live voice checks run against the deployment, never `pnpm dev` (260921a). Once f07 closes, open f10 `coach-followups` (planned 2026-09-22 from the grill of the two Coach scope calls, DECISIONS 260922a): a vocab-edit voice tool, tappable Urdu in bubbles, the last transcript kept on the device. Toolchain: AVG Hardened Mode + CyberCapture off; never add exceptions.
