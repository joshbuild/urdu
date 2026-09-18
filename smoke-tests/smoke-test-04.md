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

- [x] A1 — the deploy ends with a line naming `urdu.umber-amber.workers.dev`.
- [x] A2 — swipe the installed app away and reopen it. **Vocab** shows a
      **New item** button, a search box, Tag and Sort pickers, a **Due only**
      box, a count, and a list of your items.

## Part B — list (FR-D1)

- [x] B1 — each row shows the Urdu in Nastaliq on the right, Roman · English
      below it, then the level name and "Due now" or "Next <date>".
- [x] B2 — type part of an English word you know is in the vault: the list
      narrows about a quarter-second after you stop typing. Try Roman, then
      Urdu. Clearing the box brings everything back.
- [x] B3 — **Due only**: the count matches the due number you would expect
      (the Airtable import had 8 due on 2026-09-17; it will have grown).
- [x] B4 — **Tag**: pick one of your 3 tags; only tagged items remain. Back to
      **All tags**.
- [x] B5 — **Sort** by Next review, then Mastery: the order changes sensibly.

## Part C — detail (FR-D2)

- [x] C1 — tap a row: the item opens with a large headword, **Speak**,
      Mastery (number · name), Review, all filled fields, Tags, Added.
- [x] C2 — **Speak** says the word in the voice picked in Settings.
- [x] C3 — **‹ All vocabulary** goes back to the list with your search and
      filters still set.

## Part D — edit (FR-D2)

- [x] D1 — on an item → **Edit**: every field is filled in, plus Kind and
      Mastery pickers. Change nothing and **Save**: it returns to the item
      unchanged.
- [x] D2 — note the item's Review line, then **Edit** → set Mastery one level
      higher → **Save**. The Mastery line changes and "Next" moves later
      (it stays "Due now" if the item has never been reviewed; that is correct).
      Then set it back to what it was.

## Part E — manual add (FR-D3)

- [x] E1 — list → **New item**: an empty Add sheet opens with the heading
      ADD TO VOCAB · WORD.
- [x] E2 — Urdu `ٹیسٹ`, English `smoke test 04` → **Save** → "ADDED" →
      **Back to vocabulary**. The count went up by one and the item is in the
      list.
  - [x] i’m fine with the word added. want to keep it. we just need all fields completed, but several others need that too. so add that task to TODO #agent-todo
    - Agent 2026-09-18: captured in TODO Inbox (complete missing fields; f08 backfill candidate). Keep `ٹیسٹ`, so skip G2's final delete.
- [x] E3 — **New item** → Urdu `ٹیسٹ` again → **Save**: "Already in your
      vault" with an **Open it** button, which opens the item.

## Part F — reader link (f03 carry-forward)

- [x] F1 — Read → paste `یہ ٹیسٹ ہے` → select `ٹیسٹ` → **Add** → **Save**:
      "Already in your vault" → **Open it**. The app switches to Vocab and
      shows that item.

## Part G — settings, delete, clean up

- [x] G1 — Settings → **Items per review session** shows 20. Change it to 15,
      swipe the app away, reopen: still 15. Set it back to 20 if you prefer.
- [ ] G2 — open the `smoke test 04` item → **Delete…** → **Keep it**: nothing
      happens. **Delete…** → **Delete**: back on the list, the item is gone and
      the count dropped by one.
  - [x] bug? hit delete -> delete, I get: “Could not delete. Check your connection and try again.” #agent-todo
    - Agent 2026-09-18: real bug. The client's DELETE sent no `Content-Type`; the Worker's CSRF guard answers 415 to any write that is not JSON. Fixed in `src/vocab/VocabDetail.tsx`. **Redeploy (`git pull && pnpm run deploy`), then do G3**, which re-tests delete end to end.
- [ ] G3 — search `smoke test` (the leftover from smoke-test-03 E2) → open it
      → **Delete…** → **Delete**. That clears TODO's E6 item.

## Result

- [ ] All of A–G pass.

Notes (anything slow, cramped, or confusing):
