# Journal — mp02 gpt-live-spike

*Verbose per-front record. Hub: `pm/STATUS.md`; doc: `mp02-gpt-live-spike.md`.*

## 2026-09-14 — opened

Opened after mp01 closed. Stage 0 cleared: s01 (API research) needs no sponsor input; s02/s03 can be built and desktop-checked once the sponsor supplies a funded OpenAI key in `.dev.vars`. Three open questions raised for the sponsor (API credit, which account, Coach instructions source) — see the doc.

## 2026-09-14 — s01 API research (done)

Sponsor funded an OpenAI API account (project `Urdu`, restricted key: List models read + Realtime request, 30-day expiry) and placed the key in `.dev.vars` (gitignored). Note for s02: the key's scope was chosen before s01 found that GPT-Live uses `/v1/live/sessions`, not `/v1/realtime`; if the first desktop call returns 401/403 on scope, the key needs the Live resource (or "All") added in the OpenAI dashboard.

Sources read: OpenAI *Getting started with GPT-Live*, *WebRTC* quickstart (`?api=live`), *Delegation and tools in GPT-Live*, *Managing GPT-Live sessions*, model page `gpt-live-1`, pricing page, the Realtime client-secrets reference (for contrast), and Microsoft's Foundry GPT-Live how-to (fuller field table; same API shape).

### API surface

**GPT-Live-1 is not the Realtime API.** It is the *Live Sessions API*: `POST https://api.openai.com/v1/live/sessions`. `POST /v1/realtime/client_secrets` and `ek_…` ephemeral keys belong to `gpt-realtime-*` and are not used here. Model id: `gpt-live-1` (only snapshot). Launched in the API 2026-09-10.

**Session create (server, project API key):**
```
POST https://api.openai.com/v1/live/sessions
Authorization: Bearer <OPENAI_API_KEY>
Content-Type: application/json
{
  "session": {
    "model": "gpt-live-1",
    "instructions": "<Coach prompt, written in the language we want spoken>",
    "audio": { "output": { "voice": "marin" } },
    "delegation": {
      "type": "responses",
      "responses": {
        "model": "gpt-5.6-luna",
        "instructions": "<backend prompt>",
        "tools": [ { "type": "function", "name": "add_to_vault", "description": "...", "parameters": { ... } } ],
        "tool_choice": "auto"
      }
    }
  },
  "transport": { "type": "webrtc", "sdp": "<browser SDP offer>" }
}
→ { "session": { "id": "<session_id>" }, "transport": { "type": "webrtc", "sdp": "<answer>" } }
```
The browser's SDP offer travels through our Worker, which returns the answer. There is no browser-held secret in this flow; the Worker is the only holder of the key. Criterion 1's "Worker-minted client secret" wording maps to "Worker-brokered session" (same trust boundary, stronger). The `session` object is strict: unknown fields are rejected. `model`, `instructions`, `audio.output.voice`, and `delegation.type` are immutable after start; only `delegation.responses.*` can change via `session.update`. Creating a WebRTC session bills 15 s of voice up front.

**Browser (WebRTC):** `new RTCPeerConnection()`; `getUserMedia({audio:true})` then `addTrack`; `ontrack` into an autoplay audio element; `createDataChannel("oai-events")`; `createOffer` and `setLocalDescription`; POST `offer.sdp` to our Worker; `setRemoteDescription({type:"answer", sdp})`. Wait for `session.started` on the data channel before sending commands. Needs HTTPS or localhost (fine: `wrangler dev` locally, workers.dev on the phone).

**Data-channel / WebSocket events (JSON, same on both):**
- `session.started`, `session.updated`, `session.closed` (final cumulative `usage.seconds` + `reason`; read cost from this), `error` (`code`, `message`, `client_event_id`).
- `session.input_transcript.delta` (user), `session.output_transcript.delta` (assistant), each `delta` + `start_ms`/`end_ms`. No turn-complete event; fragments interleave.
- `session.usage.updated` gives cumulative `usage.seconds` and `context_window.usage_ratio`.
- Client to server: `session.close`; `session.instructions.append` / `session.thinking.append` / `session.commentary.append` (`content` up to 500 tokens, `delegation_id` null for general context).
- Responses delegation: backend events arrive nested as `response.event` (`delegation_id`, `event: { type: "response.output_item.done", … }`). A completed function call is a `response.output_item.done` item with `call_id`, `name`, `arguments`. The application returns it with `response.item.create { item: { type: "function_call_output", call_id, output } }` and must then send `response.create` ("appending a function result does not automatically continue the response"). Speech continues while the backend works.
- Sideband: a trusted server can attach a second WebSocket to the running session at `wss://api.openai.com/v1/live/sessions/{session_id}/attach` (Bearer key; pattern confirmed on Azure's mirror, OpenAI's own page does not print it), receives the same events, and its commands enter the same stream.

