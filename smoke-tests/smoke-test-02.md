# Smoke test 02 — f02 Airtable import into production

Sponsor-run checklist for f02 Stage 4: the one step the agent cannot perform,
because it needs production credentials. Everything below it is already verified
locally — the import ran against local D1, created 36 rows, and on a second run
updated all 36 without duplicating a row or an event.

Tick as you go. **If a step fails, stop there** rather than pushing past it.
The import is re-runnable by design, so a stopped run is recoverable.

**Before you start:** turn AVG **Hardened Mode** and **CyberCapture** off. No
need to turn them back on — the console policy re-applies them by itself, about
twice a day. Do not add AVG exceptions — measured harmful (DECISIONS 260917b).
Never paste secret values into chat.

Run everything from the repo root in **Git Bash**.

---

## Part A — pre-flight (no secret needed)

The dry run never contacts an origin and never asks for the secret, so it is
safe to run as many times as you like.

```bash
git pull
ls data/airtable/
```

- [ ] A1 — `data/airtable/` contains `airtable_vocabulary_terms.csv` and
      `airtable_tags.csv`. (If you re-exported from Airtable since last time,
      drop the new files in here first.)

```bash
pnpm tsx scripts/airtable-import.ts --dry-run
```

- [ ] A2 — it prints `mapped 36 vocab rows, 3 tags, 0 mapping errors`.
- [ ] A3 — it prints `report is clean: no mapping errors, no mismatches, no
      rejected rows` and the shell reports exit 0:

      ```bash
      echo $?
      ```

**If A3 says the report is NOT clean**, stop. Open
`data/airtable/import-report.md` and bring it back to the agent — that is the
sponsor-review path, and it means Airtable and our ladder disagree about
something. Do not continue to Part C.

---

## Part B — deploy

`wrangler.jsonc` changed since the last deploy (preview URLs are now turned
off), so production needs a fresh deploy before the import.

`pnpm deploy` is a pnpm built-in — use `pnpm run deploy`.

```bash
pnpm run deploy
```

- [ ] B1 — the deploy succeeds and prints a version id.
- [ ] B2 — the upload lists the `dist/client` assets only — **no `.dev.vars`**
      in the uploaded file list.
- [ ] B3 — health check:

      ```bash
      curl -s https://urdu.umber-amber.workers.dev/api/health
      ```

      returns `{"ok":true}`.

- [ ] B4 — preview URLs are off: in the Cloudflare dashboard, the `urdu` Worker
      no longer lists a per-version preview URL. (Cosmetic; note it and carry on
      if the dashboard is unclear.)

---

## Part C — the import

Put the secret in the environment once. `read -s` echoes nothing as you paste —
that is the silent flag, not a hung terminal. Paste with **Shift+Insert** or
right-click, press Enter once.

```bash
read -s -p "secret: " URDU_SECRET && export URDU_SECRET && echo
echo ${#URDU_SECRET}
```

- [ ] C1 — the length printed is ≥ 24. (Checking the length, not the value,
      keeps the secret off the screen and out of scrollback.)

Check what is in the vault **before** you write to it:

```bash
pnpm wrangler d1 execute urdu --remote --command "select count(*) as vocab from vocab"
```

- [ ] C2 — this returns **0**. A fresh vault means Part D should report 36
      *created*. If it is not 0, that is fine and expected on a re-run — you
      will see *updated* instead of *created*, and no duplicates. Note the
      number you saw.

Now run the import:

```bash
pnpm tsx scripts/airtable-import.ts https://urdu.umber-amber.workers.dev
echo $?
```

- [ ] C3 — it prints `unlocked https://urdu.umber-amber.workers.dev; posting 36
      records`.
- [ ] C4 — it prints `created 36, updated 0, rejected 0` (on a first run into an
      empty vault), or `created 0, updated 36, rejected 0` on a re-run.
- [ ] C5 — it prints `report is clean: no mapping errors, no mismatches, no
      rejected rows` and `echo $?` shows **0**.

Then release the secret from the shell:

```bash
unset URDU_SECRET
```

- [ ] C6 — done.

**If C5 exits 1**, stop and bring `data/airtable/import-report.md` back to the
agent. Nothing is broken — the import is idempotent, so whatever was written can
be corrected and the script re-run over the top.

**If the unlock fails with a rate-limit message**, wait a minute and re-run. The
unlock limiter is 5 attempts per minute per IP.

---

## Part D — verify production (Done-When 4, 5)

Straight at the database:

```bash
pnpm wrangler d1 execute urdu --remote --command "select (select count(*) from vocab) vocab, (select count(distinct airtable_id) from vocab) distinct_ids, (select count(*) from review_events) events, (select count(*) from tags) tags"
```

- [ ] D1 — `vocab` = **36**.
- [ ] D2 — `distinct_ids` = **36** — as many distinct Airtable ids as rows, so
      nothing was double-imported.
- [ ] D3 — `events` = **0** — the import records no review events, because
      importing is not reviewing.
- [ ] D4 — `tags` = **3**.

```bash
pnpm wrangler d1 execute urdu --remote --command "select kind, count(*) from vocab group by kind"
```

- [ ] D5 — 10 `phrase` and 26 `word`. (Phrases are first-class items, not
      annotations — this confirms the kind inference ran.)

Then through the API, which is what Done-When 5 actually names. This unlocks
with the secret on **stdin**, never as an argument, so it stays out of your
shell history and out of the process list:

```bash
read -s -p "secret: " URDU_SECRET && export URDU_SECRET && echo

printf '{"secret":"%s"}' "$URDU_SECRET" | curl -s \
  -c data/urdu-cookies.txt \
  -H 'Content-Type: application/json' \
  --data-binary @- \
  https://urdu.umber-amber.workers.dev/api/unlock > /dev/null

curl -s -b data/urdu-cookies.txt \
  https://urdu.umber-amber.workers.dev/api/export > data/production-export.json

node -e "const e=require('./data/production-export.json');console.log('vocab',e.vocab.length,'events',e.review_events.length,'tags',e.tags.length)"
```

- [ ] D6 — it prints `vocab 36 events 0 tags 3`.

Clean up the local copies — the export is your whole vault in plaintext, and
the cookie file is a live session:

```bash
rm -f data/production-export.json data/urdu-cookies.txt
unset URDU_SECRET
```

- [ ] D7 — done. (`data/` is gitignored, so neither file was ever going to be
      committed, but they do not need to sit on disk either.)

---

## Part E — phone

The review screen is **f05 and not built yet** — this session shipped the
import, not the review UI. So the phone check here is deliberately small: it
confirms the vault your phone talks to is the one that just got the data.

On the Android phone, in the installed app:

- [ ] E1 — open the app. It should still be unlocked from smoke test 01; if
      not, unlock it.
- [ ] E2 — the status screen shows **total 36** where it showed 0 before.
- [ ] E3 — the **due** count is **8** if you run this on 2026-09-17. It only
      goes up as days pass, so a larger number on a later date is correct, not a
      fault. Anything *smaller* than 8 is worth reporting.
- [ ] E4 — the "Review date" line reads today's Vancouver date.

That is the whole phone check. Reading and reviewing that vocabulary is f03 and
f05.

---

## Result

Fill this in and hand it back.

- Date run:
- Part A (dry run):
- Part B (deploy): version id —
- Part C (import): created / updated / rejected —
- Part D (production counts):
- Part E (phone): total / due —
- Failures / notes:

All five parts green closes f02's Done-When 4 and 5, and with them PLAN
Phase 1's exit condition: D1 holds the Airtable vocabulary with mastery and
dates preserved. The agent records the outcome in the f02 journal and closes
the front at wrap.
