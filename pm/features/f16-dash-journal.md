# f16 Dash — journal

## Current state

Opened and stress-tested 2026-10-01; no code yet. s01 (`shared/dash.ts` and tests) next.

## 261001a

The sponsor asked for ideas for a dashboard that motivates or helps progress, with nothing included for show. The agent proposed six elements under two rules (measure knowledge, not activity; each element changes the next action) and a cut list (streaks, XP, totals, CEFR, spend, tag and word/phrase splits). The sponsor set Known at an interval of 14 d or more, kept the calendar without a streak, and chose a sixth tab. That reversed the v0 "no statistics" exclusion: DECISIONS 261001a, PRD §2.2, FR-E4 and new FR-J1–J6, PLAN Phase 2/4 and roster, STATUS; committed `aebba3a` after a green `pnpm check` (about 2 min, slower than the usual 33 s, so AVG toggles may have re-synced).

Stress test: 14 findings resolved, 2 escalated. The sponsor declined a mock gate before s03 and placed Dash after Review, with Read still the default. The agent pinned every metric definition (recall filters, 30-event minimum, Hesitantly correct counts as recalled, review-ahead counts, New separate from overdue, trouble ≥ 2 lapses, Monday weeks, calendar steps), split the first slice into derivations (s01) and route (s02), and made Done When checkable, with two eyeballs owed (agent headless 360 px, sponsor phone smoke). The app has a light theme only, so no dark-mode check. PRD FR-J2 and FR-J4 now match.
