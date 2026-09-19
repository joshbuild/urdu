# Status - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: The **thin hub** — a cross-front map of where things stand *right now*. Not a journal, not a sessions log. Verbose per-front narration lives in each front's `*-journal.md`; what-happened one-liners live in `SESSIONS.md`. Keep this file scannable.

*As of: 2026-09-18*

## Open Workfronts
*Work items actively in flight. One line each → its doc/journal. Closed fronts drop off (rosters keep the full list).*

- f05 `review` — 🟡 IN PROGRESS, built; smoke-test-05 part-way green with the sponsor → `features/f05-review.md`
- f09 `srs-ladder` — 🟡 IN PROGRESS, built and `pnpm check` green; migration 0002 applied remotely; redeploy and smoke-test-09 remaining → `features/f09-srs-ladder.md`
- f06 `coach-contract` — 🟡 IN PROGRESS, Stages 1–2 (ChatGPT paste path + fill-ins) built, `pnpm check` green; smoke-test-06 remaining, then close (Stage 3 re-homed, 260918h) → `features/f06-coach-contract.md`
- f07 `coach-client` — 🟡 IN PROGRESS, s01–s03 built (broker, tool routes, Voice tab), `pnpm check` green; s03 desktop run with a real key, then s04 spend → `features/f07-coach-client.md`

## Next Session Pointers
*The 1–3 concrete next actions for a cold start.*

1. **f09 `srs-ladder` to production**: remote migration 0002 is applied. The sponsor redeploys (`pnpm run deploy`, picks up the Settings spacing layout) and continues `smoke-tests/smoke-test-09.md` from A3, then phone checks. Then `/pm-close` f09.
2. **f05 `review`**: its remaining smoke-test-05 parts (D, E, F) now run on the f09 build, because main carries both; read "next review" checks as "due in". Then `/pm-close`.
3. **f06 to the phone**: the sponsor deploys (`pnpm run deploy`, no migration) and runs `smoke-tests/smoke-test-06.md`, two real ChatGPT round trips. Then `/pm-close` f06.
4. **f07 `coach-client`**: desktop run of the Voice tab once the key is in `.dev.vars` (short session, an add and a duplicate add), then s04 spend. Sponsor: put `OPENAI_API_KEY` in `.dev.vars` for the desktop run. Inbox empty. Toolchain: AVG Hardened Mode + CyberCapture off; never add exceptions.
