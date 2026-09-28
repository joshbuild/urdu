# Smoke test 14 — f14 new word finder (Find new words, ⓘ rows, vocab-list)

A checklist for the sponsor to run; it's the phone gate for f14 (s04). The match route, its
validation and the word-list parser have tests, and `pnpm check` is green. The ⓘ rows and the
sheet were rendered in headless Edge at phone width against `pnpm dev`: the example list split
into 2 new, 2 known and 1 skipped line. **No real ChatGPT `vocab-list` reply has been pasted
yet, and nothing has run on the phone.** No migration: deploy only.

Tick as you go. **If a step fails, stop and note what you saw.**

---

## Part A — deploy and update the ChatGPT Project (Git Bash, repo root)

```bash
git pull
pnpm run deploy
```

- [ ] A1 The deploy succeeds.
- [ ] A2 Open `src/handoff/chatgpt-project-instructions.md`, copy everything below the `---`
      line, and replace the "Urdu Coach" ChatGPT Project's instructions with it. It now has a
      `vocab-list` command, and `vocab-json` has an "only these words" rule.

## Part B — the button rows and ⓘ

- [ ] B1 On the phone, the Vocab tab's **CHATGPT** section shows three rows: Copy new-vocab
      prompt | Paste new vocab | ⓘ, then Copy check prompt | Paste check reply | ⓘ, then a wide
      **Find new words** | ⓘ. Nothing runs off the side.
- [ ] B2 Tap each ⓘ in turn. Its steps open in a grey box under that row, and the box that was
      open before closes. Tap the same ⓘ again and its box closes. The texts read correctly.

## Part C — round trip from a story

- [ ] C1 In a chat inside the Urdu Coach Project, get a vocab list from a story (or reuse one),
      then type `vocab-list`. The reply is one code block of Urdu words, one per line, with no
      numbering or meanings. Copy it.
- [ ] C2 Tap **Find new words**, paste, tap **Find**. The summary reads "N new · M already in
      your vault". Spot-check two words from each list against the Vocab search. Every known
      word has an **Open** link to the right item.
- [ ] C3 Tap **Copy new words for ChatGPT**. The note says to paste it into the chat. Paste
      into the same chat: the text starts `vocab-json — only these words`, and the reply is a
      JSON block holding **only** the new words (count them against N).
- [ ] C4 **Paste new vocab**, paste and save. Every word reads **Added**; none reads "Already
      in your vault".

## Part D — edges

- [ ] D1 Tap **Find new words** again and paste the same list: every word is now known, the
      sheet says "Every word is already in your vault." and there's no copy button.
- [ ] D2 Paste a line such as `1. کتاب (kitaab) – book` plus an English-only line: کتاب is
      found, and the summary says 1 line with no Urdu was skipped.
- [ ] D3 Paste English text only and tap **Find**: "No Urdu words found in that text." shows,
      and nothing else happens.

## Result

- [ ] All green → the agent ripples AGENTS Project state and PLAN, then `/pm-close f14`.

Notes:
