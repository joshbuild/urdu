# TODO - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: Atomic, straightforward tasks too small for a work-front doc. Anything needing extended deliberation becomes an Open Question on the owning work-item doc (or a `pm/research/` memo when sponsor-blocking); anything needing a diagnosis arc or a vision becomes an issue/feature (see `pm-glossary.md` §1).

**Status tags** (exactly one per item; `#agent-triage` only inside `## Inbox`): `#agent-triage` (entry state, drained during triage), `#agent-research`, `#sponsor-respond`, `#sponsor-decide`, `#agent-implement`.

## Inbox
*Untriaged captures. Drain via `/pm-triage`.*

- (nil)


## Tasks
*Bullets, each tagged.*

- Let the Coach correct or amend an existing vocab item mid-conversation (Roman, English, notes, tags — the fields f06's revisions path already fills), with an option to reset the review interval, defaulting to **no reset**. Sponsor capture 2026-09-21 after the phone voice-add run. Today the Coach can only add and review; f07 excludes mid-session edits and points to the Vocab tab. Likely a fourth voice tool plus its FR-F contract row. **Triaged 2026-09-22 — decision needed:** this reverses the f07 exclusion "mid-session vocab edits … by voice", and PRD scope wins over a feature doc, so it is a v0-or-v1 call, not an agent one. Cheapest shape if v0: a fourth voice tool over f06's existing revisions logic, which already fills exactly these fields and already leaves the schedule untouched — so "no reset" is the current behaviour and the reset option is the only new rule. Recommendation: **v0, after f07 s05/s06 close**, as an f06 Stage-2 extension rather than a new front. #sponsor-decide

- Keep conversation transcripts: a setting for expiry (default 7 days), a way to reopen past sessions, and tapping a speech bubble to hear it read aloud. Sponsor capture 2026-09-21. **Reverses an f07 exclusion** ("saved transcripts … a non-goal and a privacy cost"), so it needs a scope decision and storage (which surface, D1 or local, and what the export does). Probably its own feature rather than an f07 slice. **Triaged 2026-09-22 — decision needed:** reverses a stated v0 non-goal, so it needs a PRD scope call before any doc exists. Three parts with different costs: (a) tap a bubble to hear it — needs no storage at all and could ride f07; (b) reopening past sessions — needs a store (D1 row per session vs device-local), an expiry job and an export answer; (c) the expiry setting itself. Recommendation: **take (a) into f07 now, defer (b)+(c) to v1** as their own feature, opened via `/pm-open` once the scope call lands. #sponsor-decide

- SRS follow-ups deferred by f09 (DECISIONS 260918e): per-direction statistics and automatic direction choice, including keeping one item from meeting both directions on the same day (report §4.2, §5.4, AC11); due-time success and workload by direction, interval band and ladder (§9, AC13; review events now carry every input); an "apply immediately" ladder remap with a preview (§6.2); same-session relearning after a first-rung miss (§11). Revisit once a few weeks of review history exist. #agent-research

- Before a work session, turn AVG **Hardened Mode** and **CyberCapture** off; turn them back on after. Measured 2026-09-17: off = 8 s for the worker test project and 32.7 s for `pnpm check`; on = runner timeouts and minutes. Do **not** add AVG exceptions — a repo folder exception measured 492 s and reinstated the failures, apparently by triggering a console policy re-sync (DECISIONS 260917b). #agent-implement
- Delete `spikes/gpt-live/` once f07 ships the brokered voice session; until then it is the working reference for the SDP route and data-channel tool handling. f01 repoints `wrangler.jsonc` away from it. (mp02 close 2026-09-14) #agent-implement
