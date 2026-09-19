# Feature Plan — Coach Client

**Status**: 🟡 IN PROGRESS — *s01 broker, s02 tools and s03 Voice screen built, `pnpm check` green (2026-09-18); s03 awaits a desktop run with a real key; s04 spend next.*
**Handle**: `f07`
**Created**: *2026-09-18* · **Updated**: *2026-09-18*

**Owner docs it serves**:
- `pm/PRD.md` — FR-G Option 2, FR-B3, FR-B5, FR-F1..F3, FR-I1, Appendix D result
- `pm/DECISIONS.md` — 260911a (contract, ~$0.50/day), 260914b/c (Live Sessions API, Option 2 chosen), 260918b (oral counts only for unprompted recall)
- `pm/features/f06-coach-contract.md` — its FR-F1/F3 logic is built here; its bearer routes and OpenAPI moved to v1 (260918h)
- Reference code: `spikes/gpt-live/` (SDP route, data-channel tool loop); prompt source `pm/mini-plans/mp02-coach-instructions.md`; evidence `pm/mini-plans/archive/mp02-gpt-live-spike-journal-archive.md`

> **One-line:** A Voice tab where the sponsor talks Urdu with a GPT-Live-1 Coach through a Worker-brokered WebRTC session. The Coach can read due vocab, add words and record tracked oral reviews mid-conversation through Urdu Core, and spend is shown and capped.

## Intent

### Vision

This replaces the ChatGPT Voice + Airtable loop. The sponsor opens the installed app, taps Start, and practises spoken Urdu. When a word comes up, "add that" puts it in the vault. When they ask for a review, the Coach quizzes due words and the results move the real schedule. The AI proposes and grades; Urdu Core decides every state change (VISION invariant). The spike showed that quality is "pretty comparable" to ChatGPT Voice at about $0.05 a minute.

### Scope

- **Voice:** a fixed `marin` constant for v0, no picker.
- **Voice screen (new tab).** Start / End / Mute, a live transcript (user and Coach bubbles merged per turn), elapsed time, the running cost of this session, and a line for each tool call ("Adding لباس… added" / "failed: duplicate"). The screen releases the mic and closes the session when it's left or the app is hidden.
- **Session broker (FR-B5).** `POST /api/voice/session` (session cookie, JSON CSRF rule): `{sdp}` in, `{sessionId, sdp}` out. The Coach config lives on the server: `gpt-live-1`, voice, the in-repo Coach prompt, Responses delegation on `gpt-5.6-luna` with the tool schemas. `OPENAI_API_KEY` is a Worker secret only. The route refuses to start a session when today's spend is at or over the hard cap.
- **Coach prompt in-repo** (`worker/coach/prompt.ts` or similar): mp02's adapted prompt, with the Airtable sections rewritten for the tools below, plus the tuning notes carried from mp02 (see Planning → Prompt tuning).
- **Tools (bound to FR-F logic, through the domain functions f06 already uses):**
  - `get_vocab` (FR-F1): due items by default, or all / by tag / limit. Returns id, urdu, roman, english, mastery band, due_at.
  - `add_to_vault` (FR-F2): candidates in, a result for each (created with id / duplicate with existing id / rejected). `source=coach`.
  - `record_review` (FR-F3): `{vocab_id?|urdu?, grade, direction: "oral", prompt_support}`. The item is resolved by id, then by `urdu_key`. Unmatched or ambiguous items are reported back, never guessed. An event whose `prompt_support ≠ none` is logged but applies delta 0 (TODO carry-forward, 260918b).
- **Tool execution path:** the browser gets `response.output_item.done` on the data channel (proven in mp02), POSTs the call to cookie-authenticated `/api/voice/tools/*` routes that call the same domain functions as FR-F, and returns the result with `response.item.create` + `response.create` (260918h).
- **Spend (FR-G, FR-I1).** When the session ends, the browser reports `session.closed` usage (seconds plus backend tokens), and the Worker records it in a new `voice_sessions` table (migration 0003). Settings shows today's spend and this session's spend. A soft daily cap (default $0.50) makes the Voice screen warn. A hard daily cap (default $1.00) makes the client end the live session on its running estimate, and the broker refuses new sessions once it's reached. Both caps are editable in Settings (a `settings` row each).
- **Idempotency for reviews:** each voice session's `session_id` acts as the FR-F3 `handoff_id` scope. A retried `record_review` call carries a per-call id (`call_id`), so a network retry can't double-apply.

