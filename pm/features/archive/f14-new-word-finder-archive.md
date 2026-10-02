# Feature Plan — New Word Finder

**Status**: 🟢 SHIPPED — *closed 2026-10-02. s01–s03 built 2026-09-28; s04 phone: deployed, and the sponsor's daily use of Find new words with the `vocab-list` / `vocab-json` loop (reported 2026-10-02) met smoke-test-14.*
**Handle**: `f14`
**Created**: *2026-09-28* · **Updated**: *2026-10-02*

**Owner docs it serves**:
- `pm/PRD.md` — FR-F4/F6 (the new-vocab paste it feeds), new FR-F10 (this feature), FR-A5 / Appendix B (`urdu_key` duplicate rule, reused unchanged)
- Code it extends: `worker/routes/api-vocab.ts`, `worker/domain/vocab.ts`, `shared/api.ts`, `src/handoff/HandoffPanel.tsx`, `src/handoff/chatgpt-project-instructions.md`, `src/app.css`

> **One-line:** paste a bare word list from ChatGPT into **Find new words**, and the app says which words are already in the vault and copies only the new ones back to the chat with `vocab-json`, so ChatGPT writes full entries only for words that will be created. Each CHATGPT button row gets an ⓘ that explains its round trip.

> **As shipped (2026-10-02).** **Find new words** in the CHATGPT section takes a pasted word list, keeps the Urdu-script text, and matches each word by `urdu_key` through the read-only `POST /api/vocab/match` (up to 500 words, exact matches only); it lists new and known words, with Open on each known one, and copies the new ones back under a `vocab-json — only these words` line. Each CHATGPT button row has an ⓘ with its steps, and the ChatGPT Project instructions carry a `vocab-list` command (now `prompts/urdu-coach-project-instructions.md`). Live truth: PRD FR-F10, FR-A5 / Appendix B; `worker/domain/vocab.ts` (`matchVocab`), `worker/domain/vocab-input.ts` (`parseMatch`), `worker/routes/api-vocab.ts`, `src/handoff/wordList.ts`, `src/handoff/HandoffPanel.tsx`, tests `src/handoff/wordList.test.ts` and `test/vocab-match.test.ts`. Evidence: `smoke-tests/archive/smoke-test-14_archive.md`. The execution record below is historical.

## Intent

### Vision

The sponsor extracts vocab from a story in a ChatGPT chat and adds it with `vocab-json` and
**Paste new vocab**. The paste already rejects duplicates, but only after ChatGPT has written
roman, English, notes, examples and tags for every word, including ones already in the vault.
Checking the bare list first means ChatGPT only writes entries for new words. The match is the
same deterministic `urdu_key` rule the import uses, so the list matches what the paste would say.
No LLM calls in the Worker, nothing recorded.

The CHATGPT section now has three round trips. The sponsor wants an ⓘ beside each button row as
a reminder of the steps.

### Scope

- **Route** `POST /api/vocab/match` (session cookie, read-only, writes nothing, no `handoffs`
  row). Body `{words: string[]}`, strict: unknown key → 400; `words` an array of 1–500 entries
  (`MAX_MATCH_WORDS = 500`); each entry a string that trims to 1–500 characters (the `urdu` field
  rule) and has a non-empty `urdu_key`, else 400 with the path `words[i]`. Response
  `{results: [{urdu, existing: {id, urdu} | null}]}`, one per entry in request order, `urdu` the
  trimmed entry. Repeated entries are answered each time (the client de-duplicates first).
  Matching is by `urdu_key` equality only (FR-A5), the same rule as `createVocab`'s duplicate
  check. The lookup runs in chunks of at most 90 keys per `IN (…)` query, below D1's 100-parameter
  limit.
