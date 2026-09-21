# Status - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: The **thin hub** — a cross-front map of where things stand *right now*. Not a journal, not a sessions log. Verbose per-front narration lives in each front's `*-journal.md`; what-happened one-liners live in `SESSIONS.md`. Keep this file scannable.

*As of: 2026-09-21*

## Open Workfronts
*Work items actively in flight. One line each → its doc/journal. Closed fronts drop off (rosters keep the full list).*

- f05 `review` — 🟡 IN PROGRESS, built; smoke-test-05 part-way green with the sponsor → `features/f05-review.md`
- f09 `srs-ladder` — 🟡 IN PROGRESS, built and `pnpm check` green; migration 0002 applied remotely; redeploy and smoke-test-09 remaining → `features/f09-srs-ladder.md`
- f06 `coach-contract` — 🟡 IN PROGRESS, Stages 1–2 (ChatGPT paste path + fill-ins) built, `pnpm check` green; smoke-test-06 remaining, then close (Stage 3 re-homed, 260918h) → `features/f06-coach-contract.md`
- f07 `coach-client` — 🟡 IN PROGRESS, s01–s03 built and deployed; voice add verified on the phone 2026-09-21; s04 spend next → `features/f07-coach-client.md`

## Next Session Pointers
*The 1–3 concrete next actions for a cold start.*

1. **f09 `srs-ladder` to production**: remote migration 0002 is applied and the current build is deployed (2026-09-21). The sponsor continues `smoke-tests/smoke-test-09.md` from A3, then phone checks. Then `/pm-close` f09.
2. **f05 `review`**: its remaining smoke-test-05 parts (D, E, F) now run on the f09 build, because main carries both; read "next review" checks as "due in". Then `/pm-close`.
3. **f06 to the phone**: the deployed build carries it; the sponsor runs `smoke-tests/smoke-test-06.md`, two real ChatGPT round trips. Then `/pm-close` f06.
4. **f07 `coach-client`**: s04 spend (migration 0003 `voice_sessions`, usage report, Settings display and caps). The rest of the s03 checks ride smoke-test-07. The OpenAI key is a Cloudflare secret only, so live voice checks run against the deployment, never `pnpm dev` (260921a). **Inbox: 2 — `/pm-triage` owed** (Coach-side vocab edits; kept transcripts). Toolchain: AVG Hardened Mode + CyberCapture off; never add exceptions.
