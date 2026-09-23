# Journal — f07 coach-client

*Verbose per-front record. Hub: `pm/STATUS.md`; doc: `f07-coach-client.md`.*

**Current state:** 🟡 in progress; s01–s04 built and green, voice add verified on the phone 2026-09-21; s05 prompt tuning next, and migration 0003 still needs applying remotely.

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

## 2026-09-21 — s04 spend built

Migration 0003 adds `voice_sessions`: one row per brokered session, written by the broker itself so
a session that never reports back still costs its 15 s create charge. `day` is the `HOME_TZ`
calendar day the session started on, stored rather than derived — the daily total is an indexed
equality scan and a session running across local midnight stays on the day it began. Usage columns
take `max(stored, reported)`, because the data channel's figures are cumulative and a late or
retried report must never lower a session's recorded spend. Cost is *not* a column:
`shared/voice-cost.ts` prices the stored usage, so a corrected rate reprices history instead of
stranding old rows on an old price.

`shared/voice-cost.ts` is the single source of truth the Worker and the browser share (mp02's
pricing read: $0.05/min voice + 15 s at create; luna $0.20/$1.20 per 1M tokens). It replaced the
client-only `estimateCost`. Its test caught a real bug: `capOrDefault` used `Number(stored)`, and
`Number(null)` is 0 — a valid cap — so a missing settings row would have silently meant "refuse
every session" rather than falling back to the default.

Routes: `GET /api/voice/spend`, `POST /api/voice/usage` (404s an id this Worker never brokered, so
a stray client cannot invent spend), and the broker's 429 `cap_reached` — checked *before* the
OpenAI call, with a test asserting `fetch` was never reached. `PATCH /api/settings` now takes both
caps and is partial; it refuses a soft cap above the hard cap, which would otherwise warn only
after the session had already been refused. A zero cap is legal and stops voice entirely.

Client: the reducer tracks backend tokens (parsed from the wrapped `response.completed` usage) and
keeps `todayBeforeUsd` from the create response, so the running day total is monotone while live
and is rebased on the server's figure once usage is reported. The Voice tab shows this session and
today, warns past the soft cap and ends itself at the hard cap; Settings shows today's spend and
edits both caps. The connection reports final usage from its own counters at teardown rather than
from React state, so the report does not depend on a re-render happening first.

27 new tests (`test/voice-spend.test.ts` 16, `shared/voice-cost.test.ts` 11, plus client cases);
`pnpm check` green at 465. Three existing test files were widened for the new response fields.

**Not deployable on its own:** migration 0003 is local only. Deploying s04 before the sponsor
applies it remotely would make every session create fail on a missing table.

## 2026-09-23 — migration 0003 remote, s04 deployed

The sponsor applied migration 0003 remotely, then deployed (build `07d51e5`, which also carries
Settings › About). The deployed Worker now has `voice_sessions`, so s04 spend is live. Not yet
confirmed by a voice session on the phone.
