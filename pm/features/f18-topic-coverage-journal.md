# f18 topic-coverage — journal

**Current state (2026-10-07):** 🟡 deployed with 0008 applied remotely; smoke-test-18 steps 1, 2, 3 and 5 pass. Step 4 (topic chip on the revealed review card) not seen: the code path checks out, likely the session held no classified words. Next: sponsor reveals a word that shows a chip on Vocab; if it shows, close f18.

## 261007a — smoke-test-18 and a slowness scare

Sponsor ran smoke-test-18 on production: grid, classify, Next batch and Vocab filters pass; no blue chip after Reveal in review. Traced the chip path end to end (`dueVocab` `SELECT *` → `toItem` → `topicChip` at `src/screens/ReviewScreen.tsx:419`) with no break found; most likely the due words were unclassified (classify does 100 a round, due order favours the oldest words, batch words stay queued). Sponsor also reported 1–3 s grading since the deploy. `wrangler d1 insights` (3 d) showed no query above 20 ms (the ALTER) and the grade path's queries under 2 ms; Workers Observability logs for today showed every review POST at 99–204 ms wall, 1–4 ms CPU, CPU flat over the week; client QUIC RTT rose from 6–19 ms (Telus fibre) to up to 458 ms (Rogers mobile). Sponsor confirmed a downtown internet outage yesterday: network, not f18. Offered, not opened: advance the card on tap and save the grade in the background.

## 261006d — s05 prompts and docs

`scripts/vocab-tags.ts` builds `prompts/vocab-tags.md` from `shared/topics.ts` (slug, label, scope by section, plus the boundaries; no quotas, which ChatGPT doesn't need); `scripts/write-vocab-tags.ts` writes it and `scripts/vocab-tags.test.ts` pins the committed file. This replaced the ChatGPT coach's 45-category draft (kept in git at `151be27`). The file is 4.8 KB, so it goes into the Project as an uploaded file rather than inline: the instructions are 5.9 KB against ChatGPT's 8,000-character limit. `vocab-json` (both copies, still identical) now has nine fields: `topic` and `cefr` added, `tags` 0–2 slugs or `[]`, and the self-check names the slug list. Ripples: PRD FR-L1–L6, FR-F11 and the amended FR-A6/A7, C6, D1, D2, E2 and Appendix A; VISION §16 (coverage is no curriculum); AGENTS (topics as a shared source of truth, the generator command, Project state); mp05 (`get_vocab`'s `tag` to become `topic`); CHANGELOG. smoke-test-18 is five phone steps after the migration and Project update.

## 261006c — s04 UI

Popped the "f18 s04 wip" stash (`cleanTags`, `legacyTags`, draft topic/cefr/tags, tests green) and finished s04. `DraftFields` gained a topic picker grouped by section (`TopicOptions`, reused by the list filter), a level picker (A1–C2, None) and two "Also about" pickers; the edit form shows legacy free tags as struck-through chips, dropped on save. The Vocab list swaps the tag select for topic and level filters (`?topic=`/`?cefr=`); `/api/tags` stays on the Worker, now unused by the client. `topicChip` (tested) labels list rows, the detail page and the review card after reveal. The s02 grid already met the s04 spec, so it is unchanged.

Headless check: `pnpm dev` on 5288 (5199 was held by a stray dev server from 2026-10-01, left alone) driven by headless Edge over CDP at 360 px. Grid totals and section lines matched `GET /api/coverage`. The first shot showed the half-width topic picker clipping "Food & dri", so the topic and secondary pickers now take the full width. A 20-card session never reached the seeded new words (new pile after due), so the local due items were given a topic to shoot the revealed card. The app has a light theme only. `pnpm check` green at 811.

## 261006b — approve, stress-test, orchestrate s01–s03

The sponsor approved §Topics and quotas and asked for a totals row (685 / 955 / 935, 2,575; row sums and section subtotals agree). `/pm-stress-test`: 22 findings, all agent-resolved (two validation strictnesses, Worker-issued batch handoffs with paste-time harvests, unclassified = topic or level null, exclusions by topic or tag, B2+ counted untargeted), commit `3f338f4`.

