# Smoke test 05 — f05 review on the phone

Sponsor-run checklist for f05 s05, the Done-When gate. The session logic is
unit-tested and `pnpm check` is green, but **no one has seen the Review screen
yet**, in a browser or on the phone. Note anything that looks wrong or awkward,
even if the step technically passes.

**These are real reviews.** Each grade changes that item's mastery in
production, just as a normal review would, so grade honestly. Skip anything you
don't want to count. There's no test row to clean up afterwards.

Tick as you go. **If a step fails, stop and note what you saw.**

---

## Part A — deploy (Git Bash, repo root)

```bash
git pull
pnpm run deploy
```

- [x] A1 — the deploy ends with a line naming `urdu.umber-amber.workers.dev`.
- [x] A2 — swipe the installed app away and reopen it. **Review** shows the due
      count, a **Direction** choice (Urdu → English selected), **Start review**,
      and "Up to N items per session", where N is your Settings value.

## Part B — Urdu → English (FR-E1..E3)

- [x] B1 — **Start review**: a card shows "1 OF n", the Urdu in Nastaliq,
      **Speak**, **Reveal**, **Skip**, and **End session** at the top. n is the
      due count or your session limit, whichever is smaller.
- [x] B2 — **Speak** says the word before you reveal it.
- [x] B3 — **Reveal** shows Roman, English, and any notes or example. The five
      grade buttons replace Reveal, Wrong at the top and Confidently correct at
      the bottom. **Skip** stays below them.
- [x] B4 — before grading, note the word and its level. Grade it **Correct**.
      The next card appears with its answer hidden.
- [x] B5 — grade a second word **Wrong**, and skip a third.
- [x] B6 — **End session**: the tally shows Graded 2, Skipped 1.
      **Back to review**: the due count has dropped by 2 (the skipped word is
      still due).

## Part C — check the grades landed (Vocab tab)

- [x] C1 — open the **Correct** word: mastery is one level higher, "last" is
      today, and next review is today plus that level's interval (1/5/25/125…
      days).
- [x] C2 — the **Wrong** word is two levels lower (never below 0), with "last"
      today.
- [x] C3 — the skipped word is unchanged and still due.

## Part D — English → Urdu

- [x] D1 — **Review** → pick **English → Urdu** → **Start review**: the card
      shows the English in large type, with no Urdu and no **Speak** button.
- [x] D2 — **Reveal**: the Urdu appears, along with **Speak**, and **Speak**
      works. English isn't shown again in the answer.
  - [ ] okay, but button colors are off. 3 are green. the colours fixed after hitting ‘speak’ #agent-fixed
  - **Fixed 2026-09-21, recheck in Part F.** Android Chrome keeps `:hover` on the
    spot it last tapped, and `button:hover` (0,2,1) outranked `button.grade--wrong`
    (0,1,1), so the grade button that landed under the Reveal tap painted teal until
    the next tap — Speak — moved the hover away. Button fills are now a pair of
    custom properties and hover styling is gated behind `@media (hover: hover)`, so
    a touch device gets no hover fill at all. Same trap fixed on Delete, tabs and
    vocab rows.
- [x] D3 — grade one word, then **End session**.

## Part E — failures and edges

- [ ] E1 — start a session, **Reveal**, turn on **airplane mode**, and tap a
      grade: a red message says the grade couldn't be recorded, and you stay on
      the same card. Turn airplane mode off and tap the grade again: it
      advances.
- [ ] E2 — work through a whole session to the end (use Skip to go faster): the
      tally appears by itself after the last card.
- [ ] E3 — if nothing is due, **Start review** is greyed out. You can't
      force this case, so skip E3 if items are still due.

## Part F — add-ons from this run (redeploy first: `git pull && pnpm run deploy`)

> **Voice is expected to be broken after this deploy.** `main` now carries f07
> s04, whose migration 0003 has not been applied to production D1. Creating a
> voice session will fail on the missing `voice_sessions` table until the
> sponsor runs `pnpm wrangler d1 migrations apply urdu --remote`. Nothing in
> this checklist touches voice: `GET /api/settings` falls back to the default
> caps when the rows are absent, and Settings simply omits the spend line. Note
> it and carry on.

- [ ] F1 — **Review** shows a **Review ahead (days)** box set to 0. Set it to
      7: the hint says it also includes items due in the next 7 days, and
      **Start review** works even when nothing is due today. Items due soonest
      come first. Grade one, then check in Vocab that "last" is today.
- [ ] F2 — **Vocab**: each row shows a coloured pill such as "2 • Basic",
      warm colours for low levels and teal for high ones. The item detail shows
      the same pill next to Mastery.
- [ ] F3 — set **Sort** to Mastery, swipe the app away and reopen it: the Vocab
      list is still sorted by Mastery. Search and the other filters start empty.

- [ ] F5 — the D2 colour bug is gone: **Reveal**, then look before touching
      anything. Wrong is red, Partially correct orange, Hesitantly correct olive,
      and only the two Correct buttons are teal — no tap needed to settle them.
      Same after tapping **Delete** on a vocab item and after switching tabs.

- [ ] F4 — **English → Urdu** grading is gentler on misses. Note a word's
      level (say 3 • Firm), review it English → Urdu and grade it **Wrong**: it
      drops **one** level (to 2), not two. **Partially correct** leaves the
      level unchanged. Urdu → English grading is the same as before.

## Result

- [ ] All green. Notes:
