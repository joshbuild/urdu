# Journal — f07 coach-client

*Verbose per-front record. Hub: `pm/STATUS.md`; doc: `f07-coach-client.md`.*

**Current state:** 🟡 in progress; s01–s03 built and green, voice add verified on the phone 2026-09-21; s04 spend next.

## 2026-09-18 — drafted; sponsor questions settled

Drafted while f05/f06/f09 smoke tests wait on the sponsor. Sources: PRD FR-G/FR-B5/FR-F, the mp02 journal (Live Sessions API, data-channel tool loop without `delegation_id`, pricing, five-minute run problems) and two TODO carry-forwards (prompt tuning; oral counts only for unprompted recall), both folded into the doc and removed from TODO.

The draft surfaced a conflict: FR-B3 wanted Coach operations on a bearer token only, but mp02 showed voice tool calls land in the browser, which can't hold that token. The sponsor accepted all four recommendations: cookie-authenticated `/api/voice/tools/*` relay; bearer `/coach/*` routes and OpenAPI to v1 (so f06 closes after smoke-test-06); caps $0.50 soft / $1.00 hard, editable, client-ended at hard cap, broker refuses new sessions; voice fixed to `marin`. DECISIONS 260918h; PRD FR-B3/F5/G, AGENTS, PLAN and f06 rippled. Docs only; no code or tests run.

## 2026-09-18 — stress-tested, opened; s01 broker and s02 tools built

Stress test done inline against the code; five agent-resolved gaps recorded in the doc (Stress-test resolutions). The significant one: "delta 0" for helped recall would still have reset `due_at` through `scheduleReview`, contradicting Done When, so a supported event now logs before = after and leaves the vocab row unwritten (`review.ts` `logSupported`).

s01: `worker/coach/prompt.ts` (Coach prompt with all six mp02 tuning notes drafted in, backend instructions, three tool schemas, `marin`), `worker/coach/live.ts` (Live Sessions call; errors return OpenAI's status only and log the body), `POST /api/voice/session` (503 `voice_unconfigured` when the key is unset). The hard-cap refusal waits for s04's table. `OPENAI_API_KEY` added by hand to `worker-configuration.d.ts` in the shape `pnpm types` produces once `.dev.vars` carries it; `.dev.vars.example` and `wrangler.jsonc` comments updated.

s02: `POST /api/voice/tools/:name` for `get_vocab`, `add_to_vault`, `record_review` (`worker/domain/voice.ts`, `voice-input.ts`). Idempotency reuses `handoffs` (`voice:<session>:<call>`, statuses `voice_add`/`voice_review`; `storedOutcome`/`recordHandoff` now exported); a stale review is not stored so its retry can apply. FR-F3 "ambiguous" is unreachable because `urdu_key` is unique; the reachable case, an id that disagrees with the Urdu, is reported as unmatched. Duplicate adds return the existing English so the Coach can say what is there.

`test/voice.test.ts` 21 tests (stubbed `fetch` for OpenAI). `pnpm check` green, 417 tests. Nothing run against OpenAI yet.

Sponsor before s03: add `OPENAI_API_KEY` to `.dev.vars` (then `pnpm types` should leave the d.ts unchanged) and, for the phone, `pnpm wrangler secret put OPENAI_API_KEY`.

## 2026-09-18 — s03 Voice screen built

New Voice tab between Review and Settings. `src/voice/events.ts` is pure: `parseChannelEvent` maps the mp02-observed data-channel events (session.started, transcript deltas, usage, session.closed, error, and `response.event` wrapping a finished `function_call`) and `voiceReducer` merges transcript fragments per speaker, tracks each tool call pending → done/failed by `call_id`, and keeps billed seconds. `toolSummary` marks an add failed unless every item was created, so a duplicate reads as "failed: already in vault". `src/voice/connection.ts` owns the WebRTC peer, relays each call to `/api/voice/tools/*`, and returns every result, errors included (401, 4xx message, network), to the Coach with `response.item.create` + `response.create`. `connectVoice` returns its handle synchronously so leaving mid-connect cancels cleanly. Lifecycle: End and leaving the tab send `session.close` (mic muted at once, 20 s grace for final usage); hiding the app ends the session; `pagehide` tears down at once. Running cost is the mp02 estimate (seconds + 15 s create × $0.05/min); s04 records real usage and enforces caps.

13 client tests; `pnpm check` green at 430. Not run against OpenAI: `.dev.vars` has no `OPENAI_API_KEY` yet.

## 2026-09-21 — phone check: voice add works

The sponsor put `OPENAI_API_KEY` in as a Worker secret (interactively, never on disk) and deployed. Adding vocabulary by voice worked on the phone: the session connected and the add landed in the vault. That is the first live evidence for s01–s03 end to end. The rest of the s03 checks (duplicate add, tracked quiz, hide-to-end, spend) are smoke-test-07's job.

Decided in passing: the OpenAI key lives only in Cloudflare, not in `.dev.vars`, so no agent on this machine can read it; live voice checks run against the deployment instead of `pnpm dev`. Two sponsor captures went to the Inbox — Coach-side correcting/amending of existing items (with an opt-in interval reset), and kept transcripts with an expiry setting, re-openable and tappable to speak, which reverses an f07 exclusion.
