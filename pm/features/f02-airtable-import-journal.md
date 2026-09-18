# Journal — f02 `airtable-import`

*Verbose per-session narration for f02. The feature doc (`f02-airtable-import.md`) is canonical for scope, plan and decisions; this file is the story of how it went. Newest session at the top.*

## 260917e — Stage 2 + Stage 3

**Stage 2 split in two on purpose.** `scripts/airtable-csv.ts` is pure — no fs, no fetch — so the Appendix C mapping is unit-testable; `scripts/airtable-import.ts` is the IO wrapper. That split needed somewhere to run node-side unit tests, so `vitest.config.ts` gained a third project, `scripts` (node environment, `scripts/**/*.test.ts`). It costs nothing: 25 tests in 0.8 s with no Workers pool startup.

**Wrote the CSV parser rather than taking a dependency.** RFC 4180 is a small grammar and the export exercises only part of it; a hand-rolled parse with tests for the BOM, quoted commas, doubled quotes, embedded newlines, CRLF, short rows and the trailing-newline phantom record is ~60 lines and adds no supply chain. The real export needs almost none of it — no multiline cells, no quoted commas in the columns we read — but the parser is what makes the *next* export safe, and the tests are the specification.

**The report is the product, not the import.** `buildReport` emits markdown with a Summary table and four sections (mapping errors, next-review mismatches, `urdu_key` collisions within the export, rejected rows) and a one-line verdict. The script exits 0 **only** when all four are empty, which turns Done-When #5 into an exit code the sponsor can read without interpreting anything. A non-empty report exits 1 and says to bring it back.

**The offline cross-check runs in both modes**, not just in the dry run. In a live run the report shows the endpoint's mismatch count *beside* the locally recomputed one, so if the two ever disagree that is visible on its face — the script and the Worker both call `nextReviewOn`, and a divergence would mean one of them is not.

**Stage 3 ran clean, twice over.** Dry run over the real export: 36 rows, 0 mapping errors, 0 mismatches, 0 collisions — reproducing the offline Python pre-check from the previous session exactly, which is the useful part: two independent implementations of the same cross-check agreeing. Then live against local D1 through `pnpm dev`: 36 created. Re-ran it: 36 updated, and D1 confirmed 36 rows, 36 distinct `airtable_id`, **0 `review_events`**. Idempotence is now demonstrated end to end and not just unit-tested.

**Folded in both f01 carry-forwards, and the second one was more interesting than it looked.** `preview_urls: false` was a one-liner. Extending the secret scan to `dist/urdu` failed immediately — the Worker bundle contains the string `UNLOCK_SECRET`, because the Worker *reads* `c.env.UNLOCK_SECRET`. The naive extension would have been a false positive on every build, and the temptation is to allow-list the string and move on. The honest rule is that the two directories carry different risks: in `dist/client` a secret *name* is itself the bug, because it means the frontend is reaching for a binding it must never see; in the Worker bundle names are expected and only a baked-in *value* is a leak. The scan now applies names-plus-values to `dist/client` and values-only to `dist/urdu`, exempting the non-uploaded `dist/urdu/.dev.vars` sidecar. Then I verified the value scan actually fires by appending the dev secret to the built bundle and re-running: it failed, as it should. A guard nobody has seen fail is not a guard.

**Toolchain.** AVG was in its fast state throughout: `pnpm check` at 27-49 s, 232 tests. Killed the `pnpm dev` node/workerd processes afterwards; the three from 13:52 predate the session and were left alone.

**Left at**: Stage 4 is the sponsor's — deploy, then run the script against production. Everything below it is verified.

## 260917d — open + Stage 1

**Opened the front.** f01 closed the session before, so f02 was next by PLAN Phase 1. Wrote the feature doc from the template with a four-stage roadmap and four open questions, flipped the roster row and the STATUS workfront. `7e01826`.

**The sponsor answered the blocking questions mid-session**, which changed the shape of the work:

