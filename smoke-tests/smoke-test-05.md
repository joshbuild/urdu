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

- [ ] A1 — the deploy ends with a line naming `urdu.umber-amber.workers.dev`.
- [ ] A2 — swipe the installed app away and reopen it. **Review** shows the due
      count, a **Direction** choice (Urdu → English selected), **Start review**,
      and "Up to N items per session", where N is your Settings value.

## Part B — Urdu → English (FR-E1..E3)

- [ ] B1 — **Start review**: a card shows "1 OF n", the Urdu in Nastaliq,
      **Speak**, **Reveal**, **Skip**, and **End session** at the top. n is the
      due count or your session limit, whichever is smaller.
- [ ] B2 — **Speak** says the word before you reveal it.
- [ ] B3 — **Reveal** shows Roman, English, and any notes or example. The five
      grade buttons replace Reveal, Wrong at the top and Confidently correct at
      the bottom. **Skip** stays below them.
- [ ] B4 — before grading, note the word and its level. Grade it **Correct**.
      The next card appears with its answer hidden.
- [ ] B5 — grade a second word **Wrong**, and skip a third.
- [ ] B6 — **End session**: the tally shows Graded 2, Skipped 1.
      **Back to review**: the due count has dropped by 2 (the skipped word is
      still due).

## Part C — check the grades landed (Vocab tab)

- [ ] C1 — open the **Correct** word: mastery is one level higher, "last" is
      today, and next review is today plus that level's interval (1/5/25/125…
      days).
- [ ] C2 — the **Wrong** word is two levels lower (never below 0), with "last"
      today.
- [ ] C3 — the skipped word is unchanged and still due.

## Part D — English → Urdu

- [ ] D1 — **Review** → pick **English → Urdu** → **Start review**: the card
      shows the English in large type, with no Urdu and no **Speak** button.
- [ ] D2 — **Reveal**: the Urdu appears, along with **Speak**, and **Speak**
      works. English isn't shown again in the answer.
- [ ] D3 — grade one word, then **End session**.

## Part E — failures and edges

- [ ] E1 — start a session, **Reveal**, turn on **airplane mode**, and tap a
      grade: a red message says the grade couldn't be recorded, and you stay on
      the same card. Turn airplane mode off and tap the grade again: it
      advances.
- [ ] E2 — work through a whole session to the end (use Skip to go faster): the
      tally appears by itself after the last card.
- [ ] E3 — if nothing is due, **Start review** is greyed out. You can't
      force this case, so skip E3 if items are still due.

## Result

- [ ] All green. Notes:
