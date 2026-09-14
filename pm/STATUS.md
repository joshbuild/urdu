# Status - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: The **thin hub** — a cross-front map of where things stand *right now*. Not a journal, not a sessions log. Verbose per-front narration lives in each front's `*-journal.md`; what-happened one-liners live in `SESSIONS.md`. Keep this file scannable.

*As of: 2026-09-14*

## Open Workfronts
*Work items actively in flight. One line each → its doc/journal. Closed fronts drop off (rosters keep the full list).*

- 🟡 mp02 `gpt-live-spike` — s01–s03 done 2026-09-14 (desktop: Urdu speech, tool call round trip, close usage all work); s04 deployed, sponsor to set secrets and redeploy, then phone run → `mini-plans/mp02-gpt-live-spike.md` (journal: `mini-plans/mp02-gpt-live-spike-journal.md`)

## Next Session Pointers
*The 1–3 concrete next actions for a cold start.*

1. Sponsor: `npx wrangler secret put OPENAI_API_KEY` (value from `.dev.vars`), `npx wrangler secret put SPIKE_TOKEN` (value from `.wrangler/prod-token.txt`), `npx wrangler deploy`.
2. Sponsor: s04 phone run at https://urdu.umber-amber.workers.dev in installed mode, ten minutes of Urdu, at least one vault add, End session, paste results JSON + 1–5 score vs ChatGPT Voice + OpenAI usage-dashboard cost. Paste the real Coach instructions first if wanted.
3. s05 Custom GPT comparison, s06 verdict, `/pm-close mp02`, then `/pm-open` f01. Then s04 phone run, s05 Custom GPT comparison, verdict, `/pm-open` f01.
