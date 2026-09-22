# Status - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: The **thin hub** — a cross-front map of where things stand *right now*. Not a journal, not a sessions log. Verbose per-front narration lives in each front's `*-journal.md`; what-happened one-liners live in `SESSIONS.md`. Keep this file scannable.

*As of: 2026-09-22*

## Open Workfronts
*Work items actively in flight. One line each → its doc/journal. Closed fronts drop off (rosters keep the full list).*

- f05 `review` — 🟡 IN PROGRESS, built; smoke-test-05 part-way green with the sponsor → `features/f05-review.md`
- f06 `coach-contract` — 🟡 IN PROGRESS, Stages 1–2 (ChatGPT paste path + fill-ins) built, `pnpm check` green; smoke-test-06 remaining, then close (Stage 3 re-homed, 260918h) → `features/f06-coach-contract.md`
- f07 `coach-client` — 🟡 IN PROGRESS, s01–s04 built (s04 spend adds migration 0003, **not yet applied remotely**); s05 prompt tuning next → `features/f07-coach-client.md`

## Next Session Pointers
*The 1–3 concrete next actions for a cold start.*

1. **f05 `review`**: D is done; E and F remain, on the deployed build (read "next review" checks as "due in"). F5 rechecks the button-colour fix found at D2. Then `/pm-close`.
2. **f06 to the phone**: the deployed build carries it; the sponsor runs `smoke-tests/smoke-test-06.md`, two real ChatGPT round trips. Then `/pm-close` f06.
3. **f07 `coach-client`**: s04 spend is built. Before any deploy that carries it, the sponsor applies **migration 0003 remotely** — without the `voice_sessions` table every session create fails. Then s05 prompt tuning. The rest of the s03 checks ride smoke-test-07. The OpenAI key is a Cloudflare secret only, so live voice checks run against the deployment, never `pnpm dev` (260921a). Inbox drained 2026-09-22; it left **two `#sponsor-decide` scope calls** in `pm/TODO.md` (Coach edits vocab mid-conversation; kept transcripts) — both reverse f07 exclusions, so they are PRD-scope calls, with recommendations on the items. **At `/pm-resume`, run `/grill-me` on those two recommendations before anything else** — the sponsor wants them interrogated, not accepted (sponsor instruction 2026-09-22). Toolchain: AVG Hardened Mode + CyberCapture off; never add exceptions.
