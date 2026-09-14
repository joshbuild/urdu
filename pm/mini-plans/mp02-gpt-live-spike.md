# Mini-plan — GPT-Live Spike

**Status**: 🟡 IN PROGRESS — opened 2026-09-14; s01 done 2026-09-14; s02/s03 next; Stages 1–2 gated on the sponsor's phone and the criterion-4 answer
**Handle**: `mp02`
**Created**: 2026-09-14 · **Updated**: 2026-09-14

**Owner docs it serves**:
- `pm/PRD.md` FR-G (Coach client: Option 1 Custom GPT vs Option 2 in-app voice), FR-B5 (Worker-minted client secret), Appendix D (the four pass criteria), §6 cost NFR.
- `pm/PLAN.md` Phase 0 exit ("FR-G option chosen and recorded in `DECISIONS.md`; `PRD.md` FR-G updated to name the chosen option"); f07 `coach-client` one-liner.
- `pm/DECISIONS.md` 260911a (Coach client decided by this spike; cap ~$0.50/day).

**Companions**: mp01 `speech-spike` (closed, PASS). Feeds `f07-coach-client` and, if Option 2, `f06` (the Coach contract routes the tools bind to).

> **One-line:** Build a throwaway Worker route that mints a GPT-Live-1 client secret and a throwaway page that talks to GPT-Live-1 over WebRTC from the sponsor's installed Android Chrome, run the four Appendix D criteria plus one Custom GPT voice session for comparison, and record which FR-G option v0 ships. One mini-plan because the route, the page, the phone run, and the verdict are worthless apart and none owns a vision.

---

## Stages

- **Stage 0 — Research and build.** Confirm the current GPT-Live-1 API surface (client-secret endpoint, WebRTC SDP exchange, tool-call events, usage/pricing) against OpenAI's docs, then build the Worker route, the FR-F2 stub, and the page. Verifiable in desktop Chrome with the sponsor's key before touching the phone. No sponsor input needed except the key for the desktop check.
- **Stage 1 — Phone run.** Deploy, run the ten-minute Urdu session in installed mode, exercise a mid-conversation tool call, read the cost. Gated on Stage 0, the sponsor's OpenAI API key loaded as a Worker secret, and the phone in hand.
- **Stage 2 — Comparison and verdict.** Sponsor runs one Urdu voice session in a private Custom GPT (Advanced Voice Mode); record pass/fail per Appendix D; promote to `pm/DECISIONS.md`; name the chosen option in PRD FR-G; update PLAN f07 line; `/pm-close`.

Stages are strictly sequential.

## Slices

- **mp02-s01 — API research.** Read OpenAI's current docs for GPT-Live-1 (the Realtime API successor): endpoint and body for minting an ephemeral client secret, the WebRTC SDP offer/answer flow, data-channel event names for session config, function-call requests and results, audio transcript events, and the usage/cost events or dashboard needed for criterion 4. Record findings and the per-minute price in the journal. Verify: the journal has a short "API surface" section with exact endpoint paths and event names, dated.
- **mp02-s02 — Worker route + stub.** `spikes/gpt-live/worker.ts` (throwaway, not `worker/`): `POST /api/spike/session` takes the browser's SDP offer, calls `POST /v1/live/sessions` with the `OPENAI_API_KEY` Worker secret and the server-side session config (model, voice, Coach instructions, Responses delegation with the `add_to_vault` function tool), and returns `{sessionId, sdp}` (s01 finding: GPT-Live has no browser-held secret; the Worker brokers the session); `POST /api/spike/vault-add` is the FR-F2 stub (logs the proposal, returns `{ok:true, id}`); both require an `X-Spike-Token` header matching a `SPIKE_TOKEN` secret so a public deployment cannot burn credits. `wrangler.jsonc` gains `main` and switches `assets.directory` to `./spikes/gpt-live`. Verify: `npx wrangler dev` locally with `.dev.vars`; curl returns a secret; curl the stub returns ok; wrong token returns 401.
- **mp02-s03 — Spike page.** `spikes/gpt-live/index.html` (inline CSS/JS, manifest, icons reused from `spikes/speech/`): token entry (stored in `sessionStorage` only), Connect/Disconnect, mic capture, remote audio playback, live transcript pane, event log, session timer, tool-call handling (`add_to_vault` → POST to the stub → return result to the model so the conversation resumes), running usage/cost estimate from the API's usage events at the s01 price, and a "Copy results JSON" button. Verify: desktop Chrome on Windows holds a short Urdu exchange and completes one tool call.
- **mp02-s04 — Deploy and phone run.** Sponsor: `npx wrangler secret put OPENAI_API_KEY` and `SPIKE_TOKEN`; agent: `npx wrangler deploy`. Sponsor installs the page from Chrome, launches from the home-screen icon, and runs ~10 minutes of Urdu conversation as they would with the Coach, including "add X to my vault" at least once. Record: connect success in standalone mode (criterion 1), sponsor's 1–5 comparison to ChatGPT Voice and notes on latency, interruption handling, Urdu quality (criterion 2), tool call executed and conversation resumed (criterion 3), cost from the OpenAI usage dashboard for the session window (criterion 4). Delete the Worker afterwards, as mp01 did.
- **mp02-s05 — Custom GPT comparison.** Sponsor creates (or reuses) a private "Only me" Custom GPT with the current Coach instructions and holds one Urdu voice session in Advanced Voice Mode; scores it 1–5 on the same axes. Agent records in the journal. Cheap; can run any time after s01.
- **mp02-s06 — Verdict.** Fill §Decisions with pass/fail per criterion and the chosen option; prepend to `pm/DECISIONS.md`; edit PRD FR-G to name the option (keep the other as v1 deferred); update PLAN Phase 0 mp02 line and the f07 one-liner; then `/pm-close mp02`.