- **Word-list extraction** (client, pure, `src/handoff/wordList.ts`, tested): turns pasted text
  into Urdu entries.
  - Split the text into lines. Split each line into pieces at `,` `،` `;` `؛` `|` `/` `:`, tab,
    and a dash with a space on each side (` - `, ` – `, ` — `). Code-fence lines (```) are dropped.
  - In each piece, drop every character that isn't Arabic-script (U+0600–06FF, U+0750–077F,
    U+FB50–FDFF, U+FE70–FEFF), whitespace or ZWNJ (U+200C, which some Urdu spellings need),
    then drop digits (`\p{Nd}`) and punctuation
    (`\p{P}`, including `۔` and `؟`). Collapse the whitespace and trim. So `1. کتاب (kitaab) –
    book` gives `کتاب`, and `کیا حال ہے؟` gives `کیا حال ہے`.
  - Keep a piece only when its `urduKey` is non-empty. Keep the first spelling of each key, in
    order.
  - Count the non-blank, non-fence lines that yield no entry, for a "skipped" note.
  - More than 500 entries: the sheet refuses before posting ("Paste at most 500 words at a time").
- **Find new words sheet** (client). The button opens a sheet with a textarea labelled "Word list
  from ChatGPT" and a **Find** button ("Checking…" while busy), plus Cancel. Nothing extracted →
  "No Urdu words found in that text." (no request). The result view shows:
  - A summary: "*N* new · *M* already in your vault", plus "; *K* lines with no Urdu skipped"
    when K > 0.
  - The new words (Urdu, RTL), and **Copy new words for ChatGPT**, which copies
    `vocab-json — only these words, none from earlier in the chat:` then one word per line. After
    copying, the note says: "Copied. Paste it into the ChatGPT chat, then paste its reply into
    Paste new vocab." If the clipboard is refused, a read-only textarea shows the text to copy.
    More than 50 new words: the note adds "ChatGPT's reply can hold at most 50 words; split the
    list if it refuses", and the copy still holds them all.
  - When there are no new words, "Every word is already in your vault." and no copy button.
  - The known words, each with its stored spelling and an **Open** link (as Paste new vocab
    does).
  - **Done**.
- **Info buttons.** The CHATGPT buttons become three rows, each ending in an ⓘ button:
  1. Copy new-vocab prompt | Paste new vocab | ⓘ
  2. Copy check prompt | Paste check reply | ⓘ
  3. Find new words (spans two columns) | ⓘ
  Tapping ⓘ shows that row's steps in a grey box below the row. Tapping it again closes the box,
  and opening another row's box closes the first. The button has `aria-expanded`, an
  `aria-label` "How <row> works", and a touch target of at least 40 px. The texts are in the
  build notes below; they're static and live in the component.
- **ChatGPT Project instructions** (`chatgpt-project-instructions.md`), additions only:
  - A `vocab-list` command: the Urdu words and phrases from the list most recently given (or the
    text named after the command), Urdu script only, one per line, in one plain code block, no
    numbering or glosses.
  - `vocab-json` gains one rule: when my words after the command say "only these words", use just
    those words and none from earlier in the chat. Its existing behaviour is otherwise unchanged.
  - The how-to line at the top names the Find new words step.

### Exclusions

- **Near-duplicate detection** (inflections such as کتابیں for کتاب, variant spellings,
  synonyms): the sponsor chose exact matching (option 2 of 3, 2026-09-28). The ⓘ text says so.
- **A compact "Copy my vocab" export for the chat** (option 1): not built.
- **Reader highlighting of known words**: a later feature if wanted.
- **Adding words from the sheet directly**: the chat still writes the entries, and Paste new
  vocab still saves them.
- **Tidying the CHATGPT section into menus**: deferred since f13; this feature only adds a row
  and the ⓘ buttons.

### User Stories

- As the learner, I ask the chat for `vocab-list` after a story, paste it into Find new words, and
  copy back only the 9 of 30 words I don't have, so `vocab-json` writes 9 entries.
- As the learner, I tap ⓘ beside the check row when I've forgotten which button comes first.

### Non-Functional Requirements

- **No spend:** ChatGPT subscription only; no Worker LLM calls.
- **Deterministic:** the match is `urdu_key` equality, the rule the import applies.
- **Read-only:** the route writes nothing; the vault and schedules are untouched.
- **Device:** the sheet and the ⓘ boxes fit a phone screen; long lists scroll within the sheet.

## Planning

### Testing

- **Worker tests (s01, `test/vocab-match.test.ts`):** a known word (including one that differs
  only by tashkeel) returns `existing` with the stored id and spelling; an unknown word returns
  null; order is kept; a repeated entry is answered twice; more than 90 words (a second chunk)
  match correctly; 400 on a non-object body, an unknown key, a missing, empty or 501-entry
  `words`, a non-string entry, an entry that is blank or longer than 500, and an entry of
  punctuation only (each with its `words[i]` path); 401 without a session; the vocab table is
  unchanged afterwards.
- **Client tests (s02, `src/handoff/wordList.test.ts`):** the extraction rules above: one per
  line; numbering, bullets, parentheses and Latin glosses stripped; each separator; a line with
  two Urdu pieces gives two entries; phrases kept whole with their final `؟`/`۔` removed; code
  fences dropped; tashkeel variants de-duplicated to the first spelling; the skipped-line count;
  empty input. Also the copy text: the `vocab-json` header line, then one word per line.
- **Phone smoke (smoke-test-14, written in s03, run in s04):** after the sponsor re-pastes the
  Project instructions, `vocab-list` in a story chat gives a bare list; Find new words splits it
  into new and known words correctly against the vault; the copied text makes the chat reply with
  JSON for only those words; Paste new vocab creates them all with no duplicates; each ⓘ opens
  and closes and reads correctly.

### Done When

- ✅ `pnpm check` green with the s01–s02 tests.
- ✅ smoke-test-14 green on the installed phone app: met by daily use 2026-10-02 (steps waived on
  the sponsor's report of finding and adding new words).
- ✅ at close 2026-10-02. Ripples: PRD FR-F10 (built); CHANGELOG `[Unreleased]`; AGENTS Project state; PLAN roster;
  journal.

### Roadmap

0. **s00 plan:** ✅ 2026-09-28, stress-tested the same day.
1. **s01 route:** ✅ 2026-09-28. `MatchRequest`/`MatchResponse` + `MAX_MATCH_WORDS` in `shared/api.ts`;
   `parseMatch` in `worker/domain/vocab-input.ts`; `matchVocab` in `worker/domain/vocab.ts`;
   `POST /api/vocab/match` in `api-vocab.ts`; Worker tests.
2. **s02 client:** ✅ 2026-09-28. `wordList.ts` + tests; `FindWordsSheet`; the three-row layout with ⓘ boxes;
   CSS; the Project instructions additions.
3. **s03 docs:** ✅ 2026-09-28. PRD FR-F10; CHANGELOG; write `smoke-tests/smoke-test-14.md`.
4. **s04 phone:** ✅ 2026-10-02 (daily use). The sponsor deploys (no migration), re-pastes the Project instructions and runs
   smoke-test-14; close.

In order: s02 posts to s01's route; s03 describes what s01–s02 built; s04 needs the deploy.

### Build notes — ⓘ texts

- **New vocab:** "In a ChatGPT chat in your Urdu Coach Project, get a word list, then type
  vocab-json. In any other chat, tap Copy new-vocab prompt, paste it and add your words. Copy the
  JSON reply, tap Paste new vocab and save. Words already in your vault are reported, not added.
  Up to 50 words per paste."
- **Check:** "Tap Copy check prompt and choose correctness, completeness or both, the fields and
  how many items. Paste the prompt into ChatGPT and copy its JSON reply. Tap Paste check reply,
  untick anything you disagree with, and apply. Only ticked fields change; review times stay
  unless you tick Reset."
- **Find new words:** "Before asking for full entries, type vocab-list in the chat (or ask for the
  words in Urdu script, one per line) and copy the list. Tap Find new words, paste it and tap
  Find. Copy the new words for ChatGPT and paste them into the chat: it replies with JSON for just
  those words, for Paste new vocab. Only exact matches count: plurals and other forms of a word
  you have still show as new."

## Status

### Recently Completed

- 2026-10-02: closed. Deployed; the sponsor reported finding and adding new words in daily use, which met smoke-test-14.
- 2026-09-28: s01–s03 built (`d58f956`, `61bac87`, docs commit); `pnpm check` green at 583. The rows and sheet were seen in headless Edge at phone width against `pnpm dev`.
- 2026-09-28: stress-tested: 9 findings resolved by the agent, none escalated (see Decisions).
- 2026-09-28: drafted from the sponsor's request (option 2 of three, chosen in conversation).

### Next Steps

- None; closed 2026-10-02.

### Open Questions

- None open.

## Decisions

- 2026-09-28 (sponsor, conversation): check a bare word list against the vault before asking
  ChatGPT for entries (option 2), exact `urdu_key` matching; ⓘ reminders on each button row.
- 2026-09-28 (agent, stress test):
  - **The copied text carries its own override** ("only these words, none from earlier in the
    chat") instead of changing what words after `vocab-json` mean. The command currently merges
    the latest list with added words, and the sponsor may rely on that; the instructions gain an
    additive rule for the override phrase.
  - **The route lives under `/api/vocab`** (a read-only vault query), not `/api/handoffs`: no
    handoff id, nothing recorded. POST because a 500-word list doesn't fit a URL. There's no
    `POST /api/vocab/:id`, so registration order doesn't matter.
  - **Extraction happens on the client**, so the Worker stays strict (every entry must have Urdu
    letters) and the sheet can report skipped lines. Lines are split at separators, because the
    chat may give `word – roman – meaning` or comma lists even when asked for bare lines.
  - **Chunks of 90 keys**, below D1's 100 bound parameters, instead of loading every key.
  - **Cap 500 words** per request: a story list is well under that, and it bounds the Worker's
    work. The 50-proposal cap on the paste is unchanged; the sheet warns above 50 new words.
  - **The response returns the stored spelling** of a known item, because a match by key can
    differ in tashkeel or letter form from the pasted word.
  - **One ⓘ box open at a time**, below its row, inline rather than in a sheet, so the steps sit
    beside the buttons they describe.
  - **Label "Find new words"**, so it isn't confused with Copy check prompt.
  - **No migration and no new `handoffs` status**; the deploy needs no remote step.
- 2026-09-28 (agent, build):
  - The Worker's rule is a non-empty `urdu_key`, the same as `createVocab`, so a Latin-only
    entry passes the route and simply matches nothing. The client strips Latin before it posts,
    so only punctuation-only entries are refused; the test uses one.
  - `vocab-list` asks for Urdu script even when the source is Roman Urdu or Devanagari, which
    also covers Hindi-script YouTube transcripts (the sponsor's question that led here).
  - The known-words heading gets a top margin (`.eyebrow.find-known`) after the first render
    showed it tight under the copy button.