- *Where is the export?* → `data/airtable/`, added during the session. Three CSVs, one per Airtable table.
- *Admin auth?* → session cookie, as recommended.
- *Schema cleanup now that we've left Airtable?* → asked for, and I reviewed and declined. See below.

**Profiling the export was the most useful thing I did.** Before writing any code I ran an offline cross-check in Python over `airtable_vocabulary_terms.csv`: recomputed `Last Reviewed + interval(mastery)` for all 36 rows and diffed against Airtable's `Next Review`, and approximated Appendix B normalization to look for `urdu_key` collisions. Result: **0 mismatches, 0 collisions, no blank required fields.** The `mastery_levels` CSV's intervals are 0/1/5/25/125/625/3125 — identical to `shared/mastery.ts`.

That matters for two reasons. It means the Airtable base was already running our exact ladder, so the FR-H2 cross-check report is a *confirmation*, not a reconciliation — and Stage 3's sponsor review may collapse to "the report is empty" (logged as Q5). And it means the dataset is 36 rows, not thousands, so batching is nearly moot; I kept a `MAX_IMPORT_BATCH` cap as a bound on request size rather than as a chunking strategy, and dropped batch-size tuning from the plan.

Two header deltas from PRD Appendix C that Stage 2 has to handle: the record id column is `_airtable_record_id` (not "record id"), the Tags name column is `Tag Name`, and all three files carry a UTF-8 BOM. Appendix C needs the ripple.

**Schema review: declined to change anything.** The ask was reasonable — we've broken away from Airtable, so is there residue? There are only two Airtable-shaped things in `0001_init.sql`, and both earn their place: `airtable_id` *is* the import's idempotence key (removing it is precisely what breaks re-runs, the property most wanted when a run goes wrong), and `source = 'airtable'` is provenance alongside `reading`/`coach`/`manual`. The rest of the schema is PRD Appendix A, not an Airtable mirror. The one genuine nit — `vocab_due` doesn't cover the code's third `id ASC` tiebreak — is cosmetic and would cost a migration against an already-deployed production D1. Recorded as a dated decision so it isn't re-opened.

**Stage 1 built** (`5b456d5`): `worker/domain/import.ts`, `worker/domain/import-input.ts`, `worker/routes/api-admin.ts`, `test/import.test.ts`, mounted behind the existing `requireSession`.

Design calls worth remembering:

- **Rows are written one at a time, not as one D1 batch.** Each needs a duplicate lookup against rows written earlier in the *same* batch, and a D1 batch cannot see its own writes. Two colliding records inside one request would otherwise both be written. At 36 rows the cost is irrelevant; the test `"rejects a collision between two records in the same batch"` pins it.
- **Per-row rejection, not batch failure.** `parseImportEnvelope` validates only the envelope; each record is parsed inside the service so one malformed row comes back as `rejected` with its field and reason. A migration that dies on row 12 of 36 is much worse than one that reports row 12.
- **`airtable_next_review_on` is accepted, compared, and never stored.** It exists purely so the response can carry the FR-H2 diff. An *absent* value is not a mismatch — only a supplied one can disagree.
- **A bare `Added` date expands to midnight UTC.** Appendix A types `added_at` as an instant; mixing date-only and ISO-datetime strings in one column would sort inconsistently.
- **Tag descriptions use `coalesce(excluded.description, description)`** so a name-only mention from a vocab row never clears a description the Tags table already supplied.

**Friction.** Two rounds of Biome failures, both self-inflicted: I patched files with a Python heredoc whose default newline handling rewrote them as CRLF, which the formatter rejects wholesale. Writing with `newline=''` and normalizing to LF fixed it. Worth remembering on this workstation — the Write tool is fine, in-place Python edits are not unless the newline is pinned.

AVG was in its fast state all session: the targeted import test ran in 2.8 s, full `pnpm check` in ~50 s.

**Left at**: Stage 2 not started. Endpoint is shipped, tested and committed; the script is the next thing.
