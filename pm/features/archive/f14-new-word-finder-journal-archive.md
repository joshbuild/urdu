# Journal — f14 New Word Finder

**Current state:** 🟢 shipped, closed 2026-10-02. s04 phone met by the sponsor's daily use of Find new words.

Newest first.

## 2026-10-02 — closed

The f14 build is in production, and the sponsor reported days of finding new words and adding them through the ChatGPT loop with no trouble. smoke-test-14's steps are waived on that report; the word-list parser and match route have tests. Badge flipped to shipped, tombstone written, smoke archived.

## 2026-09-28 — planned, stress-tested, opened; s01–s03 built

The sponsor asked whether a Hindi-script YouTube transcript could feed vocab. Nothing in the repo covered it; the answer was the existing `vocab-json` paste path, with the chat converting to Urdu script. The follow-up: ChatGPT writes full entries for every word before the import throws out duplicates. Three options were laid out (paste the vault into the chat; check a bare list in the app; add inflection matching). The sponsor chose the second, plus an ⓘ beside each button row as a reminder of the steps.

Stress test (9 findings, all agent-resolved): the copied text carries its own "only these words" override instead of changing what words after `vocab-json` mean; the route sits under `/api/vocab` and records nothing; extraction happens on the client so the Worker stays strict; keys are looked up in chunks of 90 (D1's 100-parameter limit); a cap of 500 words, with a warning above the paste's 50; the response carries the stored spelling; one ⓘ box open at a time; the label is "Find new words"; no migration.

Built:
- **s01** (`d58f956`): `MatchRequest`/`MatchResponse`/`MAX_MATCH_WORDS`, `parseMatch`, `matchVocab`, `POST /api/vocab/match`; 14 Worker tests (tashkeel match, order, repeats, a second chunk, read-only, 401, nine 400 cases).
- **s02** (`61bac87`): `src/handoff/wordList.ts` (`extractWords`, `chatText`) with 21 tests; `FindWordsSheet`; the three rows with `InfoToggle`/`InfoBox`; CSS; `vocab-list` and the only-these-words rule in the Project instructions.
- **s03**: PRD FR-F10, CHANGELOG, `smoke-tests/smoke-test-14.md`.

Seen in headless Edge (CDP script in the session scratchpad, unlocking with the `.dev.vars` secret without printing it) at 412 px: the rows, an open ⓘ box, the sheet and the result. The known-words heading needed a top margin. The run added کتاب and پانی to the **local** D1 if they weren't there. `pnpm check` green at 583.
