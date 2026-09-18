# Smoke test 04 — f04 vocab UI on the phone

Sponsor-run checklist for f04 s07, the Done-When gate. Everything here is
already typechecked, unit-tested and built locally, but **no one has looked at
these screens yet**, in a browser or on the phone. Layout problems are likely,
so note anything that looks wrong or awkward, even if the step technically
passes.

Tick as you go. **If a step fails, stop and note what you saw.** Steps E and F
write a test row to production; step G deletes it, along with the leftover
`smoke test` row from smoke-test-03.

---

## Part A — deploy (Git Bash, repo root)

```bash
git pull
pnpm run deploy
```

- [ ] A1 — the deploy ends with a line naming `urdu.umber-amber.workers.dev`.
- [ ] A2 — swipe the installed app away and reopen it. **Vocab** shows a
      **New item** button, a search box, Tag and Sort pickers, a **Due only**
      box, a count, and a list of your items.

## Part B — list (FR-D1)

- [ ] B1 — each row shows the Urdu in Nastaliq on the right, Roman · English
      below it, then the level name and "Due now" or "Next <date>".
- [ ] B2 — type part of an English word you know is in the vault: the list
      narrows about a quarter-second after you stop typing. Try Roman, then
      Urdu. Clearing the box brings everything back.
- [ ] B3 — **Due only**: the count matches the due number you would expect
      (the Airtable import had 8 due on 2026-09-17; it will have grown).
- [ ] B4 — **Tag**: pick one of your 3 tags; only tagged items remain. Back to
      **All tags**.
- [ ] B5 — **Sort** by Next review, then Mastery: the order changes sensibly.

## Part C — detail (FR-D2)

- [ ] C1 — tap a row: the item opens with a large headword, **Speak**,
      Mastery (number · name), Review, all filled fields, Tags, Added.
- [ ] C2 — **Speak** says the word in the voice picked in Settings.
- [ ] C3 — **‹ All vocabulary** goes back to the list with your search and
      filters still set.

## Part D — edit (FR-D2)

- [ ] D1 — on an item → **Edit**: every field is filled in, plus Kind and
      Mastery pickers. Change nothing and **Save**: it returns to the item
      unchanged.
- [ ] D2 — note the item's Review line, then **Edit** → set Mastery one level
      higher → **Save**. The Mastery line changes and "Next" moves later
      (it stays "Due now" if the item has never been reviewed; that is correct).
      Then set it back to what it was.

## Part E — manual add (FR-D3)

- [ ] E1 — list → **New item**: an empty Add sheet opens with the heading
      ADD TO VOCAB · WORD.
- [ ] E2 — Urdu `ٹیسٹ`, English `smoke test 04` → **Save** → "ADDED" →
      **Back to vocabulary**. The count went up by one and the item is in the
      list.
- [ ] E3 — **New item** → Urdu `ٹیسٹ` again → **Save**: "Already in your
      vault" with an **Open it** button, which opens the item.

## Part F — reader link (f03 carry-forward)

- [ ] F1 — Read → paste `یہ ٹیسٹ ہے` → select `ٹیسٹ` → **Add** → **Save**:
      "Already in your vault" → **Open it**. The app switches to Vocab and
      shows that item.

## Part G — settings, delete, clean up

- [ ] G1 — Settings → **Items per review session** shows 20. Change it to 15,
      swipe the app away, reopen: still 15. Set it back to 20 if you prefer.
- [ ] G2 — open the `smoke test 04` item → **Delete…** → **Keep it**: nothing
      happens. **Delete…** → **Delete**: back on the list, the item is gone and
      the count dropped by one.
- [ ] G3 — search `smoke test` (the leftover from smoke-test-03 E2) → open it
      → **Delete…** → **Delete**. That clears TODO's E6 item.

## Result

- [ ] All of A–G pass.

Notes (anything slow, cramped, or confusing):
