# TODO - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: Atomic, straightforward tasks too small for a work-front doc. Anything needing extended deliberation becomes an Open Question on the owning work-item doc (or a `pm/research/` memo when sponsor-blocking); anything needing a diagnosis arc or a vision becomes an issue/feature (see `pm-glossary.md` §1).

**Status tags** (exactly one per item; `#agent-triage` only inside `## Inbox`): `#agent-triage` (entry state, drained during triage), `#agent-research`, `#sponsor-respond`, `#sponsor-decide`, `#agent-implement`.

## Inbox
*Untriaged captures. Drain via `/pm-triage`.*

-

## Tasks
*Bullets, each tagged.*

- Decide whether to add AVG Antivirus exclusions for `C:/Users/jlock/dev/pers/urdu`, its `node_modules`, and the `workerd`/`biome` executables. AVG is the machine's active scanner (Defender disabled) and is the attributed cause of `EPERM` launch failures, `cloudflare-pool` runner timeouts, and minute-scale file operations in this repo (DECISIONS 260917b, journal 260917b). Measured 2026-09-17: turning Hardened Mode off removes the runner timeouts outright (3/5 → 5/5 files), and CyberCapture off roughly halves the run (88 s → 48 s); the remaining ≈ 7 s per file is File Shield, which only an exclusion removes. Interim workaround is to toggle those two off while developing, so this is a speed-and-friction decision now rather than a blocker. Sponsor-only: this is a machine security-policy change, and the sponsor has previously declined machine-level changes on this laptop. #sponsor-decide
- f07 Coach prompt tuning from mp02's five-minute run: English-explanation requests answered in Urdu, garbled non-correction, barging into learner hesitations, markdown in spoken text; test confirm-after-result with a failing add. Fold into f07's doc when it opens. #agent-research
- Delete `spikes/speech/` once f03 ships `speak()` (mp01 decision 2026-09-14). #agent-implement
- Delete `spikes/gpt-live/` once f07 ships the brokered voice session; until then it is the working reference for the SDP route and data-channel tool handling. f01 repoints `wrangler.jsonc` away from it. (mp02 close 2026-09-14) #agent-implement
