# Journal — mp05 Voice Vocab Bucket

**Current state:** opened and stress-tested 2026-10-02; s01–s07 planned, s01 `find_vocab` build
next. No migration. The s07 phone check needs f17's deploy (0007 remote) first.

## 2026-10-02 — stress-tested (261002b)

- Adversarial pass over the opened plan against the voice, intake, harvest and check code and
  f17. 17 findings, 15 resolved in the doc, 2 escalated.
- Sponsor calls:
  - **Hold:** Voice harvest words are skipped by the top-up and Intake, and left out of the tank
    count (DECISIONS 261002a). The plan as opened would have let FIFO top-up release unchecked
    voice words, or bury them behind a big harvest.
  - **Bucket UI:** every harvest's detail page gets a words list, Release all (with a confirm
    step) and harvest-scoped check/fill. Today it can do none of these, and the vault-wide fill
    rotation reaches new words last.
- Resolved in the doc: `find_vocab` bounds and ranking (exact Urdu key, then exact
  Roman/English, then newest; 5 per term plus a total); the bucket is created on the first new
  word, so a duplicates-only add leaves no empty harvest; the HOME_TZ day test; recreating a
  deleted source; the SQL trap where `NULL NOT IN (…)` drops unlinked rows; the f17 deploy
  dependency; Done When went from 4 rows to 7, each mapped to a slice.
- Slices: s01 `find_vocab`, s02 Voice harvest, s03 hold rule, s04 words + Release all, s05
  scoped fill, s06 ripple + local walk, s07 phone.
- No code changed; no tests run.
