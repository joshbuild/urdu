# Smoke test 18 — Topic coverage (f18)

Run on the installed Android PWA after the deploy. About 10 minutes, most of it waiting for
ChatGPT.

**Already covered by the agent:** 811 unit and Worker tests (strict and lenient topic rules,
coverage counts, Next batch picks and paste, classify preview and apply, stale and repeat
guards); on `pnpm dev`, the grid's numbers matched `GET /api/coverage`; headless 360 px shots
of the grid, the Vocab filters and row chip, the word page, the edit form's pickers and a
revealed review card. What's left needs production, real ChatGPT replies and your phone.

## Before deploying (Git Bash, repo root)

```bash
git pull
# 1. Backup outside the repo.
pnpm wrangler d1 export urdu --remote --output "$HOME/urdu-before-0008.sql"
# 2. Migrate (0008 adds vocab.topic and vocab.cefr), then deploy only if it succeeds.
pnpm wrangler d1 migrations apply urdu --remote
pnpm run deploy
```

Then in ChatGPT, open the **Urdu Coach** Project:

- Replace its instructions with everything below the line in
  `prompts/urdu-coach-project-instructions.md`.
- Upload `prompts/vocab-tags.md` to the Project's files.

## On the phone

1. **Grid.** Open **Harvest**. Under COVERAGE the totals read A1 0/685, A2 0/955, B1 0/935,
   and the hint says all your words have no topic or level yet.
   1. yes
2. **Classify.** Tap **Copy classify prompt** and paste it into a ChatGPT chat. Copy its reply,
   tap **Paste classify reply** and paste. The preview lists the rows with the good ones ticked;
   glance at a few topics and levels for sense, then tap **Apply *n***. The unclassified count drops
   by the number applied and the grid's cells start to fill. Repeat until the count is under
   100 if you like; it isn't needed for this test.
   1. yes
3. **Next batch.** Tap **Next batch**. The note names one or two cells (for example
   "25 A1 pronouns + 25 A1 questions"). Paste the prompt into the Project chat, copy the reply,
   tap **Paste batch reply** and paste. The result says the words were queued, and any word you
   already had is reported as a duplicate, not added. In **Sources**, a **Topics** source has a
   new harvest named after the cells.
   1. yes
4. **Review chip.** Start a review. Before Reveal there is no topic; after Reveal a classified
   word shows a blue chip such as "Time & calendar · A2" under the example.
   1. i don’t see a blue chip with category/tag on the reveal view of the review screen
   2. actually, i forgot to deploy. all good.
5. **Vocab.** On **Vocab**, pick a topic in the **Topic** filter: the list narrows and each row
   shows the chip. Open a word, tap **Edit**, change its topic or level and save. If the word
   had old free tags, they show struck through above the pickers and are gone after the save.
   1. yes

- [x] Steps 1–5 as described.
- [ ] Anything off (a topic or level that looks wrong, a paste error) noted here.