## Done When

All of the following are true:
1. `spikes/gpt-live/` exists, ran on the phone in installed mode, and the s04 measurements plus the s05 comparison are recorded in `mp02-gpt-live-spike-journal.md`.
2. Each Appendix D criterion has an explicit pass/fail with evidence in this doc's §Decisions: (1) WebRTC session established from installed Android Chrome via a Worker-minted secret; (2) ten minutes of Urdu judged comparable to ChatGPT Voice by the sponsor; (3) a mid-conversation tool call hit the FR-F2 stub and the conversation resumed; (4) measured cost for the ten minutes at most $0.50 all-in.
3. The FR-G option is recorded in `pm/DECISIONS.md` (all four pass → Option 2; any fail → Option 1).
4. `pm/PRD.md` FR-G names the chosen option; `pm/PLAN.md` Phase 0 exit is satisfied and the f07 line says which client it builds.
5. The spike Worker deployment is deleted; no OpenAI key is in the repo or in any client-readable place.

---

## Open Questions

- **Criterion 4 is unpassable as written (sponsor).** s01 found voice alone costs $0.05/min, so ten minutes is $0.50 before the 15 s creation charge and any backend tokens; Appendix D's "at most $0.50 including backend and tool charges" cannot be met. Decision 260911a's intent was voice-only (~$0.50/day ≈ 10 min). Options: (a) amend Appendix D criterion 4 to "at most $0.60 all-in for ten minutes" (backend on gpt-5.6-luna adds about a cent); (b) keep it and record Option 1 as chosen by arithmetic without running the spike; (c) another bound. Sponsor's call before s04; s02/s03 can be built either way.
- ~~**OpenAI API credit (sponsor).**~~ Resolved 2026-09-14: sponsor funded an API account (project `Urdu`, restricted 30-day key) and placed the key in `.dev.vars`. Original note kept below.
- **OpenAI API credit (sponsor, original).** Decision 260911a records that the sponsor has no paid API credits and ChatGPT Plus includes none. This spike needs a funded OpenAI API key: roughly $1–2 of prepaid credit covers the desktop check plus the ten-minute run. Sponsor to confirm they will fund it before s04; without it the spike cannot run and Option 1 ships by default (Appendix D: any criterion unmet → Option 1).
- **Which OpenAI account.** The same key later serves FR-B5 if Option 2 ships; use the account the sponsor intends to keep, not a throwaway.
- **Coach instructions source.** s02 needs the current Coach system prompt to make criterion 2 a fair comparison. Sponsor to paste the current ChatGPT Urdu Coach instructions into the journal (or point to where they live); otherwise the spike uses a short stand-in prompt and the journal notes it.

---

## Decisions

- 2026-09-14 — Spike code lives under `spikes/gpt-live/` (Worker + page), reusing the existing `wrangler.jsonc` and Worker name `urdu`; the deployment is deleted after the run, as mp01's was. Rationale: PLAN Phase 0 allows "a Worker with one route" and nothing more; keeping it out of `worker/` stops throwaway code from becoming f01's starting point.
- 2026-09-14 — The secret-minting route is protected by a spike-only shared token header, not by the future session cookie. Rationale: a public unauthenticated minting endpoint would let anyone spend the sponsor's credit; the real FR-B auth is f01's job.
- 2026-09-14 — Tool calls are handled in the browser over the WebRTC data channel first (`response.event` in, `response.item.create` + `response.create` out); a Durable Object holding the sideband WebSocket (`/v1/live/sessions/{id}/attach`) is the fallback only if the data channel does not carry them. Rationale: zero extra infrastructure for a throwaway, and the docs imply both connections see the same stream. Backend model for delegation is `gpt-5.6-luna`, not the docs' `gpt-5.6-terra`: an Urdu coach needs no frontier reasoning and the cost criterion is tight.
- 2026-09-14 — Pass criteria are the four in PRD Appendix D exactly as written, fixed before any measurement, so the verdict cannot be argued to fit the result.
