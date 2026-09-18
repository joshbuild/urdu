# f09 srs-ladder — Journal

**Current state (2026-09-18):** built, `pnpm check` green (359 tests). Remote migration 0002 applied by the sponsor (after a first deploy showed "vault unavailable"; the deploy had run before the migration). Next: redeploy for the spacing layout, finish smoke-test-09 from A3, then `/pm-close`.

## Sessions

### 260918d — production migration, spacing layout

- Sponsor cross-checked the ladder intervals against their spreadsheet: every rung matches; only the last rung differs by design (10 y cap vs uncapped geometry). Accepted as a pass.
- Sponsor deployed before migrating, got "your vault is unavailable"; applying remote 0002 fixed it. Runbook order was right; step skipped.
- Settings spacing picker now shows `Name ×m` with rungs grouped one row per unit (hours <1 d, days <28 d, weeks <182 d, months <730 d, years), smaller muted font. `spacingSummary` replaced by `spacingMultiplier`/`spacingRows` (c6d8429). Not yet deployed or seen on the phone.

### 260918c — planned and built

- Planned from `research/urdu-vocabulary-srs-research-and-design.md` with the sponsor's exception: grade deltas stay −2/−1/0/+1/+2 and −1/0/0/+1/+2 (260918d). Scope, exclusions and AC mapping in `f09-srs-ladder.md`; implementation choices promoted as DECISIONS 260918e.
- s01 `shared/ladders.ts` (literal versions pinned to the generator, nearestStep, scheduleReview, correctStep, formatInterval); `shared/mastery.ts` now grades + deltas + bands; `shared/dates.ts` keeps legacy helpers (`legacyNextReviewOn`, `legacyInstant`).
- s02 migration 0002 (table rebuild, FK-safe order, `settings`), Worker domain/routes (`/api/settings`, status/export carry the active ladder, due by instant, `bad_step` 400). Worker tests rewritten by a fork (review, vocab, import, schema, new settings + migration tests on a second D1 binding `MIGRATION_DB`); no source bugs found.
- s03 client: MasteryPill by band, "Due in …" labels, rung select on the active ladder, Settings spacing picker (`src/settings/spacing.ts`), ReviewScreen wording.
- s04 scripts (import to legacy ladder, smoke), PRD/VISION/AGENTS/PLAN/TODO ripples, smoke-test-09.
- Checks: `pnpm check` green; migration applied to local dev D1: 36 vocab rows before and after, all on ladder 1.
- Gotchas: pm docs and AGENTS.md are CRLF, so string-match edits must normalise line endings; no python on this machine.
- f05's remaining smoke-test-05 parts now run on the f09 build.
