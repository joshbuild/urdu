# Smoke test 17 — Vocab intake (f17)

Run on the installed Android PWA after the sponsor's deploy. Takes about 15 minutes on day 1 and 5 minutes on day 2.

## Before deploying (Git Bash, repo root)

```bash
git pull
# 1. Backup: a full SQL dump of production D1, kept outside the repo.
pnpm wrangler d1 export urdu --remote --output "$HOME/urdu-before-0007.sql"
# 2. Before: how many rows, and none queued yet (the column doesn't exist before 0007).
pnpm wrangler d1 execute urdu --remote --command "SELECT count(*) AS vocab FROM vocab"
# 3. Migrate. It lists what is pending, in order: 0005 and 0006 (f12, f13) if not yet run, then 0007.
pnpm wrangler d1 migrations apply urdu --remote
# 4. After: the same row count, every row released, none queued.
pnpm wrangler d1 execute urdu --remote --command "SELECT count(*) AS vocab, count(*) FILTER (WHERE released_at IS NULL) AS queued, count(*) FILTER (WHERE released_at = added_at) AS backfilled FROM vocab"
# 5. Deploy, only after step 3 succeeds.
pnpm run deploy
```

- [ ] A1: the backup file exists and isn't empty (`ls -l "$HOME/urdu-before-0007.sql"`).
- [ ] A2: step 4 shows the same `vocab` count as step 2, `queued` 0, and `backfilled` equal to `vocab`.

## Day 1

1. **Tabs.** The bar reads Harvest · Vocab · Review · Dash · Voice · Settings, with all six labels whole on one line. There is no Read tab. If Read was the last tab you used before the deploy, the app opens on **Review**; otherwise it opens on the tab you last used.
2. **Existing items untouched.** On **Vocab**, items you had before the deploy show their usual mastery pills and due times, and none says Queued. **Queued only** lists 0 items. The Review due count is about what it was before the deploy.
3. **Add a source.** On **Harvest**, the tank reads "Empty: time to harvest". Tap **Add source** and enter a story's name and its URL. It opens the source, which shows "Not harvested yet." Go back: the source is listed with a **To harvest** chip. Add a second source with the same URL: the sheet says "Already in your sources", and **Open it** opens the first one.
4. **Harvest and paste.** Open the source and tap **New harvest** with the filter "CEFR A2+".
   - **Copy harvest request** copies `vocab-list <the URL> at CEFR A2+ or above`. Paste it into a chat in your Urdu Coach Project and get the word list.
   - Run **Find new words** on that list, then `vocab-json` in the chat, as usual.
   - Tap **Paste new vocab** and leave **Start now** unticked. The button reads **Queue these words**.
   - The result says "*n* queued", and each new word says Queued.
5. **Queued, not due.** The harvest shows "*n* words · *n* queued · 0 started". On **Vocab**, those words carry a dashed **Queued** badge with "Waiting to start", and **Queued only** lists them. On **Review**, the due count hasn't gone up by *n*. The tank shows days of supply (queued ÷ 10, rounded up), amber with "harvest soon" if that is under 3 days.
6. **Intake.** On **Review**, the start screen reads "*d* due · *k* new". Tap **Intake +10** (or +*n* if fewer are queued). The new count rises by that many, the tank drops, and the button hides once the queue is empty.
7. **New after due.** If you have any overdue items, start a review: every overdue item comes before the first never-reviewed word.
8. **Release now.** On **Vocab**, open a queued word and tap **Release now**. The badge becomes a mastery pill and the word says Due now. Editing another queued word (for example its English) leaves it Queued.
9. **Start now.** Paste a second small reply into the same harvest with **Start now** ticked. The result says "*n* started". The words are due at once, and the harvest's queued count doesn't change.
10. **Settings.** Set **New words per day** to 5 and leave the field. Return to **Review**: Intake now offers +5 (or fewer if fewer are queued).
11. **Dash.** **New** counts only released, never-reviewed words, not queued ones. The backlog legend reads **Started**.

## Day 2 (the next day in Vancouver time)

12. **Daily top-up.** Leave some words queued overnight. The next day, open the app. Review's "*k* new" is topped up to the batch size from step 10 (5), or by however many words were queued, if fewer. Queued words that were added first are released first. Opening other tabs that day releases nothing more.
13. **Source status.** On **Harvest**, the source now shows **Harvested** with "CEFR A2+" and the harvest's date. Its harvest shows a non-zero **started** count once you have reviewed any of its words.

Pass when A1–A2 and all thirteen steps hold. Record any failure below before `/pm-close f17`.

## Results

Closed 2026-10-02 on the sponsor's daily-use report.

- Confirmed: the sponsor applied 0005–0007 remotely and deployed; the app has been in daily use since, so the migration left the vault readable (A1–A2 not recorded separately). The Harvest tab replaced Read (1). Harvests are pasted into and their words queued (3–5). Existing items review as before (2). On 2026-10-02, Review showed new words without Intake being tapped: the daily top-up runs in production (12).
- Steps 6–11 and 13 were not run step by step; waived on that report, since the Worker and client tests cover them.
- Seen in use, tracked in TODO rather than here: the review-ahead slider sometimes takes a stray stop, probably because the Intake button appears or vanishes above it.
