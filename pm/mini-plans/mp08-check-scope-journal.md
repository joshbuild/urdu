# Journal — mp08 check-scope

**Current state (2026-10-22):** opened; s01 `checked_fields` built and committed (`a2b95d3`),
migration 0010 applied locally only. `main` now needs 0010 remotely before any deploy. s02
(Topic & level check field) next.

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
