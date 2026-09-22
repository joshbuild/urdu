# Journal — f05 `review`

*Verbose per-session narration for f05. The feature doc (`f05-review.md`) is canonical for scope, plan and decisions; this file is the story of how it went. Newest session at the top.*

## 260918b — opened, s01–s05, sponsor add-ons, grading rethink

**Current state**: 🟡 in progress. Smoke-test-05 is part-way green on the phone (A–C ticked); D, E and F are open. The sponsor needs to redeploy for Part F.

**Opening.** The due and review routes already existed from f01, so the first build was client-only. `src/review/session.ts` is a pure reducer: start → reveal → submit → recorded/failed, skip, end, reset, and `promptSide` for the direction. The Reveal gate and the in-flight guard are both enforced there. `ReviewScreen` has the start panel, the card, the grade bar and the tally. A 404 on a grade counts as a skip, and a 401 hands off to App's lock. `pnpm check` was green at 307.

**Sponsor add-ons during the smoke test.**
- Review ahead: the due route gained `ahead=N` (0–365), which moves the cutoff; it has a Worker test.
- The Vocab sort is remembered per device.
- Mastery shows as a pill ("0 • New"), in a warm-to-cool colour ramp.
- The sort labels were shortened to Added / Review / Mastery.
- The PRD FR-D1/E1 text was amended to match.

**Grading.** The sponsor asked whether the two directions should keep separate mastery. We discussed it, and a ChatGPT survey agreed: keep one shared state and soften production misses. The production deltas −1/0/0/+1/+2 shipped for `en_ur`/`oral` in `shared/mastery.ts` (DECISIONS 260918b), and smoke-test-05 gained F4. Recognition was deliberately left at −2/−1/0/+1/+2, on the agent's advice.

**Then the rethink.** The sponsor and ChatGPT produced `research/urdu-vocabulary-srs-research-and-design.md` (accepted), which goes further:
- recognition deltas of −2/−1/0/0/+1, which reverses the part of 260918b the agent had argued for;
- a versioned geometric ladder from 3 hours to ~10 years, with five presets and Moderate 2^1.25 as the default;
- timestamp due times;
- richer review events;
- non-retroactive ladder switches with log-nearest remapping;
- direction statistics and selection;
- the Coach recall-only rule.

The sponsor then kept the shipped deltas instead (DECISIONS 260918d), so the refactor takes only the ladder, timestamp and event-model changes. This is a schema and domain refactor, not an f05 tweak. It was recorded as DECISIONS 260918c, and planning it is the next session's first job. Nothing was implemented from the report. The sponsor's `design/spaced-repetition-intervals.xlsx` was left uncommitted.

**Sticky hover on the phone (smoke-test-05 D2, fixed 2026-09-21).** The sponsor saw three teal
grade buttons instead of two on the English → Urdu reveal, and the colours corrected themselves
after tapping Speak. Not a React problem: `speak()` sets no state, so no re-render happens on that
tap — which is what pins it on CSS state rather than data. Android Chrome keeps `:hover` on the
place it last tapped, and `button:hover:not(:disabled)` (0,2,1) outranked `button.grade--wrong`
(0,1,1), so whichever grade button landed under the Reveal tap wore the generic teal hover fill
until the next tap moved the hover elsewhere. The same trap sat on Delete, the tab bar and vocab
rows, where a tapped control kept its hover fill and read as selected.

The fix is in the cascade, not in a `!important`. Every button now declares `--btn-bg` and
`--btn-bg-hover`, the base rule paints `var(--btn-bg)`, and hover paints `var(--btn-bg-hover)` —
so a variant's hover colour can no longer be outranked by the generic one. On top of that, hover
styling lives inside `@media (hover: hover)`, so a touch device never gets a hover fill at all.
`pnpm check` green at 465. Unverified on a device: smoke-test-05 F5 is the recheck, after the
Part F redeploy.
