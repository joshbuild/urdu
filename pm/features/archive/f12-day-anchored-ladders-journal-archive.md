# Journal — f12 Day-Anchored Ladders

**Current state:** 🟢 shipped 2026-10-02; archived.

## 2026-10-02 — closed

- Migration 0005 went out with the f17 deploy (0005–0007 in one `migrations apply`). The sponsor
  has reviewed daily on the new ladders since and reports it working, so the rest of
  smoke-test-12 was waived and f12 closed. The before/after count queries (A3) were not recorded.

## 2026-09-27 — investigated, planned, stress-tested, built s01–s04

- Sponsor asked whether the 3 h bottom rung could come down to 1–2 h, and whether a new word
  should land nearer a day. Simulation: lowering the base alone adds about one rung and, with
  the old entry at step 0, makes a first Correct land at about 2.4 h (worse). Anchoring on an exact
  1-day rung and starting new words one rung below it gives Correct → 1 d, misses → 2–10 h, and
  3 reviews instead of 5 in the first fortnight for an always-Correct word on the default.
- Sponsor approved the spreads, asked for no decimals in the picker, and renamed the presets
  (Very dense / Dense / Balanced / Wide / Very wide) because Moderate and Balanced sounded alike.
- Stress test resolved five findings in the doc (see Recently Completed); nothing escalated.
- Built: entry rung stored at creation rather than a first-review branch in `scheduleReview`;
  migration 0005 maps the setting (+5) and moves untouched new rows; old ids renamed "… v1";
  "New" band = never reviewed; `formatInterval` whole units and "1 d" for just-under-a-day;
  mastery sort puts never-reviewed first. 28 worker tests were rebased from ladder 3 to 8.
  `pnpm check` green at 522.
- Tooling snag: Python text-mode writes on Windows produced line endings Biome rejected; fixed by
  normalizing the edited files to LF. Not seen in a browser; the phone run is smoke-test-12.
- Next: sponsor runs smoke-test-12 (backup, 0005 remote, deploy, phone). f11's smoke-test-11 C9
  reads "about 2 h" once f12 is deployed.
