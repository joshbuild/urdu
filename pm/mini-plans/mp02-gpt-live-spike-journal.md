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

## 2026-09-14 — s04 phone smoke run (deployed; not yet the criterion run)

Sponsor set the secrets and redeployed; the deployed Worker works. Session `live_u7_EO86jrmiqvHDCvCPwHIoy`, Android 10 Chrome 152, voice `marin`, backend `gpt-5.6-luna`. **Browser tab, not installed** (`standalone: false`), 38 billed seconds. Sponsor: "worked. replied saying vocab added."
- Worker to OpenAI create 208 ms; answer to `session.started` 258 ms. No errors.
- Urdu greeting exchange, then a spoken request in mixed Urdu/English to add زندگی. `add_to_vault {"urdu":"زندگی","roman":"zindagi","english":"life","kind":"word"}` reached the stub (ok) at 31.9 s. Backend: 2 calls, 2397 input + 92 output (26 reasoning) tokens, about $0.0006. `session.closed` with `close_requested`, `usage.seconds` 38.
- Voice cost for the session about $0.032. Context ratio 0.014 after 38 s.
- Model's transcript came back in Urdu script this time (desktop run 1 was Roman).
- **Ordering concern:** the voice model's "ہو گیا، زندگی کا مطلب ہے 'life'" ended at 31.8 s, before the tool call arrived at 31.9 s. It said "done" before the add had happened, and no later spoken confirmation appears in the transcript even though the backend made a second (29-token) response after the result. Here the add succeeded, so no harm, but a real Coach must not confirm a vault write it has not seen succeed. Watch for this in the ten-minute run (does a failed add still get "done"?); if it repeats, tighten the instructions ("say you are adding it; confirm only after the result") before the verdict.

What this proves for Appendix D: the deployed Worker-brokered WebRTC session works on the phone, and criterion 3's path works on the phone. Still owed for s04: criterion 1 in **installed** mode, the ~ten-minute session for criterion 2 (sponsor 1–5 vs ChatGPT Voice), and dashboard cost for criterion 4.

## 2026-09-14 — s04 installed-mode run (criterion 1 PASS)

Session `live_u7_EO8CY9U8NTo9Cow6PvAOa`, same phone, launched from the home-screen icon: **`standalone: true`**, `secureContext: true`, no errors. 30 billed seconds.
- Worker to OpenAI create 820 ms (208 ms on the tab run); answer to `session.started` 291 ms.
- User opened in Roman Urdu ("Salam. Aap kaise hain"); the model answered in Urdu. Spoken request "ایک لفظ ایڈ کریں ووکیب کو… مشک" → `add_to_vault {"urdu":"مشک","roman":"mushk","english":"musk","kind":"word"}` reached the stub (ok) at 20.9 s, 3.9 s after the user finished speaking.
- Backend: 2 calls, 2352 input + 113 output (48 reasoning) tokens, about $0.0006. Voice about $0.025.
- Ordering: the Coach's utterance "ٹھیک ہے۔ میں یہ لفظ ابھی… شامل کر دیتی ہوں۔ ہو گیا…" ran 17.6–25.2 s and the tool call landed at 20.9 s, inside it. The transcript has no word-level timing, so it can't show whether "ہو گیا" came before or after the result. Still unproven; the ten-minute run should include one add that the stub rejects to settle it (see below).

**Criterion 1: PASS.** A WebRTC session was set up from installed Android Chrome through the Worker, and a tool call worked in the same session.
**Criterion 3: PASS on the phone** (tab and installed runs both hit the stub and continued).
Still owed: criterion 2 (ten minutes, sponsor 1–5 vs ChatGPT Voice) and criterion 4 (dashboard cost for that session).

## 2026-09-14 — real Coach instructions in (for the criterion 2 run)

Sponsor pasted the ChatGPT Urdu Coach instructions; verbatim copy in `pm/mini-plans/mp02-coach-instructions.md` (also the starting point for f07). `spikes/gpt-live/worker.ts` `COACH_INSTRUCTIONS` now uses them, adapted:
- Aim & Scope and Interaction Style kept word for word.
- Added a short voice section (short turns, correct after the learner finishes, no letter-by-letter spelling).
- Airtable schema, mastery, update, lookup, import and quiz sections cut: the spike has only `add_to_vault`. The Coach says so if asked for those. This means criterion 2 judges conversation and correction quality, not vocab management.
- Add rule reworded: say "adding it" while in progress; never say done until the backend reports the result; say so if it failed. Backend instructions got the same rule, from the source's "Never claim a change succeeded unless the action actually succeeded".
All runs before this entry (desktop 1–2, phone tab, phone installed) used the stand-in prompt. esbuild bundles the Worker cleanly. Sponsor redeploys (`npx wrangler deploy`) before the ten-minute run.

## 2026-09-14 — s04 five-minute installed run (real Coach instructions)

Session `live_u7_EO8N3sxyIZ3AjhhzsKb1J`, installed (`standalone: true`), voice `marin`, first run on the real Coach prompt. 303 billed seconds (5 min 6 s), no errors, closed `close_requested`. Create 222 ms, answer to started 229 ms. Context ratio 0.095 at the end, so ten minutes is about 0.19 (no pressure). Sponsor: "it worked pretty well." No 1–5 score yet.

**What the session was.** Sponsor gave seven words out loud (قدرت، قلت، بار بار، جادو، لہجہ، خستہ، لباس) and asked to be quizzed, then asked for English explanations, made a sentence, and asked to add the new word.

