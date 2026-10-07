# Feature Plan — Topic Coverage

**Status**: 🟡 IN PROGRESS — *opened 2026-10-06; topics approved, stress-tested, s01–s03 built the same day. Next: finish s04 (parked in git stash), then s05.*
**Handle**: `f18`
**Created**: *2026-10-06* · **Updated**: *2026-10-06*

**Owner docs it serves**:
- `pm/PRD.md`: new FR-L (this feature); amends §2.2 (the curriculum non-goal and tag UI), FR-A6 (filters), FR-D1/D2 (list and edit), FR-E (review card), FR-F4/F6 (proposal fields), FR-F9 (classify mode), FR-K3 (Topics source), Appendix A
- `pm/VISION.md` §16 ("a full language curriculum") — reworded, not reversed
- `pm/DECISIONS.md` 261006a
- Input: `prompts/vocab-tags.md` (the ChatGPT coach's 45-category draft, 2026-10-06; replaced in s05)
- Code it extends: `shared/api.ts`, `worker/domain/vocab-input.ts`, `worker/domain/vocab.ts`, `worker/domain/handoff-input.ts`, `worker/domain/check.ts`, `worker/domain/harvest.ts`, `worker/domain/export.ts`, `src/handoff/prompts.ts`, `src/screens/HarvestScreen.tsx`, `src/screens/ReviewScreen.tsx`, `src/vocab/*`, `src/reader/DraftFields.tsx`
- Touches open front mp05 (`find_vocab` tag filter becomes a topic filter; voice adds arrive unclassified)

> **One-line:** Every word gets one topic from a fixed list of 50 and a CEFR level, and the app shows coverage against per-level targets (about 2,575 words to B1) and builds the ChatGPT request for the next batch, so adding vocab is two pastes instead of eight steps.

## Intent

### Vision

The sponsor wants a solid B1 conversational vocabulary and is willing to have ChatGPT generate
it in topic batches. Today the vault has no shape: tags are free text that ChatGPT invents
("objects", "verbs"), there is no notion of level, and nothing says what is missing. Adding words
takes eight steps: get candidates, find the new ones, copy the new-vocab prompt, paste the JSON,
copy a check prompt, paste it, copy the corrections, paste them.

After f18 the Harvest tab shows a grid of topics × levels with *have / target* in each cell. **Next
batch** picks the two emptiest cells at the lowest unfinished level and copies one prompt asking
ChatGPT for 25 words in each, fully filled, labelled with topic and level, and excluding the words
already in those topics. The sponsor pastes the reply back and the words join the queue. The
grid fills A1 across every topic before A2, so the vault grows from a broad core outwards, and the
sponsor can see how far there is to go.

These are **coverage targets, not a curriculum**: no lessons, no sequencing beyond choosing the
next batch, no grading of the learner against a level.

### Scope

- **Topics in code.** `shared/topics.ts` is the single source of truth: per topic a slug, label,
  section, a one-line scope (what belongs there, used in prompts) and A1/A2/B1 quotas
  (§Topics and quotas). Order is display order; the slug is the identity, so topics can be
  reordered freely. Adding a topic is a code change; renaming a slug needs a migration.
- **Schema (migration 0008).** `vocab.topic` (nullable, a known slug) and `vocab.cefr` (nullable,
  `A1`–`C2`), index on `(topic, cefr)`. `vocab.tags` stays a JSON array but now holds **0–2
  secondary topic slugs**, never the item's own topic. The two columns are independent; an item
  is **unclassified** while either is null. No other schema change: batch requests are
  `handoffs` rows (status has no CHECK), and the Topics source id is a `settings` row.
- **Validation, two strictnesses.** Direct writes (`POST`/`PATCH /api/vocab`) are strict: `topic`
  and every tag must be a known slug (trimmed, case-folded to lowercase), `cefr` one of `A1`–`C2`
  (upper-cased), at most 2 tags, none equal to the topic, else 400. Paste paths (every handoff
  paste, harvest and batch) are lenient, because a ChatGPT Project not yet
  re-pasted still emits free tags: an unknown tag or a tag equal to the topic is dropped, tags
  past the second are dropped, an unknown topic or level becomes null, and the result row notes
  what was dropped. A whole paste is never rejected for these fields. Legacy free tags on
  existing rows stay until the row's tags are next written. `MAX_TAGS` becomes 2. Outside both
  rules: the voice add tool takes only urdu/roman/english/kind (no topic, so nothing to relax),
  and the f02 Airtable import keeps its own free-tag rules (a finished one-off).
- **Coverage API.** `GET /api/coverage` returns counts per topic × level for every level present
  (A1–C2), per-topic totals, and the unclassified count. Counts use `topic` only, never secondary
  tags, and include queued items so a batch never re-asks for them. `GET /api/vocab` and
  `/api/vocab/due` gain `?topic=` (matches `topic` only) and `?cefr=`; the old `?tag=` stays.
- **Batch round trip (s02).** Selection is a pure function in `shared/coverage.ts`
  (`nextCells(counts, tapped?)`). **Next batch** chooses up to two cells: the lowest level with any
  cell below quota (cells with quota 0 never count), then the cells there with the lowest fill
  ratio, ties by topic order; one open cell left at that level means a one-cell batch. Tapping a
  cell below quota asks for that cell paired with the next pick **at the same level**; a full
  cell is not tappable. Each cell asks for min(25, remaining). All cells full: Next batch is
  disabled and says so.
  - **Issue:** `POST /api/batches` (body: optional tapped cell) picks the cells, records a
    `batch_issued` handoff under a Worker-minted id holding the cells, and returns the id, the
    cells and, per topic, the Urdu of every word whose `topic` or tags hold that slug. So a
    reload between copy and paste loses nothing, as with f11's check.
  - **Prompt:** the client builds it: the conventions, each topic's scope line and the
    boundaries, the level, the full field list including `topic`, `cefr` and `tags`, a
    self-review instruction (every field filled, JSON parses, topic and level honest), and the
    exclusion lists.
  - **Paste:** `POST /api/batches/handoffs` (FR-F4 body, whose `handoff_id` names the batch;
    `?start=1` as f17). A repeat of
    an applied id returns the stored result and creates nothing. An unknown id, or an id that
    is not a batch, is 404. Otherwise the route finds or creates the built-in **Topics** source
    (`settings.topics_source_id`; recreated if deleted), creates a harvest with filter text from
    the cells (e.g. "A1 food + A1 body"), imports into it queued as in f17, and marks the
    handoff applied. ChatGPT's own topic and level win over the requested ones; leniency as
    above. A duplicate of any existing word is reported, not created (`urdu_key`, as now), which
    is the backstop for words the exclusion list missed (unclassified ones). The 50-per-paste cap
    stays; two cells of 25 fit it exactly.
  - **Harvest pastes too:** the in-app Copy new-vocab prompt (source harvests) also asks for
    `topic`, `cefr` and `tags` from the slug list, so harvested words arrive classified.
- **Classify (s03).** On the Harvest tab's coverage panel, beside the unclassified count:
  **Copy classify prompt** and **Paste classify reply** (built there rather than as a fourth mode
  of the f13 Check options dialog; see Decisions). `POST /api/handoffs/classify-batch` (`{count?}`,
  1–100, default 100, `MAX_CLASSIFY_BATCH`) selects only unclassified items
  (`topic IS NULL OR cefr IS NULL`), oldest `added_at` first, and records a `classify_issued`
  handoff holding each item's id and the topic and level it had; none left issues nothing. Thin
  payload: the prompt lists `n|urdu|english` per line (n from 1) plus the slug list with scope
  lines and boundaries; the reply is `{handoff_id, rows:[[n, "urdu", "topic", "A2", ["tag"]]]}`,
  posted to `POST /api/handoffs/classify` (`?preview=1` plans, apply adds `accept`: the ticked n).
  Only the envelope is strict; rows are judged one by one.
  - **Preview** rejects per row: a row not shaped `[n, urdu, topic, level, tags?]`, unknown or
    repeated n, echoed Urdu not matching the item (`urdu_key`), unknown topic slug or level;
    unknown tags are dropped as on the lenient paths. Items the reply omits are reported as
    missing and stay unclassified (a rejected row counts as answered).
  - **Apply** (ticked rows) writes `topic`, `cefr` and replaces `tags`, sets `updated_at`, and
    writes a row only if its topic and level are still what they were at issue (else stale), in
    one D1 batch that also closes the handoff as `classified`, so a racing second apply writes
    nothing. The schedule and review events are untouched. A repeat returns the stored result.
  - Reclassifying a single item is the edit form's job; classify never re-serves a classified
    item.
- **UI (s04).** Harvest tab: the coverage grid by section, with have/target per cell and a
  section and grand total per level, the unclassified count linking to Copy classify prompt, and
  Next batch. Vocab tab: topic and level filters in place of the tag select; a topic chip on list
  rows and in detail. Edit and add forms: a topic picker, a level picker and up to 2 secondary
  topic pickers in place of free-text tags; legacy free tags show as removable chips and are
  dropped on save. Level picker offers A1–C2 and none. The grid shows A1, A2 and B1 cells and a
  B2+ count per topic with no target. Review card: the topic chip and level shown after
  reveal only.
- **Prompts and docs (s05).** A script writes `prompts/vocab-tags.md` from `shared/topics.ts`.
  The ChatGPT Project instructions keep the conventions and `vocab-list`; `vocab-json` gains
  `topic` and `cefr` and its tags rule points at the slug list. PRD, VISION §16 wording, AGENTS
  (topics as a shared source of truth) and mp05's tag filter are rippled. The voice add tool
  takes no topic or level; voice adds arrive unclassified and are picked up by classify.
- **Check step reframed.** The batch flow has no check round trip. The existing correctness and
  completeness checks stay on the Vocab tab as an occasional audit.

### Exclusions

- **No direct API generation.** The Worker does not call OpenAI to generate batches (sponsor,
  2026-10-06: avoid API cost, tolerate copy-paste). f08 stays on hold.
- **No routine check after each batch** (sponsor, 2026-10-06). Self-review in the batch prompt
  instead; the check tool remains for audits.
- **No B2+ quotas yet.** Add them when B1 is near complete; the `cefr` column already accepts them.
- **No learner level estimate** on the Dash (261001a's rejection stands: coverage is what the vault
  holds, not what the learner knows). Coverage lives on the Harvest tab.
- **No review-by-topic session.** The due route accepts `?topic=` but the review screen does not
  offer it (a later option).
- **No tag management UI**: the list is code. The old `tags` table is left in place, unused.
- **No lesson ordering, curriculum text or grammar explanations.**

### User Stories

- As the learner, I want to see which topics and levels are thin so that I know what to add next.
- As the learner, I want one tap to copy a request for the next batch, with my existing words
  excluded, so that I paste once each way and get no duplicates.
- As the learner, I want my existing words classified 100 at a time so that the grid is true from
  the start.
- As the learner, I want to see a word's topic after revealing it in review so that I have context
  without a hint.
- As the learner, I want to filter my vocab by topic and level.

### Non-Functional Requirements

- Topics and quotas have one home (`shared/topics.ts`); the Worker, the client and the prompt
  generator read it. Tests pin quota totals and slug uniqueness.
- Batch and classify prompts stay comfortably inside a ChatGPT reply: 50 full entries out, 100 thin
  rows out.
- The exclusion list in a batch prompt covers only the two requested topics (at most a few hundred
  short lines).
- AI only proposes: topic, level and tags are validated against the list and written by Urdu
  Core; nothing about them touches the schedule.
- Migration 0008 is additive (two nullable columns, one index); no table rebuild.

## Topics and quotas

Approved by the sponsor 2026-10-06. Quotas are per level, not cumulative. Totals: **A1 685 · A2 955 · B1 935
· all 2,575**. They are estimates: there is no CEFR word list for Urdu, so the B1 total follows the
usual 2,500–3,000 for European languages, and the last few hundred are left to reading and harvests.

| # | Slug | Label | Covers | A1 | A2 | B1 |
|---|---|---|---|---|---|---|
| | | **A. Grammar & function words** | | **134** | **162** | **154** |
| 1 | `pronouns` | Pronouns & reference | I/you/he, this/that, someone, possessives, apna, khud | 20 | 12 | 8 |
| 2 | `questions` | Question words | kya, kaun, kahan, kab, kyun, kaise, kitna | 14 | 4 | 2 |
| 3 | `postpositions` | Postpositions | mein, par, se, tak, ke liye, ka/ki/ke, ke paas, ke andar, ke baad | 15 | 20 | 15 |
| 4 | `connectors` | Connectors | aur, lekin, ya, kyunke, agar, to, halanke, warna | 10 | 15 | 15 |
| 5 | `modals` | Modals & auxiliaries | sakna, chahiye, parna, chahna, lagna, hona | 8 | 10 | 7 |
| 6 | `compound-verbs` | Compound verbs | vector verbs (kha lena, ho jana) and noun + karna/hona | 10 | 30 | 40 |
| 7 | `negation` | Negation & certainty | nahin, mat, kabhi nahin, zaroor, shayad, yaqeenan | 8 | 10 | 12 |
| 8 | `adverbs` | Frequency, degree & manner | hamesha, aksar, kabhi kabhi, bohat, kaafi, taqreeban | 12 | 18 | 20 |
| 9 | `quantifiers` | Comparison & scope | zyada, kam, kaafi, sab, har, sirf, bhi, wahi, mukhtalif | 12 | 13 | 10 |
| 10 | `discourse` | Discourse & interjections | achha, to, waise, asal mein, arey, wah, uff, haan/ji | 10 | 15 | 15 |
| 11 | `patterns` | Sentence patterns | mujhe … chahiye, mera khayal hai, kya aap … sakte hain | 15 | 15 | 10 |
| | | **B. Talking** | | **37** | **50** | **63** |
| 12 | `social` | Social phrases & address | greetings, thanks, apologies, invitations, aap/tum, ji, sahib, bhai, baji | 25 | 20 | 15 |
| 13 | `communication` | Speaking & language | bolna, poochna, samjhana, batana, maanna, behes karna | 12 | 20 | 18 |
| 14 | `idioms` | Idioms & proverbs | muhavare and common sayings | 0 | 10 | 30 |
| | | **C. People & self** | | **100** | **145** | **145** |
| 15 | `family` | Family & kinship | ammi, abbu, chacha, mamu, khala, phuppo, susral | 25 | 20 | 15 |
| 16 | `people` | People & roles | friends, neighbours, strangers, professions, ages | 15 | 25 | 20 |
| 17 | `body` | Body & appearance | body parts, looks | 20 | 15 | 15 |
| 18 | `health` | Health & medicine | illness, symptoms, doctor, medicine, recovery | 10 | 25 | 25 |
| 19 | `feelings` | Feelings | khush, naraz, dar, sharmindagi, pyar | 12 | 23 | 25 |
| 20 | `personality` | Personality & character | honest, stubborn, generous, clever, rude | 6 | 19 | 25 |
| 21 | `mind` | Mind & perception | think, remember, know, decide; see, hear, feel, notice | 12 | 18 | 20 |
| | | **D. Daily life** | | **163** | **210** | **167** |
| 22 | `actions` | Everyday actions | lena, dena, rakhna, kholna, intezaar karna, uthana | 40 | 35 | 25 |
| 23 | `motion` | Movement | jana, aana, baithna, khara hona, bhaagna, girna | 20 | 18 | 12 |
| 24 | `home` | Home & household | rooms, furniture, chores, household objects | 20 | 30 | 20 |
| 25 | `food` | Food & drink | ingredients, dishes, cooking, taste, eating out | 35 | 35 | 30 |
| 26 | `clothing` | Clothing & personal items | clothes, shoes, bags, jewellery, toiletries | 15 | 20 | 15 |
| 27 | `money` | Money & shopping | buying, prices, bargaining, salary, bank, rent | 15 | 30 | 25 |
| 28 | `travel` | Travel & transport | vehicles, stations, tickets, hotels, journeys | 10 | 25 | 25 |
| 29 | `tech` | Technology & media | phone, internet, TV, social media | 8 | 17 | 15 |
| | | **E. Time, space & quantity** | | **125** | **117** | **78** |
| 30 | `time` | Time & calendar | days, months, parts of day, duration, early/late, abhi, pehle, baad mein, abhi tak | 35 | 25 | 20 |
| 31 | `numbers` | Numbers | 1–100 (each irregular), sau, hazaar, lakh, crore, ordinals, sava/derh/dhai/paune | 50 | 45 | 15 |
| 32 | `measurement` | Measurement | weight, length, distance, volume, units | 5 | 12 | 13 |
| 33 | `places` | Places & getting around | city, village, buildings, countries, asking the way | 20 | 25 | 25 |
| 34 | `space` | Space & position | near/far, left/right, above/below, inside/outside | 15 | 10 | 5 |
| | | **F. Society & world** | | **78** | **189** | **223** |
| 35 | `work` | Work | jobs, office, meetings, colleagues | 10 | 25 | 25 |
| 36 | `school` | School & learning | studying, teaching, subjects, exams | 12 | 20 | 18 |
| 37 | `science` | Science | matter, energy, experiments, everyday science | 0 | 5 | 15 |
| 38 | `nature` | Nature & animals | land, water, plants, animals (no weather) | 15 | 30 | 25 |
| 39 | `weather` | Weather & seasons | rain, heat, clouds, seasons, storms | 8 | 12 | 10 |
| 40 | `society` | Society & customs | customs, weddings, hospitality, community, social issues | 5 | 20 | 25 |
| 41 | `government` | Government & law | government, elections, rights, police, courts | 0 | 12 | 28 |
| 42 | `religion` | Religion | prayer, belief, inshallah, mashallah, festivals of faith | 12 | 18 | 20 |
| 43 | `culture` | Culture & arts | music, books, films, art, festivals | 5 | 15 | 20 |
| 44 | `sports` | Sports & hobbies | games, exercise, hobbies, outdoors | 8 | 17 | 15 |
| 45 | `conflict` | Conflict & danger | fighting, accidents, safety, emergencies | 3 | 15 | 22 |
| | | **G. Describing & reasoning** | | **48** | **82** | **105** |
| 46 | `qualities` | Physical qualities | colours, shapes, size, texture, condition | 25 | 25 | 20 |
| 47 | `opinions` | Opinions & judgement | achha/bura, zaroori, ajeeb, saaf zahir | 15 | 20 | 25 |
| 48 | `change` | Change & processes | begin, end, become, improve, break | 5 | 15 | 20 |
| 49 | `cause` | Cause & purpose | wajah, nateeja, maqsad, is liye | 3 | 10 | 12 |
| 50 | `abstract` | Abstract ideas | freedom, truth, luck, responsibility (only when nothing above fits) | 0 | 12 | 28 |
| | | **Total (all 2,575)** | | **685** | **955** | **935** |

Boundaries the prompts state: frequency words go to `adverbs`, time words (already, still, yet,
soon) to `time`; size to `qualities`; money of any kind to `money`; weather never to `nature`;
spatial relations to `space`, places themselves to `places`; set social formulas to `social`,
fillers and interjections to `discourse`, verbs of speaking to `communication`.

## Planning

### Testing

- **shared:** `topics.test.ts` pins slug uniqueness and format, quota totals per level, and that
  every section is non-empty. Next-batch selection: lowest unfinished level first, lowest fill
  ratio, tie by order, a cell under 25 asks for the remainder, quota-0 cells skipped, one open
  cell gives a one-cell batch, a tapped cell pairs at its own level, a full or quota-0 tapped
  cell is refused, everything full returns none.
- **worker:** strict validation on `/api/vocab` (unknown slug, >2 tags, tag equal to topic, bad
  level → 400; case folded); lenient proposals (unknown tag, topic or level dropped and noted,
  the paste still applied); legacy tags kept until rewritten; `GET /api/coverage` counts
  including queued, B2+ and unclassified (either column null), topic only; `?topic=`/`?cefr=`
  filters; `POST /api/batches` (cells, exclusions by topic or tag, `batch_issued` row); batch
  paste (Topics source created once and recreated after delete, harvest filter text, queued,
  `?start=1`, repeat returns stored, unknown id 404, duplicate reported); classify issue (100
  cap, only unclassified, none left), preview (echo mismatch, unknown n, unknown slug or level,
  missing rows), apply (writes topic/cefr/tags and `updated_at`, stale rows skipped, schedule
  and events untouched, repeat returns stored); export carries the new columns.
- **client:** prompt builders (batch prompt carries each topic's scope line, the boundaries and
  the exclusions; new-vocab prompt asks for topic/cefr/tags; classify prompt is thin); the
  classify reply parser; the edit form drops legacy tags on save.
- **Headless** phone-width screenshots of the grid, the forms and the revealed review card, in
  both themes.
- **Sponsor smoke (short):** one real Next batch round trip and one 100-word classify round trip
  on the phone; the chip on a revealed card.

### Done When

- (s01–s04) The Testing rows above pass; `pnpm check` green after each slice.
- (s01) Migration 0008 applied locally, and remotely by the sponsor before the first deploy.
- (s02, sponsor) One real Next batch round trip on the phone: copy, ChatGPT, paste; the words
  sit queued in a Topics harvest with topic and level, and none duplicates an existing word.
- (s03, sponsor) One real 100-word classify round trip applied on the phone; the grid's
  unclassified count drops by the rows applied.
- (s04) Headless phone-width screenshots, both themes, of the grid, the edit form and a revealed
  review card; the agent checks the grid's numbers against `GET /api/coverage` on `pnpm dev`.
- (s04, sponsor) The topic chip and level on a revealed card on the phone.
- (s05) PRD (FR-L and the amended FRs), VISION §16, AGENTS, the ChatGPT Project instructions and a
  regenerated `prompts/vocab-tags.md` match the build (the generator test pins the file); mp05's
  doc names the topic filter.
- The unclassified count reaching zero is the sponsor's to do over time and does not gate close.

### Roadmap

1. **s01 Topics and schema** — `shared/topics.ts` + tests, migration 0008, strict and lenient
   validation (every paste path accepts topic/cefr), coverage route, list/due filters, export.
   No UI, except that the old free-text tag field now gets a 400 for unknown tags until s04.
2. **s02 Batch round trip** — `nextCells`, `POST /api/batches`, the batch paste route and Topics
   source, the batch prompt builder, topic/cefr/tags in the new-vocab prompt, Next batch and cell
   taps on a minimal grid.
3. **s03 Classify mode** — the dialog mode, the issue query, the thin prompt, the reply parser,
   `POST /api/handoffs/classify` preview and apply.
4. **s04 UI** — full grid, Vocab filters and chips, form pickers, review card chip.
5. **s05 Prompts and docs** — generated `prompts/vocab-tags.md`, Project instructions, PRD/VISION/
   AGENTS ripples, mp05 note.

s02 and s03 both depend on s01 and are independent of each other. s04 can start after s01. The
sponsor can begin classifying after s03 is deployed, before the grid is polished; classifying
before the first Next batch makes its exclusion lists complete (the `urdu_key` duplicate check
catches what they miss either way). mp05 (in flight, no migration) may build before or after
f18: if first, its `find_vocab` tag argument is renamed to topic in f18 s05; both edit
`worker/domain/vocab.ts`, so they don't build at the same time.

## Status

### Recently Completed

- 2026-10-06 — Planned and opened from a sponsor grill; the ChatGPT draft saved as
  `prompts/vocab-tags.md`; DECISIONS 261006a.
- 2026-10-06 — Sponsor approved §Topics and quotas (topics, boundaries, per-level numbers); a
  totals row added.
- 2026-10-06 — Stress-tested: 22 findings, all resolved by the agent; none escalated.
- 2026-10-06 — s01 topics and schema (`212de33`), s02 Next batch and the coverage grid
  (`c027615`), s03 classify (`2d2b3e4`); migration 0008 local only.
- 2026-10-06 — s04 UI: topic, level and two "Also about" pickers in the add and edit forms
  (legacy free tags shown struck through, dropped on save), topic and level filters on the Vocab
  tab, topic chips on list rows, detail and the revealed review card; grid numbers checked against
  `GET /api/coverage` on `pnpm dev`; headless 360 px shots (light theme only, the app has no dark).
- 2026-10-06 — s05 prompts and docs: `scripts/write-vocab-tags.ts` regenerates
  `prompts/vocab-tags.md` (a test pins it), uploaded to the ChatGPT Project as a file; `vocab-json`
  asks for `topic`, `cefr` and slug `tags`; PRD FR-L (and FR-A6/A7, C6, D1/D2, E2, F11, Appendix
  A), VISION §16, AGENTS, mp05 and CHANGELOG rippled; smoke-test-18 written.

### Next Steps

1. Sponsor: back up, `pnpm wrangler d1 migrations apply urdu --remote`, deploy, re-paste the
   Project instructions and upload `prompts/vocab-tags.md`, then run `smoke-test-18.md`.
2. Close f18 on the smoke (or daily-use report).

### Open Questions

- None.

## Decisions

- 2026-10-06 — Batches come through a ChatGPT paste round trip, not a Worker API call (sponsor:
  avoid API cost; fewer round trips preferred). Rejected: Worker-generated batches via OpenAI
  (f08 territory, stays on hold); both.
- 2026-10-06 — No check round trip after a batch; the batch prompt self-reviews and the check tool
  stays as an audit (sponsor, agent recommendation). Rejected: a check after every batch; removing
  the check tool.
- 2026-10-06 — One `topic` per word plus 0–2 secondary tags drawn from the same list (sponsor,
  agent recommendation). Quotas count `topic` only. Rejected: topic only, with tags retired; topic
  beside free-form tags.
- 2026-10-06 — Existing words are classified by a new thin check mode at 100 per round trip
  (sponsor, asking for a thin payload to allow 100). Rejected: leaving them unclassified;
  classifying by hand.
- 2026-10-06 — Quotas per level (A1/A2/B1) per topic, filled level-first across all topics; B2
  later (sponsor asked for per-level quotas; agent defaults for order and range).
- 2026-10-06 — Agent defaults: topics and quotas in code, not D1; queued words count toward
  coverage; ChatGPT's level label wins; unclassified words from Reader, voice and manual adds wait
  for a classify pass; the `tags` table stays, unused; topic chip after reveal only.
- 2026-10-06 — Build calls (agent, s02–s03): the batch paste route reads the batch id from the
  reply's `handoff_id` (`POST /api/batches/handoffs`), so nothing is held on the device; a
  paste claim older than 60 s may be taken over, reusing the harvest it made (review finding:
  a paste cut off by a closed app would otherwise block the reply for good). Classify has its own
  handoff statuses and lives on the coverage panel, not in the f13 dialog: the check apply keys
  its stamps and labels on the three check modes, the classify reply has another shape, and the
  unclassified count it serves is on the Harvest tab. Rejected: a fourth `CheckMode`.
- 2026-10-06 — Stress-test calls (agent):
  - Proposal paths are lenient about topic, level and tags (drop and note), direct writes strict.
    A ChatGPT Project not yet updated would otherwise fail whole pastes. Rejected: strict
    everywhere.
  - Batch requests are Worker-issued `batch_issued` handoffs with their own paste route, which
    creates the Topics harvest at paste time. A reload between copy and paste keeps the cells,
    and an abandoned copy leaves no empty harvest. Rejected: client-held cells; a harvest
    created at copy time.
  - Unclassified means topic or level null; classify serves only those, and apply guards against
    a value changed since issue.
  - Exclusion lists match topic or tag; coverage, quotas and the topic filter use `topic` only.
  - The in-app new-vocab prompt also asks for topic/cefr/tags; the voice tool does not.
  - B2+ words count per topic without a target; quota-0 cells are never picked.
