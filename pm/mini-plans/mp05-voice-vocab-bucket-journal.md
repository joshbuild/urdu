# Journal — mp05 Voice Vocab Bucket

**Current state:** s01 `find_vocab` built 2026-10-22 (Done When 1). s02 Voice harvest next. No
migration. 0007 is long since remote, so s07 needs only a deploy.

## 2026-10-22 — s01 `find_vocab` built

- Tool schema, `parseFindVocab`, `voiceFindVocab`, the route case, `FindVocabResult` and its
  label ("Looking up …") and summary on the Voice tab, per Design 1. A miss reads as done, not
  failed: not finding a word is an answer.
- Coach prompt: "is X in my vocab" / "my word for Y" → find; due and recent words → get.
  Backend prompt names both tools.
- The As-is note said the slice that touches the tool schema renames `get_vocab`'s `tag` to
  `topic`; done here. `tag` is now an unknown key (400).
- Tests: 6 in `test/voice.test.ts` (an item behind 50 newer ones found by Urdu with tashkeel,
  Roman and English; exact ranked first; queued flagged; no match; 5 of 7; nothing written;
  bounds), and the topic filter; 1 in `src/voice/events.test.ts`. `pnpm check` green at 856.
- Not live-checked: voice runs only against the deployment (260921a). It rides s07.


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
