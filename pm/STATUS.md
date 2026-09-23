# Status - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: The **thin hub** — a cross-front map of where things stand *right now*. Not a journal, not a sessions log. Verbose per-front narration lives in each front's `*-journal.md`; what-happened one-liners live in `SESSIONS.md`. Keep this file scannable.

*As of: 2026-09-23*

## Open Workfronts
*Work items actively in flight. One line each → its doc/journal. Closed fronts drop off (rosters keep the full list).*

- f06 `coach-contract` — 🟡 IN PROGRESS, Stages 1–2 deployed; smoke-test-06 A1/B3/B4 green via the `vocab-json` ChatGPT Project command; B5–B7 + Part C remaining, then close → `features/f06-coach-contract.md`
- f07 `coach-client` — 🟡 IN PROGRESS, s01–s04 built (migration 0003 applied remotely and deployed 2026-09-23); s05 prompt tuning next → `features/f07-coach-client.md`

## Next Session Pointers
*The 1–3 concrete next actions for a cold start.*

1. **f06 close-out**: the sponsor finishes `smoke-tests/smoke-test-06.md` — B5–B7 (open a new word, re-paste, bad paste) and Part C (fill-in round trip). Then `/pm-close` f06. Settings › About shows the deployed commit to match against `git log`.
2. **f07 `coach-client`**: s04 spend is deployed with migration 0003 remote (2026-09-23); a live voice session on the phone confirms it. Then s05 prompt tuning. The rest of the s03 checks ride smoke-test-07. The OpenAI key is a Cloudflare secret only, so live voice checks run against the deployment, never `pnpm dev` (260921a). Once f07 closes, open f10 `coach-followups` (planned 2026-09-22 from the grill of the two Coach scope calls, DECISIONS 260922a): a vocab-edit voice tool, tappable Urdu in bubbles, the last transcript kept on the device. Toolchain: AVG Hardened Mode + CyberCapture off; never add exceptions.
