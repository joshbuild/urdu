# Status - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: The **thin hub** — a cross-front map of where things stand *right now*. Not a journal, not a sessions log. Verbose per-front narration lives in each front's `*-journal.md`; what-happened one-liners live in `SESSIONS.md`. Keep this file scannable.

*As of: 2026-10-06*

## Open Workfronts
*Work items actively in flight. One line each → its doc/journal. Closed fronts drop off (rosters keep the full list).*

- f07 `coach-client` — 🟡 IN PROGRESS, s01–s04 built (migration 0003 applied remotely and deployed 2026-09-23); s05 prompt tuning next → `features/f07-coach-client.md`
- f18 `topic-coverage` — 🟡 IN PROGRESS, opened 2026-10-06 (DECISIONS 261006a); topics approved and plan stress-tested; s01 next → `features/f18-topic-coverage.md`
- mp05 `voice-vocab-bucket` — 🟡 IN PROGRESS, opened and stress-tested 2026-10-02 (s01–s07; Voice words held from top-up, DECISIONS 261002a); s01 `find_vocab` build next (no migration) → `mini-plans/mp05-voice-vocab-bucket.md`

## Next Session Pointers
*The 1–3 concrete next actions for a cold start.*

1. **mp05 `voice-vocab-bucket`**: s01 `find_vocab` build next (no migration) → `mini-plans/mp05-voice-vocab-bucket.md`.
2. **f07 `coach-client`**: s04 spend is deployed; the sponsor compares Settings spend with the OpenAI dashboard later on 2026-09-23 (TODO). Then s05 prompt tuning. The rest of the s03 checks ride smoke-test-07. The OpenAI key is a Cloudflare secret only, so live voice checks run against the deployment, never `pnpm dev` (260921a). Once f07 closes, open f10 `coach-followups` (planned 2026-09-22 from the grill of the two Coach scope calls, DECISIONS 260922a): a vocab-edit voice tool, tappable Urdu in bubbles, the last transcript kept on the device. Toolchain: AVG Hardened Mode + CyberCapture off; never add exceptions.
3. **f18 `topic-coverage`**: §Topics and quotas approved 2026-10-06 (50 topics, A1 685 / A2 955 / B1 935); stress-tested 2026-10-06, s01 next (topics, migration 0008, coverage route) → `features/f18-topic-coverage.md`.
