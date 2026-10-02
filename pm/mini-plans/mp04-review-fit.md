# Mini-plan — Review card fits one screen

**Status**: 🟡 IN PROGRESS — planned, stress-tested and opened 2026-10-02; s01 build next
**Handle**: `mp04`
**Created**: 2026-10-02 · **Updated**: 2026-10-02

**Owner docs it serves**:
- `pm/PRD.md` FR-E2 (card and reveal), FR-E3 (grade buttons, Skip, Keep grade)
- `pm/features/f15-review-correction.md` (Back and Keep grade, whose controls move here)

> **One-line:** after Reveal, the whole review card (word, answer and grades) fits on the phone
> screen without scrolling: a thin app header, a tighter card, the grades in a two-row grid
> anchored at the bottom of the card, and Skip / Keep grade moved to the card's top row.

Sponsor request 2026-10-02, with a phone screenshot: after Reveal, the grade buttons are below
the fold (only Wrong and the top of Partially correct show), so every card needs a scroll.

---

## As-is

Phone viewport ≈ 415 × 830 CSS px, tab bar ≈ 71. Heights on a revealed card:

| Part | px |
|---|---|
| Shell top padding + `.brand` header (64 px icon, eyebrow, 2rem h1, 20/36 margins) | ~152 |
| Panel padding + `.review-top` (48 px buttons, and `button.back`'s 16 px bottom margin) | ~92 |
| Urdu headword (2rem Nastaliq, line-height 2.2) | ~86 |
| `.entry` fields (Roman, English, Notes, Example) | ~290 |
| `.grade-bar`: five stacked 48 px grades + Skip, 24 px top margin | ~356 |
| **Total** | **~976** of ~760 usable |

## Design

1. **Thin header, every tab once unlocked** (sponsor, 2026-10-02). Under `.shell--tabbed`: 32 px
   icon and "Urdu" (~1.25rem) on one line, no "YOUR URDU COMPANION" eyebrow, top padding
   `max(12px, env(safe-area-inset-top))`, ~12 px below. The unlock, loading and unavailable screens
   (`.shell` without `--tabbed`) keep the full header. The eyebrow stays in the markup and is
   hidden by CSS, so the locked screen is unchanged.
2. **Tighter review card.** `.review-card` overrides only: panel padding ~16 px; `.review-top`
   buttons `min-height: 40px`, `margin-bottom: 0`; `.entry` dt `margin-top: 6px`, dd line-height
   ~1.4. Labels stay above their values. The headword is unchanged.
3. **Grade grid, two rows** (sponsor). `.grade-bar` becomes a 6-column grid: row 1 **Wrong** and
   **Partly** (span 3 each), row 2 **Hesitant**, **Correct** and **Confident** (span 2 each). Gap
   8 px, buttons keep `min-height: 48px`, horizontal padding drops to 8 px, colours unchanged.
   Before reveal the bar holds only **Reveal**, full width in the grid's bottom row.
4. **Short grade labels** (sponsor). `GRADE_SHORT_LABELS` beside `GRADE_LABELS` in
   `shared/mastery.ts`: Wrong · Partly · Hesitant · Correct · Confident. The grid shows them; the
   accessible name is the visible text (no `aria-label`, so label-in-name holds). The "Recorded: …"
   hint and the Dash keep the full `GRADE_LABELS`.
5. **Skip and Keep grade move to the top row** (sponsor, option 1a). `.review-top` reads
   `3 OF 20 … Back · Skip · End`, with **Keep grade** in Skip's place on a graded card.
   **End session** is renamed **End**. All are text buttons (`button.back`), disabled while pending,
   as today.
6. **Bar anchored at the bottom, pinned as a backstop.** `.review-card` is a flex column with
   `min-height: calc(100dvh - <header> - <tab bar> - <shell paddings>)`; `.grade-bar` takes
   `margin-top: auto`, so Reveal and the grades sit in the same thumb spot. The bar is also
   `position: sticky; bottom: calc(var(--tabbar-h) + 8px)` with the panel background, so on an
   unusually long card the bar stays above the tab bar and the text scrolls beneath it. The tab
   bar's height becomes one `:root` custom property, `--tabbar-h`, used by `.tabs`,
   `.shell--tabbed` and the review card, so they cannot drift.

Planned heights: header ~60, card chrome ~56, headword ~86, entry ~230, grid ~124, so ~560 of
~760, leaving ~200 px for long notes or a status/error line.

## Stages

- **Stage 0 — plan** (this doc): done 2026-10-02.
- **Stage 1 — build** s01–s02 on `main`, after the concurrent agent's session ends (one Vitest
  run at a time; `app.css` is shared).
