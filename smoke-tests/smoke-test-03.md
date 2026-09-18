# Smoke test 03 — f03 reader on the phone

Sponsor-run checklist for f03 s08, the Done-When gate. Everything here is
already typechecked, unit-tested and built locally; what only the phone can
show is the Nastaliq rendering, speech, native selection and the installed
PWA. The docked action bar was already confirmed on the phone on 2026-09-17.

Tick as you go. **If a step fails, stop and note what you saw.** Adding a word
here writes a real row to production; step E removes the test row.

---

## Part A — deploy (Git Bash, repo root)

```bash
git pull
pnpm run deploy
```

- [ ] A1 — the deploy ends with a line naming `urdu.umber-amber.workers.dev`.
- [ ] A2 — on the phone, swipe the installed app away from recent apps and
      reopen it. It opens on the tab bar (Read · Vocab · Review · Settings).

## Part B — paste, render, persist (FR-C1, C2, C8)

- [ ] B1 — Read → paste a real passage of a few paragraphs (a WhatsApp
      message or a news paragraph) → **Read it**. It renders right-to-left in
      Nastaliq, one block per pasted paragraph, and lines do not clip each
      other.
- [ ] B2 — swipe the app away and reopen it: the same text is still there.

## Part C — speech (FR-C4, FR-I1)

- [ ] C1 — Settings → Voice lists an Urdu voice first; **ur-PK** is selected
      (or pick it) and the sample plays in Urdu.
- [ ] C2 — back on Read, tap single words: each is spoken in Urdu and starts
      feeling instant (the target is under 300 ms).
- [ ] C3 — tap a second word while the first is still speaking: the first
      stops and the second plays. No queue builds up.

## Part D — selection, Speak, Define (FR-C3, C5, C7)

- [ ] D1 — long-press a word and drag the handles across several words, even
      across two paragraphs. Native handles behave normally; the Speak · Add ·
      Define bar appears above the tab bar; Android's own bar does not cover it.
- [ ] D2 — **Speak** reads the whole selection.
- [ ] D3 — select a word you know is in the vault (one of the 36 imported)
      → **Define**: it shows your saved Roman/English and mastery.
- [ ] D4 — select a word that is not in the vault → **Define**: "Not in your
      vault yet" plus Rekhta, Wiktionary and Google Translate. Open each; each
      opens in a new tab with the word already filled in. (If one lands on a
      wrong page, note which: the URL format is a guess at that site.)

## Part E — Add to vocab (FR-C6)

- [ ] E1 — select a new word → **Add**. The Urdu field holds the word, the
      heading says WORD, and Notes holds the sentence it came from.
- [ ] E2 — fill English with `smoke test` and **Save**. You see "ADDED …
      Saved as a word".
- [ ] E3 — select the same word again → **Add** → **Save**: it says "Already
      in your vault" and shows the entry you just saved, rather than an error.
- [ ] E4 — select two or more words → **Add**: the heading says PHRASE.
      **Cancel** without saving.
- [ ] E5 — open `https://urdu.umber-amber.workers.dev/api/export` in the
      phone's browser: the word from E2 is there with `"source": "reading"`.
- [ ] E6 — clean up: the vocab screen cannot delete yet (f04), so tell the
      agent the word and it will give you a one-line command to remove it.

## Result

- [ ] All of A–E pass. Note anything that felt slow or awkward, even if it
      technically passed; that goes into f04/f05.

Notes:
