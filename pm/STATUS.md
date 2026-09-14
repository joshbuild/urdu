# Status - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: The **thin hub** — a cross-front map of where things stand *right now*. Not a journal, not a sessions log. Verbose per-front narration lives in each front's `*-journal.md`; what-happened one-liners live in `SESSIONS.md`. Keep this file scannable.

*As of: 2026-09-14*

## Open Workfronts
*Work items actively in flight. One line each → its doc/journal. Closed fronts drop off (rosters keep the full list).*

- 🟡 mp02 `gpt-live-spike` — s01–s02 done, s03 page built 2026-09-14; sponsor's desktop Chrome run next, then deploy + phone run → `mini-plans/mp02-gpt-live-spike.md` (journal: `mini-plans/mp02-gpt-live-spike-journal.md`)

## Next Session Pointers
*The 1–3 concrete next actions for a cold start.*

1. Sponsor: s03 desktop run — `npx wrangler dev`, open `http://127.0.0.1:8787`, paste the `SPIKE_TOKEN` from `.dev.vars`, Connect, speak Urdu, ask it to add a word to the vault, End session, Copy results JSON into the journal. Also paste the real Coach instructions (the Worker uses a stand-in prompt).
2. Agent: fix whatever the desktop run surfaces (session schema, tool path, voice names), then s04: sponsor runs `npx wrangler secret put OPENAI_API_KEY` and `SPIKE_TOKEN` (a new value, not the local one); agent deploys; phone run.
3. s05 Custom GPT comparison, s06 verdict, `/pm-close mp02`, then `/pm-open` f01. Then s04 phone run, s05 Custom GPT comparison, verdict, `/pm-open` f01.
