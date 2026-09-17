# Feature Plan — Airtable Import

**Status**: 🟡 IN PROGRESS — *Stage 1 shipped 2026-09-17; Stage 2 (CSV script) next.*
**Handle**: `f02`
**Created**: 2026-09-17 · **Updated**: 2026-09-17

**Owner docs it serves**:
- `pm/PRD.md` FR-H (requirements), Appendix A (data model), Appendix B (`urdu_key`), Appendix C (field mapping)
- `pm/PLAN.md` Phase 1 (this is the remaining exit condition)
- `shared/normalize.ts`, `shared/mastery.ts`, `shared/dates.ts` (as-built rules the import must reuse, not re-implement)

> **One-line:** a one-time, idempotent import of the sponsor's Airtable "Urdu Vocab" base into D1, preserving mastery and review history and reporting every row where Airtable's scheduling disagrees with ours.



## Intent

### Vision

Everything f01 built is currently pointed at an empty vault. The sponsor's real vocabulary — years of accumulated terms, phrases, mastery scores and review dates — lives in Airtable, and until it is in D1 the app is a demo. This feature is the migration: after it runs, `urdu.umber-amber.workers.dev` holds the sponsor's actual learning state, review is due on the right items on the right days, and Airtable stops being the system of record.

It is deliberately a *one-time* migration with an *idempotent* mechanism. Idempotence is not there to support ongoing sync — it is there so a botched run can simply be re-run after a fix, without a manual `DELETE FROM vocab` in between.

### Scope

- `POST /api/admin/import` — a session-protected batch endpoint in Urdu Core that upserts vocab rows keyed on `airtable_id`, and upserts `tags` rows (name + description).
- `scripts/airtable-import.ts` — reads the Airtable CSV export(s) from disk, maps per PRD Appendix C, batches to the endpoint, and writes a **cross-check report**.
- The cross-check report: every row whose recomputed `next_review_on` differs from Airtable's `Next Review`, plus counts (created / updated / skipped / rejected) and every rejected row with its reason.
- A real run against production D1, and the sponsor reviewing the report.

Smallest coherent thing: the endpoint + the script + one clean real run whose report the sponsor accepts.

### Exclusions

- **Ongoing Airtable sync.** Not deferred — rejected. Airtable is being retired, not integrated. Idempotence exists for re-runs, not for a recurring job.
- **The Airtable API.** CSV export only (FR-H1). No API key, no base introspection, no rate-limit handling.
- **Mastery Levels table** (FR-H3) — the ladder is `shared/mastery.ts` and is not data.
- **`Next Review` / `Review Interval Days` as imported values** (FR-H2) — recomputed from `last_reviewed_on` + `interval(mastery)`. The imported values are read *only* to produce the cross-check diff.
- **A UI for import.** Script-and-endpoint only; this runs from the sponsor's machine once.
- **Duplicate merging across `urdu_key`.** Airtable rows colliding on `urdu_key` are *reported and rejected*, not merged — merging is a judgement call the sponsor makes in Airtable before a re-run.

### User Stories

- As the sponsor, I want my Airtable vocabulary in D1 with mastery and last-reviewed dates intact, so that the review queue on my phone reflects what I actually know.
- As the sponsor, I want a report of every row where our recomputed next-review date disagrees with Airtable's, so that I can tell whether the ladder matches what I was doing before and whether anything needs correcting.
- As the sponsor, I want to re-run the import after fixing a bad row, so that a partial or wrong run is recoverable without wiping the vault.

### Non-Functional Requirements

- **Idempotent by `airtable_id`**: re-running over the same export yields the same vault state, with updates rather than duplicates and no duplicated `review_events`.
- **Never silently drops a row.** Every input row is accounted for in the report as created, updated, or rejected-with-reason.
- **Reuses `shared/`**: `urduKey`, `inferKind`, `nextReviewOn`, mastery clamping. The import must not carry a second copy of any domain rule.
- **The secret never reaches the CLI.** Like `scripts/smoke.ts`, the script reads `URDU_SECRET` from the environment; never an argument.
- **Batch capped** at `MAX_IMPORT_BATCH` (200 records). At 36 rows the real export is a single batch; the cap exists so the endpoint cannot be handed an unbounded body.
- **Non-destructive**: the endpoint never deletes rows the export does not mention.



## Planning

### Testing

Automated (Workers pool, `test/import.test.ts`):
- Upsert on a fresh vault creates rows with correct field mapping, `source = 'airtable'`, recomputed `next_review_on`.
- Re-posting the identical batch updates in place: row count unchanged, `airtable_id` unique, no new `review_events`.
- A row whose `urdu_key` collides with an *existing different* `airtable_id` is rejected with a duplicate reason, not written.
- Mastery parsing: `"1-Learning"` → 1; out-of-range or unparseable → rejected (not silently 0).
- `last_reviewed_on` null → `next_review_on` null (due now), per the never-reviewed invariant.
- Tags: names from the Vocabulary Terms rows land in `vocab.tags`; the Tags-table import fills `description` without clobbering names.
- Auth: unauthenticated POST is rejected.

Unit (node project): the CSV → import-record mapping function, including quoting/multiline cells, empty cells, and the Airtable date formats.

Manual:
- Dry-run mode against the real export, report reviewed before any write.
- The real run, then `GET /api/export` compared against the export row count.

Edge cases that must be proven: multiline `Meaning` cells, commas inside Urdu text, a term that is whitespace-only after normalization (`empty_key`), an Airtable row with no `Urdu Term`, and DST-boundary `Last Reviewed` dates.

### Done When

