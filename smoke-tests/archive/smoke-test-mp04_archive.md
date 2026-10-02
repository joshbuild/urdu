# Smoke test mp04 — review card fits one screen, on the phone

Sponsor-run checklist for mp04, its Done-When gate. The layout was checked in headless
screenshots at 412 × 830 and 360 × 740 and `pnpm check` is green; **nothing has been seen on the
phone**.

It needs no migration and rides any deploy at or after the mp04 commit. Tick as you go. **If a
step fails, stop and note what you saw.**

---

## Part A — phone (installed PWA, reopened after the deploy)

- [ ] A1 — every tab shows the thin header: a small icon and "Urdu" on one line, with no "YOUR
      URDU COMPANION". (Lock the device in Settings to see the full header on the unlock screen,
      then unlock again.)
- [ ] A2 — start a review. The card fills the screen down to the tab bar. The top row reads
      "1 OF n" with **Skip** and **End** at the right; **Reveal** sits at the foot of the card.
- [ ] A3 — tap **Reveal** on a word with notes and an example. All five grades show without
      scrolling: **Wrong** and **Partly** on top, **Hesitant**, **Correct** and **Confident**
      below, and the bottom row sits where Reveal was.
- [ ] A4 — grade it. The next card comes up; tap **Back**: the top row now shows **Keep grade**
      in Skip's place. Tap **Keep grade**: it moves on without another grade.
- [ ] A5 — **Skip** a card, then **End**: the tally counts it as skipped.
- [ ] A6 — if any card is long enough to overflow, the grades stay pinned above the tab bar and
      the text scrolls beneath them. (If no card is that long, write "not seen" and tick it.)

## Result

- [ ] All ticked → the agent closes mp04 (`/pm-close mp04`).

## Closed 2026-10-02

The sponsor reported the flow working in daily use on the deployed build, so mp04 closed on that report and the unticked steps were waived. The sponsor confirmed all five grades show without scrolling after Reveal.
