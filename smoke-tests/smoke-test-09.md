# Smoke test 09 — f09 review ladders in production

Sponsor-run checklist for f09, its Done-When gate. The ladder logic, the
migration and the new routes are tested and `pnpm check` is green, but the
migration has only run against a local D1, and **nothing has been seen on the
phone**.

**Order matters.** The new Worker reads columns that only exist after migration
0002, and the old Worker cannot read the migrated tables. Run Part A straight
through: back up, migrate, deploy. The app is broken for the minute between the
migration and the deploy, which is harmless for a single user.

Tick as you go. **If a step fails, stop and note what you saw.**

---

## Part A — back up, migrate, deploy (Git Bash, repo root)

```bash
git pull
# 1. Backup: a full SQL dump of production D1, kept outside the repo.
pnpm wrangler d1 export urdu --remote --output "$HOME/urdu-before-0002.sql"
# 2. Counts before.
pnpm wrangler d1 execute urdu --remote --command "SELECT (SELECT count(*) FROM vocab) AS vocab, (SELECT count(*) FROM review_events) AS events, (SELECT count(*) FROM vocab WHERE next_review_on IS NULL OR next_review_on <= date('now')) AS due_utc"
# 3. Migrate. It lists 0002_srs_ladder.sql and asks to confirm.
pnpm wrangler d1 migrations apply urdu --remote
# 4. Counts after.
pnpm wrangler d1 execute urdu --remote --command "SELECT (SELECT count(*) FROM vocab) AS vocab, (SELECT count(*) FROM review_events) AS events, (SELECT count(*) FROM vocab WHERE ladder_id = 1) AS on_legacy, (SELECT value FROM settings WHERE key = 'active_ladder_id') AS active"
# 5. Deploy.
pnpm run deploy
```

- [x] A1 — the backup file exists and is not empty (`ls -l "$HOME/urdu-before-0002.sql"`).
- [x] A2 — the migration reports `0002_srs_ladder.sql` applied, no errors.
- [x] A3 — after: `vocab` and `events` equal the before counts, `on_legacy`
      equals `vocab`, and `active` is `3`. **Only immediately after the migration.**
      Run on 2026-09-22, three days and six phone-added words later, it read 42 / 55
      / 35 / 3, which is right: a new item is created on the active ladder and a
      review remaps its item off the legacy one, so `on_legacy` only falls. `active`
      is the part that must still be `3`.
- [ ] A4 — the deploy ends with a line naming `urdu.umber-amber.workers.dev`.
- [ ] A5 — the scripted smoke passes, and ends by leaving no rows. Read the
      secret in rather than typing it on the line: bash expands `!` inside double
      quotes, and a secret containing one dies with `event not found`.

```bash
read -rs -p "Secret: " URDU_SECRET; export URDU_SECRET; echo
pnpm tsx scripts/smoke.ts https://urdu.umber-amber.workers.dev
```

**If A2 fails or A3 looks wrong:** don't deploy, and don't try to repair it by
hand. Stop and tell the agent. The backup from step 1 holds the whole vault.

## Part B — migrated items look as before (phone)

Swipe the installed app away and reopen it.

- [ ] B1 — **Review** shows the same due count as before the migration (give or
      take items that came due overnight), and "Spacing: Moderate".
- [ ] B2 — **Vocab**: pills read like "Firm • 4 wk" or "Learning • 1 d" for
      imported words, and "New" for never-reviewed ones. The band names match
      the levels the words had before.
- [ ] B3 — open a word that is not due: "Due in …" matches when it was due
      before (for example "Due in 3 wk"), then "· last <date>".
- [ ] B4 — sort by **Mastery**: New items first, then shortest intervals.

## Part C — the new ladder (phone)

- [ ] C1 — add a new word (Vocab › **New item**). Its pill says "New" and it is
      "Due now".
- [ ] C2 — review it Urdu → English and grade **Correct**. In Vocab its pill is
      "Learning • 7 h" and it is "Due in 7 h".
- [ ] C3 — review an imported, due word and grade **Correct**. It moves onto
      the Moderate ladder one rung above its old interval (a level-2 word, 5
      days, becomes about 10 days: "Due in 10 d").
- [ ] C4 — open a word › **Edit**: the Mastery list shows intervals from "3 h ·
      Learning" to "10 y · Permanent". Change nothing and **Save**: nothing
      changes. Pick a different interval and **Save**: the due time moves to
      match and no review is counted.
- [ ] C5 — delete the word from C1.

## Part D — changing the spacing (phone)

- [ ] D1 — **Settings › Review spacing** lists Dense, Moderate (selected),
      Balanced, Wide and Very wide, each with its multiplier and intervals.
- [ ] D2 — pick **Balanced**. Go to Vocab: every "Due in …" is unchanged.
- [ ] D3 — **Review** says "Spacing: Balanced". Grade one due word **Correct**;
      its new interval comes from the Balanced ladder.
- [ ] D4 — switch back to **Moderate** (or keep Balanced if you prefer it; the
      choice is yours to make, and nothing else depends on it).

---

**Result:** ☐ all green → tell the agent, who closes f09. ☐ something failed →
note the step and what you saw.