**Cost (estimate; dashboard figure still owed).** Voice 303 s × $0.05/60 = $0.253. Backend: 5 responses, 12,617 input (5,866 cached, 2,376 cache-write) + 623 output tokens on gpt-5.6-luna ≈ $0.002 (cache writes priced as plain input). Total ≈ **$0.255 for five minutes → about $0.51 for ten**, under the $0.60 bound. 4 delegations, 1 tool call: the backend also produced quiz and explanation text, so backend cost grows with the kind of session, but at luna prices it stays around a cent per ten minutes.

**Went well**
- Quiz run as the instructions say: one item at a time, waited, marked right answers, corrected قلت ("opposite" → کمی / shortage), handled "never heard this word" by explaining خستہ.
- Asked for the last words to be repeated when it didn't catch them, instead of guessing.
- Resolved "یہ نیا لفظ ایڈ کریں" to لباس from context. `add_to_vault {"urdu":"لباس","roman":"libaas","english":"clothing; outfit","kind":"word"}`, stub ok at 283.1 s.
- Add wording followed the new rule: "میں ابھی اسے… شامل کر رہی ہوں" (adding), then "شامل کر دیا گیا ہے" (done). The utterance started at 280.4 s and the tool call landed at 283.1 s, about 3 s in, which is roughly where the "adding" clause ends. Consistent with confirm-after-result, but the transcript has no word timing and the stub never fails, so the failure case is still untested.
- Responses start almost at once: the Coach usually begins within 0–600 ms of the end of the learner's turn. Yielded well when asked to wait ("جی، آرام سے سوچ لیں").

**Problems**
1. **Ignored "explain in English" twice.** At 152.8 s the sponsor asked for the خستہ explanation in English; the Coach said "میں اس کی وضاحت انگریزی میں کرتی ہوں" and explained in Urdu. At 180.6 s ("Now tell me the same thing in English") it switched to لباس, not خستہ, and again answered mostly in Urdu with English glosses. The instruction "If I ask for an English explanation, explain in English" is kept word for word, so this is the model, not the prompt adaptation.
2. **Bogus correction.** Sponsor said "میں لباس پہنوں گا"; the Coach said "ہلکی سی درستی" and then gave the identical sentence plus "بس ایک چھوٹی سی گردن" (گردن = neck; meaningless here). May be a pronunciation note that came out garbled; as heard, it corrects nothing and is confusing. The source says "Do not overcorrect harmless variation."
3. **Jumps into hesitations.** Several overlaps where the Coach started while the sponsor was mid-sentence or saying "um" (3.6 s, 13.6 s, 38.4 s, 135.8 s, 194.2 s, 216.8 s). Fast turn-taking is good, but a learner who pauses to think gets talked over. Worth asking the sponsor how it felt and comparing with ChatGPT Voice.
4. Markdown (`**bold**`) appears in the Coach transcript, probably from backend-written text. Harmless to audio unless it gets read out.
5. Minor: قدرت accepted as "nature" when the sponsor said "power or nature"; both are right (قدرت also means power or ability), so the Coach's "بالکل… nature" slightly narrowed a correct answer.

**Status against Appendix D.** Criterion 1 PASS (earlier run). Criterion 3 PASS. Criterion 4 on track (≈ $0.51 per ten minutes extrapolated; needs the dashboard figure, and the criterion says ten minutes). Criterion 2 not yet judged: the criterion says ten minutes, and the sponsor's 1–5 score against ChatGPT Voice is still owed.

## 2026-09-14 — sponsor judgment on the five-minute run (s04 done)

Sponsor: "against chatgpt voice on my phone, i'd say it's pretty comparable." No numeric score given; recorded as comparable. OpenAI dashboard: September spend $0.40, all of it today, covering every run (desktop 1–2, phone tab, phone installed, the five-minute run; about 460 billed seconds plus backend). So the five-minute run cost at most $0.40, and the per-run arithmetic ($0.255) puts ten minutes at about $0.51, under $0.60. Sponsor accepted the five-minute run as enough for the spike ("we can massage as we go along"), so no second session.

Appendix D result: (1) PASS, (2) PASS by sponsor judgment on five minutes, (3) PASS, (4) PASS by extrapolation, backed by the dashboard total. By the FR-G selection rule this points to Option 2 (in-app GPT-Live-1 voice). The formal verdict and PRD/PLAN edits are s06.

Carried to f07 if Option 2 ships: English-explanation requests ignored, a garbled non-correction, barging into learner hesitations, markdown in spoken text, and confirm-after-result untested against a failing tool.

## 2026-09-14 — s06 verdict (docs done); s05 skipped

Option 2 recorded: DECISIONS 260914c (written at the previous wrap) plus this session's PRD edits (FR-G names Option 2 with Option 1 deferred to v1; FR-B5 rewritten for the brokered SDP flow, no browser-held credential; FR-I1 unconditional spend display; Appendix D result paragraph) and PLAN edits (Phase 0 mp02 line ✅, f07 phase line and roster one-liner). s05 skipped as moot, with Done-When 1 annotated. `git grep` finds no OpenAI key in tracked files; `.dev.vars` and `.wrangler/prod-token.txt` are ignored. `npx wrangler delete --name urdu --force` was blocked by the permission classifier (irreversible deletion), so the sponsor runs it. Then `/pm-close mp02`. Note that deleting the Worker also drops its `OPENAI_API_KEY` and `SPIKE_TOKEN` secrets; f07 sets the key again on the real Worker.

Uncommitted state at the earlier wrap: `spikes/gpt-live/worker.ts` (real Coach prompt, deployed by the sponsor) and `pm/mini-plans/mp02-coach-instructions.md` are committed in this wrap. The spike Worker is still live at urdu.umber-amber.workers.dev with secrets set; delete it in s06.
