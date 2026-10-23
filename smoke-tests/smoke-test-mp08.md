# Smoke test mp08 — Check scope (Topic & level, Which words, vocab-json file)

Run on the installed Android PWA after the deploy. About 5 minutes, and step 3 doubles as the
re-sort of the 2026-10-22 conjugation imports you wanted anyway.

**Already covered by the agent:** Worker tests for the per-field checked mask (set, ORed, empty
fields never owed a check, the migration backfill), Topic & level as a check field (good slug
written, unknown slug dropped and noted rather than read as a removal, level, tags never
repeating the topic, no schedule change, suss includes it), and Which words (newest first, added
between on whole Vancouver days at the 23:00/00:00 edges, a topic narrowing any scope and the
counts, only unchecked on top, bad options refused). Client tests for the options, including
options stored before this change. `prompts/vocab-json.md` is generated and pinned by a test, and
the in-app new-vocab prompt now uses the same wording. `pnpm check` green at s03, 898 tests.
**Not covered:** no headless screenshots (local server access was blocked in these sessions), so
step 2 includes the layout check. Migration 0010 is already applied remotely.

## Before (Git Bash, repo root)

```bash
git pull
pnpm run deploy
```

Then, in the ChatGPT "Urdu Coach" Project:
- upload `prompts/vocab-json.md` to the Project's files (new), and `prompts/vocab-tags.md` if
  you haven't since mp07;
- paste everything below the line in `prompts/urdu-coach-project-instructions.md` into the
  Project's instructions. Its `vocab-json` section is now one line pointing to the file.

## On the phone

1. **Vocab tab → Copy check prompt.** The dialog shows **Which words** (Least recently checked)
   and **Topic** (All topics) between the fields and How many. Your remembered mode, fields and
   count are still there.
2. **Choose Added between.** Two date boxes appear side by side, both today. They fit the width
   and the date picker opens. Say if anything looks cramped.
3. **Re-sort the conjugations.** Set both dates to 2026-10-22, tick only **Topic & level**,
   correctness, How many 50, **Copy prompt**. The note reads "N of M items" with M about the
   number you imported that day. Paste into ChatGPT, copy its reply, **Paste check reply**,
   **Preview**: topic changes show as old → **Verb conjugation**. Apply. On the Vocab tab, filter
   Topic to Verb conjugation: they're listed with the chip. If there were more than 50, copy
   again with **Only items not yet checked** ticked: the next lot comes up.
4. **vocab-json.** In the Project, ask for a short vocab list, type `vocab-json`, copy the reply
   and **Paste new vocab** in a harvest. Every entry has all its fields and the paste goes in
   cleanly.

Done when steps 3 and 4 work in normal use. Whether ChatGPT follows the file as well as it did
the inline instructions is the thing to watch over the next few runs.
