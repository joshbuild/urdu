# Smoke test 12 — f12 day-anchored ladders in production

Sponsor-run checklist for f12, its Done-When gate. The new ladders, the entry rung and migration
0005 are tested and `pnpm check` is green, but 0005 has only run against a local D1, and **nothing
has been seen on the phone**.

**Order.** Migrate, then deploy straight away. Either order works, but a word added between the
two steps lands on the wrong ladder's rung until its first review.

Tick as you go. **If a step fails, stop and note what you saw.**

---

## Part A — back up, migrate, deploy (Git Bash, repo root)

```bash
git pull
# 1. Backup: a full SQL dump of production D1, kept outside the repo.
pnpm wrangler d1 export urdu --remote --output "$HOME/urdu-before-0005.sql"
# 2. Before.
pnpm wrangler d1 execute urdu --remote --command "SELECT (SELECT count(*) FROM vocab) AS vocab, (SELECT count(*) FROM review_events) AS events, (SELECT count(*) FROM vocab WHERE last_reviewed_at IS NULL AND ladder_step = 0) AS untouched_new, (SELECT value FROM settings WHERE key = 'active_ladder_id') AS active"
# 3. Migrate. It lists 0005_day_anchored_ladders.sql and asks to confirm.
pnpm wrangler d1 migrations apply urdu --remote
# 4. After.
pnpm wrangler d1 execute urdu --remote --command "SELECT (SELECT count(*) FROM vocab) AS vocab, (SELECT count(*) FROM review_events) AS events, (SELECT count(*) FROM vocab WHERE last_reviewed_at IS NULL AND ladder_step = 0) AS untouched_new, (SELECT value FROM settings WHERE key = 'active_ladder_id') AS active"
# 5. Deploy.
pnpm run deploy
```

- [ ] A1 — the backup file exists and is not empty (`ls -l "$HOME/urdu-before-0005.sql"`).
- [ ] A2 — the migration reports `0005_day_anchored_ladders.sql` applied, no errors.
- [ ] A3 — after: `vocab` and `events` equal the before counts, `untouched_new` is `0`, and
      `active` is the before value + 5 (Moderate `3` → Dense `8`).
- [ ] A4 — the deploy ends with a line naming `urdu.umber-amber.workers.dev`.
- [ ] A5 — the scripted smoke passes and leaves no rows. It now checks that a new item starts
      on the entry rung and that Correct brings it back in exactly one day.

```bash
read -rs -p "Secret: " URDU_SECRET; export URDU_SECRET; echo
pnpm tsx scripts/smoke.ts https://urdu.umber-amber.workers.dev
```

**If A2 fails or A3 looks wrong:** don't deploy, and don't repair it by hand. Stop and tell the
agent. The backup from step 1 holds the whole vault.

## Part B — Settings (phone)

Swipe the installed app away and reopen it, so the new build loads.

- [ ] B1 — **Settings › Review spacing** lists, in order: Very dense, Dense, Balanced, Wide,
      Very wide. The one ticked is the successor of what you had (Dense if you were on
      Moderate).
- [ ] B2 — no preset shows a "×" multiplier or any decimal. Dense reads
      `2 → 4 → 10 hours`, `1 → 2 → 6 → 13 days`, `5 → 11 → 26 weeks`, `14 months`,
      `3 → 7 → 10 years`.
- [ ] B3 — **Review** says "Spacing: Dense" (or your preset's new name).

## Part C — new words (phone)

Add two throwaway words from **Vocab › Add** (e.g. `ٹیسٹ ایک` and `ٹیسٹ دو`). Delete both at
the end.

- [ ] C1 — both show the pill **New** and "Due now".
- [ ] C2 — **Review**, Urdu → English: grade the first **Correct**. In Vocab its pill reads
      **Learning • 1 d** and it says "Due in 1 d".
- [ ] C3 — grade the second **Wrong**. Its pill reads **Learning • 2 h** (not "New") and it
      says "Due in 2 h".
- [ ] C4 — open either word's edit form: the rung list shows whole units only, and the ticked
      rung matches the pill.
- [ ] C5 — delete both test words.

## Part D — existing words (phone)

- [ ] D1 — a word you had already reviewed still shows the same due time as before the deploy
      (nothing was rescheduled).
- [ ] D2 — the next time you review such a word in a normal session, it moves onto the new
      ladder: its pill afterwards shows a whole-unit interval and no decimal anywhere in Vocab.

**Note for f11's smoke-test-11 C9:** once this is deployed, a reset item comes back about
**2 h** after its last review, not 3 h (the bottom rung of Dense). Read C9 that way.

## Closed 2026-10-02

The sponsor reported the flow working in daily use on the deployed build, so f12 closed on that report and the unticked steps were waived. Migration 0005 went out with the f17 deploy; the A3 before/after counts were not recorded.