**Where tool calls are executed.** OpenAI's docs say the browser data channel is "for captions and local UI updates" and route custom-tool execution through the server. But the sideband doc also says the sideband "receives the same JSON server events as the primary connection, and any commands it sends enter the same session stream", which implies the primary (the browser's data channel) can do both too. Plan: s03 tries tool handling in the browser first (zero extra infrastructure); if `response.event` never reaches the data channel or `response.item.create` is rejected, s02 grows a Durable Object that holds the sideband WebSocket and executes the stub. Recorded as a mini-plan decision.

**Voices:** default `marin`; the launch post lists twelve GPT-Live voices (Quartz, Ripple, Vesper, Willow, Stone, Gleam, Meridian, Bossa, Tempo, Beacon, Delta, Cinder). Pick in s03 by ear. Language is not a config field: "write your prompt in the language you want the model to speak". Urdu is not listed anywhere as supported or unsupported; that is exactly what criterion 2 tests.

**Pricing (pricing page, 2026-09-14):**

| Item | Price |
|---|---|
| gpt-live-1 voice | $0.05 / min, billed per second, plus 15 s at WebRTC session create |
| gpt-5.6-terra (backend, docs default) | $2.00 in / $0.20 cached / $12.00 out per 1M tokens |
| gpt-5.6-luna (backend, cheap) | $0.20 in / $0.02 cached / $1.20 out per 1M tokens |
| web_search tool | $10 / 1k calls (not needed) |

**Cost finding for criterion 4.** Ten minutes of voice alone is $0.50 plus $0.0125 for the creation charge. PRD Appendix D criterion 4 says "at most $0.50 including backend and tool charges" for ten minutes, so it cannot pass as written even with a free backend. Decision 260911a's intent was "~$0.50/day ≈ 10 min at $0.05/min", i.e. voice cost only. Backend cost with gpt-5.6-luna for a 10-minute chat with a few delegations is on the order of a cent. Raised as a sponsor question in the doc: amend criterion 4 to a realistic bound (e.g. at most $0.60 all-in for ten minutes), or keep it and accept that Option 1 wins by arithmetic.

### Consequences for s02/s03
- Worker route becomes `POST /api/spike/session` taking `{sdp}` and returning `{sessionId, sdp}`; the session config (voice, instructions, delegation, `add_to_vault` tool) lives server-side. No secret-minting route.
- `wrangler.jsonc` needs `main` (the Worker) and `assets.directory = ./spikes/gpt-live`. Durable Objects only if the browser-side tool path fails.
- Page needs a `sessionStorage` spike token, connect/disconnect, transcript pane from the two transcript-delta streams, `session.usage.updated` seconds times $0.05/60 as the running cost, `response.event` logging, function-call handling, and `session.closed` usage capture into the results JSON.

## 2026-09-14 — criterion 4 amended; s02 built and verified; s03 built, awaiting desktop run

Sponsor chose $0.60 for Appendix D criterion 4 (DECISIONS 260914b; PRD amended). Sponsor also confirmed API credit is loaded.

