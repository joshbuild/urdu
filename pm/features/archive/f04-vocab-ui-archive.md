# Feature Plan — Vocab UI

**Status**: 🟢 SHIPPED — *closed 2026-09-18. s01–s07 done; phone smoke test green.*
**Handle**: `f04`
**Created**: *2026-09-18* · **Updated**: *2026-09-18*

**Owner docs it serves**:
- `pm/PRD.md` — FR-D1..D3, FR-I1 (review session limit, lock; voice spend stays f07)
- `pm/PLAN.md` — Phase 2 roster row
- `shared/mastery.ts` — level names and next-review display (display only, FR-A2)

> **One-line:** Browse, search, filter and sort the vault on the phone; open any item to see, hear, edit or delete it; add items by hand; set the review session limit.

## Archived — as shipped (2026-09-18)

**Status:** 🟢 shipped. All four Done-When conditions met; `smoke-tests/archive/smoke-test-04_archive.md` green on the installed Android PWA (A1–G3).

**What shipped:** `GET /api/tags`; Vocab tab list with debounced search, tag filter, due-only, sort and load-more (FR-D1); item detail with speak, mastery name, review dates and two-step delete; edit of any field including kind and mastery, sending changed fields only (FR-D2); manual New item through the shared Add sheet, source `manual` (FR-D3); reader duplicate → **Open it** → Vocab detail; Settings "Items per review session" (default 20, per device) for f05.

**Found on the phone:** DELETE sent no `Content-Type` and the Worker's CSRF guard answered 415; fixed in `ea22bfc` (DECISIONS 260918a).

**Where the truth lives now:** code in `src/vocab/`, `src/screens/VocabScreen.tsx`, `src/settings/sessionLimit.ts`, `src/reader/DraftFields.tsx`; `worker/routes/api-vocab.ts` for `/api/tags`; this doc's §Decisions.

**Carried forward:** f05 reads `readSessionLimit()`; TODO Inbox holds "complete missing fields on existing items" (f08 backfill candidate).

## Intent

### Vision

f02 put 36 items in the vault and f03 lets the sponsor add more from reading, but nothing lets them *see* the vault. f04 is the vault's window: find a word fast by Urdu, Roman or English, see where it sits on the ladder and when it comes back, fix a bad field, hear it, or remove it. It replaces the last reason to open Airtable.

### Scope

- **FR-D1** Vocab tab list: search box (Urdu/Roman/English substring, server-side `q`), tag filter, due-only toggle, sort (added / next review / mastery); paged by `offset`, "load more".
- **FR-D2** Item detail: all fields, mastery level name, last/next review, speak button; edit any field incl. mastery (server recomputes next review); delete with confirmation.
- **FR-D3** "New item" from the Vocab tab using the FR-C6 form (the f03 `AddVocabSheet`, source `manual`, no prefill).
- f03 carry-forward: the reader's inline-duplicate display links to the existing item's detail.
- **FR-I1 (part)** Settings: review session limit (default 20), stored per device for f05 to read. Lock already shipped in f03 s01.
- `GET /api/tags` (name list) to populate the tag filter — the one Worker addition.

### Exclusions

- **Voice spend display and caps** — f07, with the voice session it measures.
- **Tag management (create/rename/describe tags)** — v1 "tag UI". Tags are edited as free text on the item.
- **Review UI** — f05. Editing mastery here is a correction, not a tracked review: no review event (FR-A8 / existing PATCH).
- **LLM field-filling** — f08.
- **Fuzzy duplicate suggestions** — v1; exact `urdu_key` only.

### User Stories

- As the sponsor, I want to type a few letters of Roman or English and find the item, so that checking "do I have this?" takes seconds.
- As the sponsor, I want to see what's due and at what level, so that I know what review holds.
- As the sponsor, I want to fix a wrong translation or reset a mastery level, so that the vault stays trustworthy.
- As the sponsor, I want to add a word I heard, not read, so that it enters review.

### Non-Functional Requirements

- 44 px targets; one-handed; Urdu fields render in Nastaliq RTL, Roman/English LTR.
- Search debounced (~250 ms); stale responses ignored.
- No mastery logic in the client beyond importing `shared/` for names/display.

## Planning

### Testing

- **Worker:** `GET /api/tags` — auth required, sorted names, empty case.
- **Client unit (node project):** list query builder (params from UI state, defaults omitted); edit diff (PATCH sends changed fields only); tags text ⇄ array parsing; session-limit storage (bounds, bad stored values fall back to 20).
- **Smoke-test-04 on the phone:** search, filter, sort, detail, speak, edit, mastery edit moves next review, delete, manual add, duplicate link from reader, session limit persists.

### Done When

1. FR-D1..D3 work on the installed phone PWA (smoke-test-04 green).
2. Review session limit settable and persisted; exposed for f05.
3. Reader duplicate link opens the item detail.
4. `pnpm check` green; deployed.

### Roadmap

- **s01** `GET /api/tags` + tests.
- **s02** Vocab list: search, tag, due-only, sort, paging.
- **s03** Item detail + speak + delete.
- **s04** Edit (incl. mastery) — reuse the add form fields.
- **s05** Manual new item (FR-D3) + reader duplicate link.
- **s06** Settings session limit.
- **s07** Deploy (sponsor) + smoke-test-04.

## Status

### Recently Completed

- 2026-09-18 — s07: smoke-test-04 green after the DELETE content-type fix; smoke-test-03's leftover row deleted in-app (G3). Closed.
- 2026-09-18 — s06: Settings "Items per review session" (1–200, default 20, localStorage `urdu.sessionLimit`; `src/settings/sessionLimit.ts` for f05 to read). `pnpm check` green at 293.
- 2026-09-18 — s02–s05: `src/vocab/` list (debounced search, tag, due-only, sort, load more), detail (speak, two-step delete), edit (changed fields only, kind + mastery pickers); manual add reuses `AddVocabSheet` with source `manual`; form fields extracted to `src/reader/DraftFields.tsx`; reader duplicate → **Open it** → Vocab detail. Not yet viewed in any browser.
- 2026-09-18 — s01: `GET /api/tags` (reads the `tags` table, which every write keeps in step).
- 2026-09-18 — opened; plan written from PRD FR-D/FR-I1 and the existing `/api/vocab*` routes.

### Next Steps

- None — shipped. Next front is f05 `review`.

### Open Questions

- None blocking.

## Decisions

- 2026-09-18 — Mastery edits go through the existing PATCH (no review event), per FR-A8: a correction is not a review.
- 2026-09-18 — Detail and edit replace the list inside the Vocab tab (not a bottom sheet); filters survive Back. Delete confirms inline (two-step), not with `window.confirm`.
- 2026-09-18 — Session limit lives in localStorage (per device), like the voice choice; no server setting in v0.
