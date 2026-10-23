# Journal — mp08 check-scope

**Current state (2026-10-22):** s01 `checked_fields` (`a2b95d3`) and s02 Topic & level built;
migration 0010 applied remotely 2026-10-22 (sponsor), nothing deployed yet. s03 (Which words)
next.

## 261022d — opened; s01 checked-fields mask

Opened from the sponsor's question of how to re-sort this morning's verb-conjugation imports
(added before the `conjugation` topic existed, so they carry some other topic). Classify only
takes unclassified words, and check and suss never touched topic, so the only path was editing
by hand. Scoped with the sponsor: topic as a check field rather than a separate reclassify loop;
"Which words" selection (newest N, added between, topic); `vocab-json.md` generated with a
trigger line kept in the Project instructions. The sponsor proposed a field bitmask beside
`checked_at` in place of a per-field date; a second "last checked fields" mask was assessed and
rejected because `handoffs.payload` already holds each batch's ids, mode and fields (261022b).

Sponsor pasted the live Project instructions: two hand-added Interaction Style lines (speak
slowly; correct odd phrasing as well as mistakes) were missing from the repo copy and were added
(`ca44775`). s04 must leave those sections hand-kept.

s01: migration 0010 adds `checked_fields` (NOT NULL DEFAULT 0, CHECK >= 0); `CHECK_FIELD_BITS` in
`shared/api.ts`; `VocabItem.checked_fields` so the export carries it. The first cut counted every
ticked field; a test showed an item with no English owed an English check forever, so the mask
now covers only fields with a value: selection compares against the ticked present fields, the
apply stamp (run after the batch's writes) ORs in the ticked fields present then, and the
backfill gives checked rows the bits of their present content fields (261022c). The correctness
rotation ranks an item owing a check with the never-checked. Tests: check selection by field,
the OR/apply sequence (empty field, completeness, repeat, fill then check), f11 batch, migration
backfill. `pnpm check` green, 859 tests. Ripples: PRD FR-F9, AGENTS Project state (also 0009 now
remote), DECISIONS 261022b/c.

Next: s02 Topic & level as a check field (bit 32).

## 261022e — s02 Topic & level as a check field

`shared/api.ts` splits the field sets: `CHECK_FIELDS` (the text fields plus `topic`, what the
dialog ticks and the mask counts, bit 32) and `CORRECTABLE_FIELDS` (adds `cefr` and `tags`, what
a correction may change), with `CHECK_FIELD_OF` mapping one to the other. `FieldChange` values
widen to `FieldValue` (text or a tags list; tags are never null). Corrections read topic, level
and tags with f18's `lenientClassification`; dropped slugs land on the plan as `dropped` and show
on the preview row. Selection: Topic & level is present once the item has a topic, missing while
it lacks a topic or level. Scope rules fall out of tags never being null: correctness may change
them, completeness never.

Two bugs caught by the new tests: (1) a dropped topic came back from the lenient parser as null,
which in a correction means remove, so an unknown slug wiped the topic; the parse now deletes a
dropped topic or level. (2) The tags write filtered against the stored topic, so a ticked topic
change plus tags lost the tags; tags are now filtered in the plan against the topic the item
will end with (depends on whether the topic change was ticked and still holds), tags write before
topic, and a topic write strips its slug from tags left alone. Written tags get name rows.

Prompts: with Topic & level ticked, each item shows topic, cefr and tags, the prompt carries
`CLASSIFY_RULES` (topic list and boundaries) and completeness lists missing topic/cefr; the suss
prompt always carries them, and the suss batch covers all six fields. The dialog has a sixth tick,
**Topic & level**, off by default. Preview shows topics and tags by label ("Also about").

Tests: `test/check-topic.test.ts` (12: selection, bit 32, suss, preview, dropped, completeness,
apply without schedule change, strip, own-topic tag, kept on edit, null tags, accept shape), plus
prompt and options tests; the old "unknown field" case moved from `tags` to `favourite`.
Headless shots were not possible: local server access was denied again (as in mp07), so the
dialog and preview are left to the phone step. `pnpm check` green, 874 tests. Ripples: PRD FR-F9
and FR-E2, CHANGELOG, AGENTS Project state.

Next: s03 Which words (scope, dates, topic filter).

Wrap: the sponsor reported 0010 applied remotely, so `main` can be deployed.
