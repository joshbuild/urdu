# TODO - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: Atomic, straightforward tasks too small for a work-front doc. Anything needing extended deliberation becomes an Open Question on the owning work-item doc (or a `pm/research/` memo when sponsor-blocking); anything needing a diagnosis arc or a vision becomes an issue/feature (see `pm-glossary.md` §1).

**Status tags** (exactly one per item; `#agent-triage` only inside `## Inbox`): `#agent-triage` (entry state, drained during triage), `#agent-research`, `#sponsor-respond`, `#sponsor-decide`, `#agent-implement`.

## Inbox
*Untriaged captures. Drain via `/pm-triage`.*


## Tasks
*Bullets, each tagged.*

- SRS follow-ups deferred by f09 (DECISIONS 260918e): per-direction statistics and automatic direction choice, including keeping one item from meeting both directions on the same day (report §4.2, §5.4, AC11); due-time success and workload by direction, interval band and ladder (§9, AC13; review events now carry every input); an "apply immediately" ladder remap with a preview (§6.2); same-session relearning after a first-rung miss (§11). Revisit once a few weeks of review history exist. #agent-research
- f06 Coach contract: an `oral` grade counts toward mastery only for an unprompted recall attempt; repeats after hearing the answer, heavily hinted answers and pronunciation imitation are logged but must not raise mastery (DECISIONS 260918b). Record it with `review_events.prompt_support` (f09: none | hint | answer_exposed | repetition). Fold into f06's doc when it opens. #agent-research

- Before a work session, turn AVG **Hardened Mode** and **CyberCapture** off; turn them back on after. Measured 2026-09-17: off = 8 s for the worker test project and 32.7 s for `pnpm check`; on = runner timeouts and minutes. Do **not** add AVG exceptions — a repo folder exception measured 492 s and reinstated the failures, apparently by triggering a console policy re-sync (DECISIONS 260917b). #agent-implement
- f07 Coach prompt tuning from mp02's five-minute run: English-explanation requests answered in Urdu, garbled non-correction, barging into learner hesitations, markdown in spoken text; test confirm-after-result with a failing add. Fold into f07's doc when it opens. #agent-research
- Delete `spikes/gpt-live/` once f07 ships the brokered voice session; until then it is the working reference for the SDP route and data-channel tool handling. f01 repoints `wrangler.jsonc` away from it. (mp02 close 2026-09-14) #agent-implement
