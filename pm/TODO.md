# TODO - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: Atomic, straightforward tasks too small for a work-front doc. Anything needing extended deliberation becomes an Open Question on the owning work-item doc (or a `pm/research/` memo when sponsor-blocking); anything needing a diagnosis arc or a vision becomes an issue/feature (see `pm-glossary.md` §1).

**Status tags** (exactly one per item; `#agent-triage` only inside `## Inbox`): `#agent-triage` (entry state, drained during triage), `#agent-research`, `#sponsor-respond`, `#sponsor-decide`, `#agent-implement`.

## Inbox
*Untriaged captures. Drain via `/pm-triage`.*

-

## Tasks
*Bullets, each tagged.*

- Set `"preview_urls": false` in `wrangler.jsonc`. The first deploy (2026-09-17) enabled them by default, so every deployed version is also reachable at its own `<version>-urdu.umber-amber.workers.dev` URL. Still secret-gated, so not a hole — just unasked-for surface on a single-user app. #agent-implement
- Extend `scripts/scan-bundle.mjs` to cover `dist/urdu` as well as `dist/client`. The build writes `dist/urdu/.dev.vars`; it is not uploaded (the 2026-09-17 deploy uploaded only the 7 `dist/client` assets), but nothing in `pnpm check` asserts that, so it holds by inspection rather than by test. #agent-implement
- Before a work session, turn AVG **Hardened Mode** and **CyberCapture** off; turn them back on after. Measured 2026-09-17: off = 8 s for the worker test project and 32.7 s for `pnpm check`; on = runner timeouts and minutes. Do **not** add AVG exceptions — a repo folder exception measured 492 s and reinstated the failures, apparently by triggering a console policy re-sync (DECISIONS 260917b). #agent-implement
- f07 Coach prompt tuning from mp02's five-minute run: English-explanation requests answered in Urdu, garbled non-correction, barging into learner hesitations, markdown in spoken text; test confirm-after-result with a failing add. Fold into f07's doc when it opens. #agent-research
- Delete `spikes/speech/` once f03 ships `speak()` (mp01 decision 2026-09-14). #agent-implement
- Delete `spikes/gpt-live/` once f07 ships the brokered voice session; until then it is the working reference for the SDP route and data-channel tool handling. f01 repoints `wrangler.jsonc` away from it. (mp02 close 2026-09-14) #agent-implement