### Exclusions

- The Custom GPT (Option 1), FR-B3's bearer-token `/coach/*` routes and the FR-F5 OpenAPI description are v1 (260918h). Nothing in v0 calls them.
- A sideband Durable Object. mp02 proved tool events reach the browser data channel, so it isn't needed unless that stops being true.
- Mid-session vocab edits, favourites, retagging and ladder changes by voice. The Coach says it can't do them and points to the Vocab tab.
- Saved transcripts or session history beyond the spend row. It's a non-goal and a privacy cost, with no v0 user story.
- Text chat with the Coach (the f06 ChatGPT paste path covers text).
- Deleting `spikes/gpt-live/` is a close step here (TODO), not a build slice.

### User Stories

- As the learner, I open Voice and talk Urdu with a Coach that corrects me naturally, so that I practise speaking without leaving the app.
- As the learner, I say "add that word", and it lands in my vault with Roman and English filled in, so that I don't re-type it afterwards.
- As the learner, I say "quiz me on my due words", and my spoken answers move the same schedule the Review tab uses, so that both surfaces share one learning state.
- As the learner, I see what today's sessions cost and get stopped at my cap, so that spending never surprises me.

### Non-Functional Requirements

- **Secrets:** no OpenAI credential and no Coach bearer token in the browser, the repo, URLs or storage. The build-output secret scan covers `OPENAI_API_KEY`.
- **Honesty:** the Coach never confirms a vault write before the tool result arrives, and it says so when one fails. This is tested with a forced failure (see Testing).
- **Deterministic state:** grades are proposals. Urdu Core applies the direction's deltas, the prompt-support rule, clamping and scheduling (`shared/ladders.ts`, `shared/mastery.ts`). Nothing in the client computes schedule values.
- **Cost:** about $0.05 a minute voice plus about a cent per ten minutes backend. The hard cap is enforced before session create and client-side mid-session.
- **Latency:** session create under 1 s warm (mp02: 200–820 ms). Tool call to spoken confirmation in about 3 s.
- **Device:** installed Android Chrome (v0 target). Needs the mic permission and HTTPS, which workers.dev provides.

## Planning

### Prompt tuning (carried from mp02 / TODO)

1. English-explanation requests were answered in Urdu twice. Strengthen the rule ("when asked for English, the whole explanation is in English") and put it early in the prompt.
2. A garbled non-correction ("ہلکی سی درستی" then the identical sentence). Add: "Only correct when something is wrong; if the sentence is fine, say so."
3. Barging into hesitations. Add an explicit pause tolerance ("the learner pauses to think; wait for them to finish"). If GPT-Live-1 exposes a turn-detection setting, try it; the spike didn't test one.
4. Markdown in spoken text (`**bold**`). Tell the backend instructions to use plain text and no markdown, and strip `*` in the transcript view.
5. Confirm-after-result: say "adding…", confirm only after the tool result, and report failure. Test with a duplicate add.
6. Oral grading: a result counts only for unprompted recall. The Coach sets `prompt_support` to `hint`, `answer_exposed` or `repetition` when it helped, repeated the answer first, or the learner imitated.

### Testing

- **Worker tests:** the session route (no cookie → 401; hard cap reached → refused with the reason; OpenAI error → 502 without echoing the key; request body shape sent to a stubbed `fetch`). The tool routes: `get_vocab` filters, `add_to_vault` created/duplicate/invalid, `record_review` by id, by `urdu`, unmatched, ambiguous, a `prompt_support ≠ none` event logged with delta 0, a repeated `call_id` as a no-op, and the schedule matching `applyGrade`. Spend recording and today's total in `HOME_TZ`.
- **Client tests:** the event reducer (transcript merging, tool-call lifecycle, usage → cost), the markdown strip, and cap logic.
- **Secret scan:** planted-key negative control still trips.
- **Phone smoke test (smoke-test-07):** installed app. A five-minute session with an add, a duplicate add (to test confirm-after-failure), a tracked quiz on two due items (with one hinted), and an English-explanation request. Then check the Vocab tab and the review events, and check Settings spend against the OpenAI dashboard.

### Done When

