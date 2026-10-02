# Smoke test mp03 — review ahead by hours, on the phone

Sponsor-run checklist for mp03, its Done-When gate. The stop slider, the count and the Worker's
`ahead_seconds` are tested and `pnpm check` is green; **nothing has been seen on the phone**.

It needs no migration. It can ride the f12 deploy (smoke-test-12 Part A): any deploy at or after
the mp03 commit carries it. Tick as you go. **If a step fails, stop and note what you saw.**

---

## Part A — phone (installed PWA, reopened after the deploy)

- [ ] A1 — **Review** shows **Review ahead** with a slider at the far left and **Now** at the
      right of the label. The hint reads "Only items due now."
- [ ] A2 — drag the slider right. It snaps from stop to stop: 1 hour, 2 hours, 3 hours, 5, 8, 12,
      16, 20 hours, 1 day, 2, 3, 5 days, 1 week, 2 weeks, 1 month, 3 months, 6 months, 1 year.
      The label follows the thumb, and the slider looks like a slider, not a text box.
- [ ] A3 — at each stop past Now the hint reads "N more items fall due in the next …", and N
      never goes down as you move right.
- [ ] A4 — pick the first stop whose N is above 0 and note due + N. Tap **Start review**. The
      session holds that many cards (or the per-session limit, if smaller). Grade one, then
      **Skip** the rest to finish.
- [ ] A5 — back on the start screen the slider still sits where you left it, and the heading's
      due count plus N is one lower than before: the card you graded has moved past the span
      (if the span is a day or more, it may still fall inside; then the total is unchanged).
- [ ] A6 — with nothing due, the slider at Now leaves **Start review** disabled; moving it to a
      stop with N above 0 enables it.

## Result

- [ ] All ticked → the agent closes mp03 (`/pm-close mp03`).

## Closed 2026-10-02

The sponsor reported the flow working in daily use on the deployed build, so mp03 closed on that report and the unticked steps were waived. The stray-stop observation is tracked in TODO (2026-10-02).
