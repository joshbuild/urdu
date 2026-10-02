# Journal — mp04 Review Card Fits One Screen

**Current state:** s01–s02 built and committed 2026-10-02 (`e983075`, `c67a7b3`); s03 phone
next — smoke-test-mp04, riding any deploy (no migration).

## 2026-10-02 — planned, stress-tested, opened, built s01–s02 (261002a)

- Sponsor sent a phone screenshot: after Reveal only Wrong showed above the tab bar. They asked
  for a thinner header and a two-row grade grid with the misses on top. Measured ~976 px of card
  against ~760 usable.
- Planned while another agent worked (no edits, no tests). Stress test settled ten points in the
  doc. Sponsor picked Skip and Keep grade in the top row with End session renamed End (1a), short
  grade labels, and the thin header on every unlocked tab.
- Built: `GRADE_SHORT_LABELS` in `shared/mastery.ts` with a test; `--tabbar-h`, `--shell-top`,
  `--shell-bottom` and `--brand-block` on `:root`; the thin `.shell--tabbed` header; a
  `.review-card` flex column with a viewport `min-height`; a six-column sticky `.grade-bar` at its
  foot; Skip / Keep grade / End in `.review-top`.
- Visual check: a scratch page using the real `app.css`, screenshotted headless in a fixed-size
  iframe. New headless Edge lays out wider than `--window-size` (it clipped the right edge), and
  so did `--headless=old`; the iframe gave an exact viewport. A normal revealed card fits at
  412 × 830 (~140 px spare) and 360 × 740; a long-notes card at 360 × 740 keeps the bar pinned
  with the text scrolling under it. Removing the `<dl>`'s default 16 px margin tightened the gap
  under the headword.
- `pnpm check` green (2 m 23 s). PRD FR-E3 rippled; `smoke-tests/smoke-test-mp04.md` written.
