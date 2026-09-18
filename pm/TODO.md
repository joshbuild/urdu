# TODO - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: Atomic, straightforward tasks too small for a work-front doc. Anything needing extended deliberation becomes an Open Question on the owning work-item doc (or a `pm/research/` memo when sponsor-blocking); anything needing a diagnosis arc or a vision becomes an issue/feature (see `pm-glossary.md` §1).

**Status tags** (exactly one per item; `#agent-triage` only inside `## Inbox`): `#agent-triage` (entry state, drained during triage), `#agent-research`, `#sponsor-respond`, `#sponsor-decide`, `#agent-implement`.

## Inbox
*Untriaged captures. Drain via `/pm-triage`.*

- Complete the missing fields on existing vault items (Roman, English, notes, examples): `ٹیسٹ` from smoke-test-04 E2 (kept on purpose, English only) and several imported rows. Candidate: an f08 `vocab-enrich` backfill mode over incomplete rows, or a manual pass via the f04 edit form; list the incomplete rows first. (smoke-test-04, 2026-09-18) #agent-triage

## Tasks
*Bullets, each tagged.*

- Sponsor: finish smoke-test-03 E6 — delete the `smoke test` row. Easiest now: smoke-test-04 G3 in the app (needs the delete fix deployed). Fallback: `pnpm wrangler d1 execute urdu --remote --command "DELETE FROM vocab WHERE english = 'smoke test' AND source = 'reading'"` (run the matching SELECT first; expect 1 row). #sponsor-respond
- Before a work session, turn AVG **Hardened Mode** and **CyberCapture** off; turn them back on after. Measured 2026-09-17: off = 8 s for the worker test project and 32.7 s for `pnpm check`; on = runner timeouts and minutes. Do **not** add AVG exceptions — a repo folder exception measured 492 s and reinstated the failures, apparently by triggering a console policy re-sync (DECISIONS 260917b). #agent-implement
- f07 Coach prompt tuning from mp02's five-minute run: English-explanation requests answered in Urdu, garbled non-correction, barging into learner hesitations, markdown in spoken text; test confirm-after-result with a failing add. Fold into f07's doc when it opens. #agent-research
- Delete `spikes/gpt-live/` once f07 ships the brokered voice session; until then it is the working reference for the SDP route and data-channel tool handling. f01 repoints `wrangler.jsonc` away from it. (mp02 close 2026-09-14) #agent-implement