**s02 Worker (`spikes/gpt-live/worker.ts`).** `wrangler.jsonc` now has `main`, `assets.binding = ASSETS`, `assets.run_worker_first = ["/api/*"]`, and `assets.directory = ./spikes/gpt-live`. Routes: `GET /api/spike/health`, `POST /api/spike/session` (SDP in, `{sessionId, sdp, createMs}` out; session config server-side: `gpt-live-1`, voice from the page, stand-in Coach prompt, Responses delegation on `gpt-5.6-luna` with the `add_to_vault` function tool), `POST /api/spike/vault-add` (FR-F2 stub; logs and returns `{ok, id}`). Both POST routes require `X-Spike-Token`. `SPIKE_TOKEN` generated into `.dev.vars` (a first append landed on the key's line because the file had no trailing newline; fixed). Local verification with `wrangler dev`:

| Call | Result |
|---|---|
| health | `{ok, hasKey:true, hasToken:true}` |
| session without token | 401 |
| vault-add with token | 200, stub id returned |
| session with a dummy SDP | 502 wrapping OpenAI 400 `invalid_offer`: "Offer did not have an audio media section." |

The last row proves the restricted key authenticates against `/v1/live/sessions` (no 401/403 on scope) and the request reaches SDP validation. Whether the `session` object itself is accepted (strict schema: `audio.output.voice`, `delegation.responses.tools`) is only proven by a real browser offer, i.e. s03's desktop run. **s02 done.**

Gotcha for anyone restarting: two `wrangler dev` instances on the same port wedge every request, including the local explorer API; kill all `node` and `workerd` processes before restarting.

**s03 page (`spikes/gpt-live/index.html`)** built: token entry (sessionStorage), voice picker (marin/cedar plus the twelve launch-post names, unverified), Connect / End session / Mute, elapsed and billed-seconds counters, running voice-cost estimate (seconds + 15 s creation charge, at $0.05/min), transcript bubbles from the two transcript-delta streams, event log, browser-side tool-call handling (`response.event` → stub → `response.item.create` + `response.create`, with `delegation_id` echoed when present), backend usage capture from nested `response.completed`, and Copy results JSON. `node spikes/gpt-live/check.js` passes. **Awaiting the sponsor's desktop Chrome run** at `http://127.0.0.1:8787` with the token from `.dev.vars`: a short Urdu exchange plus one "add X to my vault" request. Unknowns that run settles: whether the session config is accepted; whether the tool call reaches the data channel (else Durable Object sideband fallback); which voice names are valid; how Urdu sounds.

## 2026-09-14 — s03 desktop run 1 (Windows Chrome 152)

Key needed `api.responses.write` for Responses delegation (first attempt: 401 `missing_scope`). Editing the existing key's permissions had not taken effect after 3 min; sponsor created a new key with List models read, Realtime request, Responses write. That works.

Run 1, session `live_u7_EO7uD93mvnZ6hcUsNVdAs`, voice `marin`, 64 s elapsed, 44 billed seconds, voice cost estimate $0.049:
- Worker to OpenAI session create 1823 ms; answer to `session.started` 153 ms; peer and data channel connected immediately.
- **Session config accepted as written** (strict schema passed: `audio.output.voice`, Responses delegation, function tool).
- Model spoke Urdu audibly. Its transcript came back in Roman Urdu ("Hmm. Theek hai, ek second."); the user transcript came back in Urdu script with English words inline.
- **Tool call reached the browser data channel.** `session.delegation.created` then nested `response.event`s; `response.output_item.done` carried `add_to_vault {"urdu":"جملہ","roman":"jumla","english":"sentence","kind":"word"}` about 1.1 s after the delegation started. Stub returned ok. So no sideband / Durable Object is needed.
- **Bug:** `response.item.create` and `response.create` were rejected, `unknown_parameter: delegation_id`. So the backend never received the result and the conversation did not resume from the tool call. Fixed: the page no longer sends `delegation_id` on those commands. Criterion 3 needs a rerun.
- Backend usage for the delegation: 1089 input, 72 output (35 reasoning) tokens on gpt-5.6-luna, about $0.0003.
- `session.close` sent at 60 s; no `session.closed` within 5 s, so final usage was not captured. Close drains delegated work, and the stuck delegation may have held it open. Page now waits 20 s.
- Transcript fragments from one speaker now merge into one bubble.

## 2026-09-14 — s03 desktop run 2 (fix verified; s03 done)

Session `live_u7_EO7yVpCwsefDsFwOqIxsp`, voice `marin`, ~47 s. Worker to OpenAI create 200 ms this time (1823 ms on run 1, likely a cold connection).
- Tool path works end to end: `add_to_vault {"urdu":"زندگی","roman":"zindagi","english":"life","kind":"word"}` about 1.2 s after `session.delegation.created`; stub ok; `response.item.create` + `response.create` accepted with no `delegation_id`; backend continued and produced the confirmation "زندگی آپ کے vocabulary vault میں save کر دی ہے—اس کا مطلب ہے “life.”" 1.8 s after the tool result. Tap-to-confirmation roughly 3 s.
- Backend usage for the whole tool exchange: 2 calls, 2342 input + 90 output tokens on gpt-5.6-luna, about $0.0006.
- `session.closed` arrived 0.6 s after `session.close`: reason `close_requested`, `usage.seconds` 45 for about 46 s elapsed. So the 15 s creation charge appears to be counted inside `usage.seconds`, not added on top; the page's estimate double-counts it. Harmless (overstates), noted for the verdict.
- Backend confirmation text mixes English words into Urdu script ("vocabulary vault", "save"); acceptable for a spike, tune in the real Coach prompt.

**s03 done** on desktop. Criterion 3 is effectively proven; it is formally judged on the phone in s04.

## 2026-09-14 — s04 deploy (partial)

`npx wrangler deploy` published the spike to https://urdu.umber-amber.workers.dev (version 1fed1120). That upload included `worker.ts` and `check.js` as public assets (no secrets in either); `spikes/gpt-live/.assetsignore` now excludes them from the next deploy. Setting the secrets and redeploying from the agent was blocked by the permission classifier (production deploy), so the sponsor runs those. Until then the deployed health route reports `hasKey:false, hasToken:false` and both POST routes return 401, so nothing can spend credit. The deployed `SPIKE_TOKEN` is a new value (kept in gitignored `.wrangler/prod-token.txt`), distinct from the local one.
