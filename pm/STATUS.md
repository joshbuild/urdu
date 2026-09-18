# Status - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: The **thin hub** — a cross-front map of where things stand *right now*. Not a journal, not a sessions log. Verbose per-front narration lives in each front's `*-journal.md`; what-happened one-liners live in `SESSIONS.md`. Keep this file scannable.

*As of: 2026-09-18*

## Open Workfronts
*Work items actively in flight. One line each → its doc/journal. Closed fronts drop off (rosters keep the full list).*

- f05 `review` — 🟡 IN PROGRESS, built; smoke-test-05 part-way green with the sponsor → `features/f05-review.md`

## Next Session Pointers
*The 1–3 concrete next actions for a cold start.*

1. **Plan the SRS refactor** from `research/urdu-vocabulary-srs-research-and-design.md` (accepted, DECISIONS 260918c): a versioned geometric ladder (3 h–10 y, Moderate 2^1.25 default), deltas unchanged (DECISIONS 260918d), timestamp due times, richer review events, non-retroactive ladder switches. Open it as its own front (next free handle) and sequence it against f05's close and f08. Planning only, no build, until the sponsor approves the plan.
2. **f05 `review`**: the sponsor finishes smoke-test-05 (D, E, and F after `git pull && pnpm run deploy`), then `/pm-close`. It closes on the current rules.
3. **Inbox: 1 item** (fill in missing vault fields), so `/pm-triage` is owed; it may shape f08. Toolchain: AVG Hardened Mode + CyberCapture off; never add exceptions.
