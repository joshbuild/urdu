# Smoke test mp07 — Suss cards, search, conjugation, calendar

Run on the installed Android PWA after the deploy. About 5 minutes, most of it inside a normal
review session.

**Already covered by the agent:** Worker tests for flagging, editing and clearing a suss card
(the first flag time kept, a blank comment stored as none, bad bodies and unknown ids refused), a
flag leaving `updated_at` and the schedule alone so a grade right after it still lands, the suss
list in flag order, the suss check batch (only flagged cards, mode both over every field), and
applying a reply: the ticked fix written, the batch's flags cleared, a card flagged after the
copy left flagged, an echoed `comment` tolerated. Also migration 0009 on a populated table,
search over notes and examples, the 51-topic list and its quotas, the nine calendar shades, and
the suss prompt's content. `pnpm check` green at 849. **Not covered:** no headless screenshots
this time (local server access was blocked in the session), so the steps below include the
layout checks.

## Before (Git Bash, repo root)

```bash
git pull
pnpm wrangler d1 migrations apply urdu --remote
pnpm run deploy
```

Then upload the regenerated `prompts/vocab-tags.md` to the ChatGPT Project (it now lists
`conjugation`).

## On the phone

1. **Start a review.** The card's top row shows **Back/Skip, Suss, End** on one line. On a
   graded card (Back, then Keep grade) the row may wrap; say if it looks wrong.
2. **Tap Suss** on a card that looks off. Type a comment, tap **Mark suss**. Suss turns rust; the
   card stays put. Reveal: "Suss: your comment" shows under the entry. Grade it as usual; the
   grade records with no error.
3. **Vocab tab.** The search box is at the top. Type part of a word that appears only in a note or
   example sentence: it's found, and the buttons and ChatGPT panel hide while you type.
4. **Clear the search, tap Suss cards.** Your flagged card is listed with its comment. Tap
   **Copy suss prompt**, paste into ChatGPT, copy its JSON reply, tap **Paste suss reply**,
   paste, **Preview**. Fixes show with ticks; cards it kept show under "Kept as they are" with a
   reason. Apply: the cards leave the Suss list.
5. **Dash.** The review calendar legend shows nine swatches ending in black at "400+".

Done when normal use says suss and search work. Step 1's layout, and whether the conjugation
quotas (A1 12, A2 15, B1 10) feel right, are your call.
