# Journal — f07 coach-client

*Verbose per-front record. Hub: `pm/STATUS.md`; doc: `f07-coach-client.md`.*

**Current state:** ⚪ draft, questions settled; next `/pm-stress-test` then `/pm-open`.

## 2026-09-18 — drafted; sponsor questions settled

Drafted while f05/f06/f09 smoke tests wait on the sponsor. Sources: PRD FR-G/FR-B5/FR-F, the mp02 journal (Live Sessions API, data-channel tool loop without `delegation_id`, pricing, five-minute run problems) and two TODO carry-forwards (prompt tuning; oral counts only for unprompted recall), both folded into the doc and removed from TODO.

The draft surfaced a conflict: FR-B3 wanted Coach operations on a bearer token only, but mp02 showed voice tool calls land in the browser, which can't hold that token. The sponsor accepted all four recommendations: cookie-authenticated `/api/voice/tools/*` relay; bearer `/coach/*` routes and OpenAPI to v1 (so f06 closes after smoke-test-06); caps $0.50 soft / $1.00 hard, editable, client-ended at hard cap, broker refuses new sessions; voice fixed to `marin`. DECISIONS 260918h; PRD FR-B3/F5/G, AGENTS, PLAN and f06 rippled. Docs only; no code or tests run.