- **Stage 2 — phone** s03, sponsor.

## Slices

- **mp04-s01 Build.** `src/App.tsx` (nothing beyond a class hook if needed), `src/app.css`
  (thin header, `--tabbar-h`, `.review-card` flex/min-height, grid, sticky bar, tighter entry;
  update the f05 comment "worst to best, top to bottom" to describe the two rows),
  `src/screens/ReviewScreen.tsx` (Skip / Keep grade into `.review-top`, "End", short labels),
  `shared/mastery.ts` (`GRADE_SHORT_LABELS`) with a test in `shared/mastery.test.ts` that it has
  a label for each of `GRADES`. Visual check: a scratch HTML page that loads the real `app.css`
  with the revealed-card markup (long notes, a two-line example, the Recorded hint), screenshotted
  headless at 412 × 830 and 360 × 740 before and after reveal. Then `pnpm check` once.
- **mp04-s02 Docs.** PRD FR-E3: grades shown as Wrong, Partly, Hesitant, Correct, Confident in two
  rows (wrongs on top), Skip and Keep grade in the card's top row. `smoke-tests/smoke-test-mp04.md`.
  smoke-test-15 step 5 and smoke-test-mp03 still read correctly (they name **Skip** and **Back**).
- **mp04-s03 Phone (sponsor).** Rides any deploy (no migration). smoke-test-mp04: a revealed card
  with notes and an example shows every grade without scrolling; Reveal and the grades sit in the
  same spot; Skip, Back, Keep grade and End work from the top row; other tabs show the thin header;
  the unlock screen keeps the full one.

## Done When

- `pnpm check` green, including the `GRADE_SHORT_LABELS` test.
- Headless screenshots at 412 × 830 and 360 × 740 show the revealed long-notes card with all five
  grades above the tab bar and no overlaps.
- PRD FR-E3 updated.
- smoke-test-mp04 ticked on the phone.

---

## Open Questions

- (none)

---

## Decisions

- **2026-10-02** Skip and Keep grade go in the card's top row, End session becomes End (sponsor,
  1a). Rejected: Skip as a third top-row grade cell (mixes "don't grade" into the grades); a slim
  row of its own (~44 px).
- **2026-10-02** Short grade labels (sponsor). Full labels don't fit three across: "Hesitantly"
  needs ~88 px against ~74 px on a 360 px phone.
- **2026-10-02** Thin header on every unlocked tab, not only Review (sponsor).
- **2026-10-02** Bar anchored at the bottom with a sticky backstop rather than relying on
  compaction alone (agent): compaction covers typical cards, sticky guarantees long ones.

### Stress test (2026-10-02)

1. *Labels too wide for three columns.* → Resolved: short labels, 8 px horizontal padding.
2. *Label-in-name (WCAG 2.5.3) if the short label were paired with a full `aria-label`.* →
   Resolved: no `aria-label`; the visible short label is the name.
3. *Crowded top row on 360 px with Keep grade:* `3 OF 20 · Back · Keep grade · End session` ≈
   285 of 288 px. → Resolved: "End".
4. *Sticky offset coupled to the tab bar's height (incl. safe-area inset).* → Resolved: one
   `--tabbar-h` property used everywhere.
5. *Very long notes or examples.* → Resolved by the sticky bar; text scrolls beneath it.
6. *Recorded hint / error line adds ~40 px.* → Within the ~200 px slack.
7. *Thin header on other tabs.* → Wanted; no test or smoke test names the header text.
8. *`dvh` support.* → Android Chrome ≥ 108; the PWA targets installed Android Chrome.
9. *Mis-taps in a tighter grid.* → 48 px targets and 8 px gaps kept; a mis-grade is correctable
   via Back (f15).
10. *Nastaliq clipping if line-height were cut.* → Headword and example line-heights unchanged.
