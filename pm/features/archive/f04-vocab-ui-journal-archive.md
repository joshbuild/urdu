# Journal — f04 `vocab-ui`

*Verbose per-session narration for f04. The feature doc (`f04-vocab-ui.md`) is canonical for scope, plan and decisions; this file is the story of how it went. Newest session at the top.*

## 260918a — opened, s01–s07, closed

**Current state**: shipped. smoke-test-04 green on the phone.

**Opening.** The f01 API already did almost everything FR-D needs: list with `q`/`tag`/`due`/`sort`/`offset`, get, PATCH (mastery edits recompute next review and write no review event), DELETE with cascade to review events. The one gap was a tag list for the filter, so s01 added `GET /api/tags`, reading the `tags` table that every write already keeps in step.

**s02–s05 in one pass.** The Vocab tab swaps between list, detail and edit views in place and holds the filters, so Back lands on the same list. Pure logic (`listQuery`, `isDue`/`reviewLabel`, `draftFromItem`/`buildUpdate`) lives beside the components with node tests, per 260917g. The Add sheet's fields moved into `DraftFields` so add, manual add and edit write the same shape. `AddVocabSheet` gained `source`, `doneLabel` and `onOpenExisting`, which closed f03's carry-forward: a duplicate now links to its detail. A large bash heredoc script failed to parse and ran nothing; the files were then written directly.

**s06.** Session limit is a localStorage number (1–200, the due route's cap), with a pure parser that falls back to 20 on anything odd.

**s07 — the phone found one bug.** Delete showed "Could not delete". The Worker's CSRF middleware refuses non-JSON writes with 415, and the client's DELETE had no body or content type. Worker tests could not catch it because the test client always sends JSON. Fixed by sending `{}` as JSON, as Lock does; the sponsor redeployed and G3 deleted smoke-test-03's leftover row in-app. The sponsor kept the `ٹیسٹ` test item and asked for a task to complete missing fields across the vault; it went to the Inbox.