1. `POST /api/admin/import` exists, is auth-protected, is idempotent by `airtable_id`, and is covered by the tests above.
2. `scripts/airtable-import.ts` runs end-to-end from the sponsor's CSV export with a `--dry-run` mode and writes a cross-check report.
3. `pnpm check` is green.
4. The real import has run against production D1.
5. Production `GET /api/export` row count matches the export, and the sponsor has reviewed and accepted the cross-check report.
6. PLAN Phase 1 exit re-read: D1 holds the Airtable vocabulary with mastery and dates preserved.

### Roadmap

- **Stage 1 — Import endpoint.** `worker/domain/import.ts` + `worker/routes/api-admin.ts`, mounted behind the session middleware. Upsert-by-`airtable_id`, per-row outcome in the response, tags upsert. Tests. *(No dependency; starts now.)*
- **Stage 2 — CSV mapping + script.** `scripts/airtable-import.ts`: CSV parse, Appendix C mapping, batching, `--dry-run`, report writer. Depends on Stage 1's response shape.
- **Stage 3 — Dry run + sponsor review.** Run against the real export (local D1 first), hand the sponsor the cross-check report, resolve rejected rows.
- **Stage 4 — Real run.** Sponsor runs it against production, verifies on the phone.
- **Fold-in (any stage):** the two carried-forward f01 TODOs — `"preview_urls": false` in `wrangler.jsonc`, and extending `scripts/scan-bundle.mjs` to cover `dist/urdu`.



## Status

### Recently Completed

- *2026-09-17* — **Stage 1 done** (`5b456d5`). `POST /api/admin/import` behind the session middleware; `worker/domain/import.ts` upserts by `airtable_id`, recomputes `next_review_on`, reports mismatches, rejects per row, upserts tags. 13 tests in `test/import.test.ts`; `pnpm check` green (207 tests).
- *2026-09-17* — Sponsor supplied the exports in `data/airtable/` (now gitignored) and chose session-cookie auth. Export profiled: 36 vocab rows, 3 tags, 7 mastery levels.
- *2026-09-17* — Front opened at Stage 1.

### Next Steps

1. Stage 2: `scripts/airtable-import.ts` — CSV parse (BOM, quoted/multiline cells), Appendix C mapping, `--dry-run`, unlock via `URDU_SECRET`, cross-check report writer.
2. Ripple the real header names into PRD Appendix C (`_airtable_record_id`, `Tag Name`).

### Open Questions

- ~~**Q1 — Where is the export?**~~ **Answered 2026-09-17**: `data/airtable/` — one CSV per table (`airtable_vocabulary_terms.csv` 36 rows, `airtable_tags.csv` 3, `airtable_mastery_levels.csv` 7, not imported per FR-H3). Headers differ from Appendix C in two places: the record id is `_airtable_record_id`, and the Tags table's name column is `Tag Name`. All three carry a UTF-8 BOM.
- ~~**Q2 — Admin auth?**~~ **Answered 2026-09-17**: session cookie. See Decisions.
- ~~**Q3 — `urdu_key` duplicates?**~~ **Answered 2026-09-17**: report and skip; the sponsor merges in Airtable and re-exports. Moot for this export (0 collisions) but implemented and tested.
- ~~**Q4 — Is `Added` a date or a datetime?**~~ **Answered 2026-09-17**: a bare date. Read as midnight UTC; see Decisions.
- **Q5 — Does the empty cross-check report need a sponsor review step at all?** (sponsor, Stage 3) The offline pre-check found 0 mismatches across all 36 rows, so Done-When #5 may reduce to confirming the report is empty.

### Open Discussion

The offline pre-check over the real export found **0 next-review mismatches** across all 36 rows, **0 `urdu_key` collisions**, and no blank required fields; the `mastery_levels` CSV's intervals match `shared/mastery.ts` exactly (0/1/5/25/125/625/3125). The Airtable base was already running our ladder, so the FR-H2 cross-check should come back empty — which makes it a confirmation, not a reconciliation. Tags are barely used: 34 of 36 rows have none.



## Decisions

- *2026-09-17* — **No schema change for f02.** Reviewed `migrations/0001_init.sql` now that Airtable is being retired. `airtable_id` and `source = 'airtable'` stay: the first is the import's idempotence key (removing it breaks FR-H1 re-runs) and the second is provenance. Nothing else in the schema is Airtable-shaped. A migration against a already-deployed production D1 for cosmetics is the wrong trade, so the schema is unchanged.
- *2026-09-17* — **Admin auth is the existing session cookie** (Q2). The script unlocks the way `scripts/smoke.ts` does, so the import adds no second secret and the route stays inside the `/api/*` middleware. A scoped admin token is the answer only if the import ever has to run without a device session.
- *2026-09-17* — **A bare `Added` date is read as midnight UTC** (Q4). Appendix A types `added_at` as an instant; expanding date-only input keeps one comparable format across imported and app-created rows, and date-only values would otherwise sort inconsistently against ISO datetimes.
- *2026-09-17* — **A batch is written row by row, not as one D1 batch.** Each row needs its own duplicate lookup against rows written earlier in the same batch; a single batch cannot see its own writes. At 36 rows the cost is irrelevant.
- *2026-09-17* — **Idempotence is for re-runs, not sync.** The upsert key is `airtable_id` so a failed or wrong run can be corrected and re-run without wiping D1. Airtable is being retired; no recurring sync is planned or designed for.
- *2026-09-17* — **`urdu_key` collisions are rejected, not merged.** Merging two vocabulary rows is a judgement about the sponsor's own learning data; the import reports the holding row's id and defers to them. *(Confirmed by the sponsor 2026-09-17.)*
