# Feature Plan — Airtable Import

**Status**: 🟡 IN PROGRESS — *opened 2026-09-17 at Stage 1 (import endpoint).*
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
- **Batch sized under D1/Workers limits** — batches must not exceed the subrequest/statement ceiling for a single Worker invocation.
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

- *2026-09-17* — Front opened at Stage 1. Nothing built yet.

### Next Steps

1. Answer Q1–Q3 below (sponsor), since Q1 gates Stage 2 and Q2 gates the endpoint's auth shape.
2. Build Stage 1: `worker/domain/import.ts`, `worker/routes/api-admin.ts`, `test/import.test.ts`.

### Open Questions

- **Q1 — Where is the Airtable export, and in what shape?** (sponsor) One CSV per Airtable table (Vocabulary Terms, Tags), or a combined export? Do the column headers match Appendix C exactly? Blocks Stage 2; does not block Stage 1.
- **Q2 — Admin auth: session cookie or a separate admin token?** (sponsor/agent) FR-H1 allows either. Recommendation: **session cookie** — the script already needs to unlock (`scripts/smoke.ts` does), it adds no new secret, and the route stays inside the existing `/api/*` middleware. A separate token is warranted only if the import should be runnable without a device session.
- **Q3 — What should happen to a row rejected as a `urdu_key` duplicate?** (sponsor) Proposal: report it and skip; the sponsor merges in Airtable and re-exports. The alternative (keep the higher mastery, merge notes) makes the import opinionated about the sponsor's data.
- **Q4 — Is `Added` in the export a date or a datetime?** (agent, resolvable at Stage 2) `added_at` is a timestamp in Appendix A; a date-only Airtable value needs a documented time-of-day convention.

### Open Discussion

*Nothing yet beyond the questions above.*



## Decisions

- *2026-09-17* — **Idempotence is for re-runs, not sync.** The upsert key is `airtable_id` so a failed or wrong run can be corrected and re-run without wiping D1. Airtable is being retired; no recurring sync is planned or designed for.
- *2026-09-17* — **`urdu_key` collisions are rejected, not merged.** Merging two vocabulary rows is a judgement about the sponsor's own learning data; the import reports and defers to them. *(Pending Q3 confirmation.)*