`/pm-orchestrate` ran s01–s03. Baseline `pnpm check` 94 s.
- **s01** (`212de33`): `shared/topics.ts` generated from the doc table by a script, so the 50 scope lines and quotas match it exactly; migration 0008 (topic, cefr with a CHECK, index); strict `parseFields`, lenient `lenientClassification` for pastes with `dropped` notes in the result; `GET /api/coverage`; `?topic=`/`?cefr=`. Red recorded: 9 assertion fails (e.g. `expected 201 to be 400` for an unknown tag). The first green run still failed two tests on a real bug: `isError` in `api-vocab.ts` took any object for an error, so the new filter object made every list a 400; it now needs `message`. Ten existing tests used free tags and moved onto slugs. Review: no bugs; applied its single-query coverage count, `tags: null` handling and an AND-filter test; the Airtable import keeps its own free tags (spec now says so).
- **s02** (`c027615`): `nextCells` in `shared/coverage.ts` (red against a stub, 6 fails), `POST /api/batches` and `POST /api/batches/handoffs` (the batch id comes from the reply, so nothing is held on the device; red: 10 × `expected 404 to be 200`), the batch and new-vocab prompts, and the coverage grid on the Harvest tab (`src/harvest/CoveragePanel.tsx`: folded sections, tappable open cells; headless 360 px screenshot clean). One test expectation was wrong (an A1 word made pronouns fuller, so it was not picked). Review found a real bug: a paste cut off mid-way left the batch `batch_pasting` for good. Now a claim older than 60 s can be taken over and the harvest id is saved as soon as it exists, so a retry reuses it; tests pin busy, takeover, harvest reuse and the plain-route repeat. Also fixed the batch prompt's "fill every field" against JSON_ONLY's "leave a field out".
- **s03** (`2d2b3e4`): classify with its own statuses (`classify_issued`/`classified`) and routes, on the coverage panel rather than the f13 dialog (doc Decisions). Rows are judged one by one; apply is guarded on the issued topic and level; ids are looked up in chunks of 90. The domain was written before its tests could run (they needed the shared types after the s02 commit), so no red was recorded for it; the client prompt test went red on a missing import first. Review: no blockers; applied a pre-write stale check (so the stored outcome is right first time), a 200-row envelope, answered-vs-planned so a good row may follow a bad one, Apply disabled at 0 ticked, separate busy states, and tests for repeat-after-stale and deleted items. Open, unverified: the Workers Free limit of 50 queries per invocation for a 100-row apply; the existing 50-word paste already runs about 3 queries a word in daily use, and the sponsor's 100-word smoke settles it.

`pnpm check` green at 810. Not pushed, not deployed.

**Deploy note for the sponsor:** after s01 the old Vocab edit form sends free tags only when the Tags field is changed; such an edit, or a manual add with tags, gets a 400 until s04's pickers ship. Pastes are unaffected (lenient).

## 261006a — plan and open

The sponsor brought a 45-category tag list from the ChatGPT coach and asked for a home and a review. It was saved verbatim as `prompts/vocab-tags.md`. The review found overlaps (weather in nature and weather, quantity in three places, frequency in time and adverbs, money in work and shopping, possibility in cause and negation) and gaps that matter for Pakistani Urdu: compound verbs, forms of address, idioms, interjections, perception verbs and possession. It proposed slugs and grouped sections.

The sponsor then asked how many words per category would reach B1. Answer: about 2,500–2,600 in all (European-language CEFR estimates; no Urdu list exists), with quotas varying by topic. Numbers 1–100 are irregular and need about 110 slots, and compound verbs get a large topic of their own. The sponsor asked for per-level quotas and for less labour in the 8-step ChatGPT intake loop.

An Explore agent mapped the current pipeline:
- tags are free strings, auto-created, not case-folded, and absent from the review card;
- the check flow never touches tags;
- there is no CEFR field anywhere;
- the export holds the full vault, but no compact word list.

Grill (4 questions): ChatGPT paste rather than Worker API generation (avoid cost, fewest round trips); the check step dropped from the batch flow and kept as an audit; one topic plus 0–2 secondary slugs; existing words classified by a thin check mode at 100 per round trip.

Opened as f18 with 50 topics and draft quotas (A1 685, A2 955, B1 935; 2,575 in all), five slices and DECISIONS 261006a (`151be27`, `pnpm check` green). No code yet.