- smoke-test-07 is green on the installed phone app: the session works, tool calls change the vault correctly, a hinted answer leaves the schedule unchanged, and a failed add is not reported as done.
- The spend display matches the OpenAI dashboard within a few cents, and the hard cap refuses a new session in a forced-low-cap test.
- `spikes/gpt-live/` is deleted, `pnpm check` is green, and the PRD, AGENTS Project state and PLAN are rippled.

### Roadmap

1. **s01 broker:** `OPENAI_API_KEY` secret wiring, `POST /api/voice/session`, in-repo prompt and tool schemas, Worker tests with stubbed `fetch`. Sponsor: `wrangler secret put OPENAI_API_KEY` (a key with Realtime request + Responses write, per mp02).
2. **s02 tools:** `/api/voice/tools/*` cookie routes over the f06 domain functions, FR-F3 review resolution, `record_review` with `prompt_support`, `call_id` idempotency.
3. **s03 Voice screen:** WebRTC connect, event reducer, transcript, tool loop, lifecycle (hide / leave → close).
4. **s04 spend:** migration 0003 `voice_sessions`, usage report route, Settings display and cap editing, soft/hard caps.
5. **s05 prompt tuning** against the six notes, and the desktop run.
6. **s06 phone:** sponsor deploys (with migration 0003 remote), smoke-test-07. Then delete `spikes/gpt-live/` and close.

s01–s02 can be built and fully tested without the sponsor. s03 onwards needs a desktop mic session with a real key (a few cents).

### Stress-test resolutions (2026-09-18)

Agent-resolved from the code; none changes scope.

1. **A supported answer leaves the schedule untouched.** The draft said "applies delta 0", but `scheduleReview` with delta 0 still resets `last_reviewed_at` and `due_at`, which contradicts Done When ("a hinted answer leaves the schedule unchanged"). Resolved: an event with `prompt_support ≠ none` is logged with `applied_delta` 0 and before = after on every schedule field; the vocab row is not written.
2. **Where `call_id` idempotency lives.** f06's `handoffs` table is reused (its status is free text by design): row id `voice:<sessionId>:<callId>`, status `voice_add` / `voice_review`, the tool result as the outcome. A repeat returns the stored result. The review event's `handoff_id` is the voice session id.
3. **The hard-cap check needs s04's table.** s01 ships the broker without the cap refusal; s04 adds it with migration 0003 and its test. Done When is unchanged.
4. **OpenAI errors.** The 502 carries OpenAI's status only. The body is logged server-side, never returned, because OpenAI's auth errors quote a masked key.
5. **`get_vocab` bounds.** Default 10 due items, at most 50; `scope: "due" | "all"`, optional `tag`.

## Status

### Recently Completed

- 2026-09-18: s03 Voice screen built (Voice tab, WebRTC connect, event reducer, tool relay, hide/leave ends the session); 13 client tests, `pnpm check` green at 430. Not yet run against OpenAI.
- 2026-09-18: s01 broker and s02 tool routes built; 21 Worker tests, `pnpm check` green at 417.
- 2026-09-18: stress-tested (five resolutions above) and opened.
- 2026-09-18: drafted from PRD FR-G/FR-B5, the mp02 journal and the TODO carry-forwards.

### Next Steps

- s03 desktop run: `pnpm dev`, Voice tab, a short session with an add and a duplicate add. Needs `OPENAI_API_KEY` in `.dev.vars` (sponsor).
- s04 spend: migration 0003 `voice_sessions`, usage report, Settings display and caps.

### Open Questions

- None open. The four draft questions were settled by the sponsor on 2026-09-18 (see Decisions).

## Decisions

- 2026-09-18: Sponsor accepted all four draft recommendations. (1) The browser relays tool calls to cookie-authenticated `/api/voice/tools/*` routes over the FR-F domain logic; FR-B3's bearer applies to external Coach clients only (cross-cutting: DECISIONS 260918h). (2) Bearer `/coach/*` routes and FR-F5 OpenAPI move to v1 with the Custom GPT; FR-F1/F3 logic stays v0 (260918h). (3) Caps: soft $0.50/day warns, hard $1.00/day; the client ends a live session at the hard cap and the broker refuses new sessions; both editable in Settings. Accepted risk: a misbehaving client can overshoot by one session. (4) Voice fixed to `marin`; no picker in v0.
