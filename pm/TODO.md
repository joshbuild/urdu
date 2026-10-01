# TODO - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: Atomic, straightforward tasks too small for a work-front doc. Anything needing extended deliberation becomes an Open Question on the owning work-item doc (or a `pm/research/` memo when sponsor-blocking); anything needing a diagnosis arc or a vision becomes an issue/feature (see `pm-glossary.md` §1).

**Status tags** (exactly one per item; `#agent-triage` only inside `## Inbox`): `#agent-triage` (entry state, drained during triage), `#agent-research`, `#sponsor-respond`, `#sponsor-decide`, `#agent-implement`.

## Inbox
*Untriaged captures. Drain via `/pm-triage`.*

- (nil)


## Tasks
*Bullets, each tagged.*

- Review the parked Read tab on 2026-10-31: the vocab-intake feature hides it from the tab bar to make room for Harvest. The code is kept, and the sponsor reads with ChatGPT for now. Decide whether to restore it, fold parts into another screen (tap-to-speak, Add to vocab), or delete it. #sponsor-decide

- f07 spend check (Done When): after today's voice sessions, compare Settings › today's voice spend with the OpenAI dashboard (it showed $0.15 on 2026-09-23 for under 5 minutes). Within a cent or two passes; the app lower suggests lost seconds or a missed final usage report. Mind the dashboard's UTC day and lag. #sponsor-respond
- On the phone, next time fill-ins are saved: the "Fill-in prompt copied" note is replaced by a fresh count (f06 polish, `48786f6`). The CHATGPT section above the Vocab list was confirmed 2026-09-23. #sponsor-respond

- SRS follow-ups deferred by f09 (DECISIONS 260918e): per-direction statistics and automatic direction choice, including keeping one item from meeting both directions on the same day (report §4.2, §5.4, AC11); due-time success and workload by direction, interval band and ladder (§9, AC13; review events now carry every input); an "apply immediately" ladder remap with a preview (§6.2); same-session relearning after a first-rung miss (§11). Revisit once a few weeks of review history exist. #agent-research

- Delete `spikes/gpt-live/` once f07 ships the brokered voice session; until then it is the working reference for the SDP route and data-channel tool handling. f01 repoints `wrangler.jsonc` away from it. (mp02 close 2026-09-14) #agent-implement
