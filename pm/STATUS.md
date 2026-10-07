# Status - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: The **thin hub** — a cross-front map of where things stand *right now*. Not a journal, not a sessions log. Verbose per-front narration lives in each front's `*-journal.md`; what-happened one-liners live in `SESSIONS.md`. Keep this file scannable.

*As of: 2026-10-06*

## Open Workfronts
*Work items actively in flight. One line each → its doc/journal. Closed fronts drop off (rosters keep the full list).*

- f07 `coach-client` — 🟡 IN PROGRESS, s01–s04 built (migration 0003 applied remotely and deployed 2026-09-23); s05 prompt tuning next → `features/f07-coach-client.md`
- f18 `topic-coverage` — 🟡 IN PROGRESS, opened 2026-10-06 (DECISIONS 261006a); s01–s03 built (0008 local only); s04 half built, parked in git stash → `features/f18-topic-coverage.md`
- mp05 `voice-vocab-bucket` — 🟡 IN PROGRESS, opened and stress-tested 2026-10-02 (s01–s07; Voice words held from top-up, DECISIONS 261002a); s01 `find_vocab` build next (no migration) → `mini-plans/mp05-voice-vocab-bucket.md`

## Next Session Pointers
*The 1–3 concrete next actions for a cold start.*

1. **mp05 `voice-vocab-bucket`**: s01 `find_vocab` build next (no migration) → `mini-plans/mp05-voice-vocab-bucket.md`.
2. **f07 `coach-client`**: s04 spend is deployed; the sponsor compares Settings spend with the OpenAI dashboard later on 2026-09-23 (TODO). Then s05 prompt tuning. The rest of the s03 checks ride smoke-test-07. The OpenAI key is a Cloudflare secret only, so live voice checks run against the deployment, never `pnpm dev` (260921a). Once f07 closes, open f10 `coach-followups` (planned 2026-09-22 from the grill of the two Coach scope calls, DECISIONS 260922a): a vocab-edit voice tool, tappable Urdu in bubbles, the last transcript kept on the device. Toolchain: AVG Hardened Mode + CyberCapture off; never add exceptions.
3. **f18 `topic-coverage`**: s01–s03 committed (coverage route, Next batch, classify). `git stash pop` the "f18 s04 wip" stash and finish s04 (pickers, filters, chips, review chip), then s05. Sponsor applies migration 0008 remotely before deploying; until s04 ships, a Vocab-tab tag edit with free text gets a 400 → `features/f18-topic-coverage.md`.
