# Feature Plan — Check Modes

**Status**: 🟢 SHIPPED — *closed 2026-10-02. s01–s04 built 2026-09-28; s05 phone: 0006 applied remotely and deployed with the f17 deploy, and the sponsor's daily use of the check through the options dialog (reported 2026-10-02) met smoke-test-13.*
**Handle**: `f13`
**Created**: *2026-09-28* · **Updated**: *2026-10-02*

**Owner docs it serves**:
- `pm/PRD.md` — FR-F9 (the check gains modes and options), FR-F7 (fill-ins, retired into FR-F9's completeness mode), Appendix A (`vocab.filled_at`)
- `pm/DECISIONS.md` — 260918g (fill-ins never overwrite), f11's decisions in `features/f11-vocab-check.md`
- Code it extends: `worker/domain/check.ts`, `worker/domain/handoff-input.ts`, `worker/routes/api-handoff.ts`, `shared/api.ts`, `src/handoff/prompts.ts`, `src/handoff/check.ts`, `src/handoff/HandoffPanel.tsx`; retires `reviseVocab` / `incompleteVocab` in `worker/domain/handoff.ts`

> **One-line:** **Copy check prompt** opens a dialog (mode: correctness, completeness or both; which fields; how many; only unchecked), and completeness replaces the fill-in pair, so one ticked preview both fixes wrong fields and fills empty ones.

> **As shipped (2026-10-02).** **Copy check prompt** opens a Check options sheet: mode (correctness, completeness or both), fields, how many (1–50, default 20) and only items not yet checked this way, remembered on the device. Correctness rotates on `checked_at`, completeness on `filled_at` (migration 0006); the Worker records mode and fields with the batch, ignores and reports any change they don't allow, and stamps per mode. The f06 fill-in pair and its routes are removed (FR-F7 superseded). Live truth: PRD FR-F9, FR-F7 (superseded) and Appendix A `filled_at`; DECISIONS 260918g; `worker/domain/check.ts`, `worker/domain/handoff-input.ts`, `src/handoff/checkOptions.ts`, `src/handoff/prompts.ts`, `src/handoff/HandoffPanel.tsx`, tests `test/check.test.ts`. Evidence: `smoke-tests/archive/smoke-test-13_archive.md`. The execution record below is historical.

## Intent

### Vision

f11's check asks the chat to fix what is wrong and, in passing, to "add a missing field only if the
entry needs it", so in practice it rarely fills an empty example. The f06 fill-in pair should do
that, but it serves the oldest 20 incomplete items every time: an item the chat declines to
complete (no notes, say) never leaves the front of the queue, so later items never get their
examples. The sponsor wants two clear jobs, correctness and completeness, each rotating through
the vault, and a choice of which fields and how many items per pass. One dialog behind **Copy
check prompt** does both jobs, and the fill-in pair goes, so the crowded CHATGPT row drops from six
buttons to four.

### Scope

- **Options** (`CheckOptions`, `shared/api.ts`): `mode` = `correctness` | `completeness` | `both`;
  `fields` = a non-empty subset of the five fillable fields (roman, english, notes, example_urdu,
  example_english); `count` = an integer 1–50, default 20; `only_unchecked` = boolean, default
  false. `MAX_CHECK_BATCH` rises from 20 to 50 (sponsor, 2026-09-28); `DEFAULT_CHECK_COUNT = 20`.
- **Migration 0006:** a nullable `vocab.filled_at` (UTC instant an item was last in an applied
  completeness batch) and an index `vocab_fill (filled_at, added_at)`. `checked_at` keeps its
  meaning: last in an applied correctness batch. `VocabItem` gains `filled_at`; the export carries
  it. Edits, reviews and imports never touch it (explicit column lists; a test pins it).
- **Batch** (`POST /api/handoffs/check-batch`, body = the options, strict; every key optional with
  the defaults above, so `{}` is f11's request): let *missing* be "any selected field is null" and
  *present* be "any selected field is not null".
  - correctness — candidates: *present*; unchecked: `checked_at IS NULL`; order
    `checked_at ASC NULLS FIRST, added_at, id`.
  - completeness — candidates: *missing*; unchecked: `filled_at IS NULL`; order
    `filled_at ASC NULLS FIRST, added_at, id`.
  - both — candidates: every item; unchecked: `checked_at IS NULL OR (missing AND filled_at IS
    NULL)`; order by the older of the two stamps, a null counting as oldest
    (`min(coalesce(checked_at,''), coalesce(filled_at,''))`), then `added_at, id`.
  - `only_unchecked` restricts the candidates to the unchecked ones. The batch is the first
    `count` in order (fewer when there are fewer candidates). The row's payload records
    `{vocab_ids, mode, fields}`, and apply keeps `mode` and `fields` when it rewrites the payload,
    so a repeat can still report its mode. The response is
    `{handoff_id, items, candidates, unchecked}` (counts over the vault for the copy note;
    `never_checked` is dropped). No candidates → `handoff_id: null`, nothing recorded.
- **Prompt** (`checkPrompt(items, handoffId, options)`): each item is listed with its `vocab_id`,
  `urdu`, every present field (context, even unselected ones) and, in completeness/both, a
  `missing` list of its empty selected fields.
  - correctness: check only the selected fields; correct or remove (null) wrong values; **never add
    a missing field** (f11's "add a missing field only if the entry needs it" is dropped).
  - completeness: supply every field in each item's `missing` list; never change or remove a
    present field.
  - both: the two instructions together.
  - The reply shape, `reason` (a short one, e.g. 'added example' for a fill), `urdu_suggestion`
    and the strict-JSON rule are unchanged, so `parseCorrections` is unchanged apart from the cap.
- **Scope rules at plan time** (`planCorrection`, deterministic; the chat only proposes): a proposed
  change is *ignored* when its field isn't selected; in correctness, when it fills an empty field;
  in completeness, when it changes or removes a present value. Ignored fields are reported on the
  plan (`ignored: FillableField[]`) and shown in the preview as one grey line; they have no tick.
  A plan with no changes left is `nothing`, as today. A batch row without `mode` (issued by f11
  before this deploy) keeps f11's rules: every field, no scope filtering, stamps `checked_at`, and
  reports `mode: "correctness"`. An accept naming an ignored field passes the parser (the field
  was proposed) and is reported kept, as for any field no longer in the plan; the client never
  ticks one. Ignored fields show only on rows the preview shows; a `nothing` row whose only
  content is ignored fields stays hidden with the fine items.
- **Stamp on apply:** correctness stamps `checked_at`, completeness `filled_at`, both both, on
  every batch id, without `updated_at`. Everything else in apply (per-field old-value guards,
  guarded reset, `check_issued` → `checked`, repeats) is f11's, unchanged.
- **Responses:** preview and apply carry `mode`, so the sheets can say "marked checked", "marked
  filled" or "marked checked and filled".
- **Dialog** (client): **Copy check prompt** opens a sheet with Mode (three radios), Fields (five
  checkboxes, at least one), How many (number, 1–50), Only items not yet checked this way, and
  **Copy prompt** / Cancel. Copy posts the options, copies the prompt, closes the sheet and shows
  the note under the buttons as today: batch size, candidates and unchecked counts in words that
  fit the mode. **Copy prompt** is disabled, with a hint, while no field is ticked or How many is
  outside 1–50. No candidates: correctness "No item has these fields to check.", completeness
  "Every item has these fields.", with only-unchecked "Every item has been checked this way;
  untick Only unchecked to go round again." The last options are remembered on the device
  (localStorage key `urdu.checkOptions`, wrapped in try/catch; unreadable or invalid → defaults). The pure model
  (`src/handoff/checkOptions.ts`: defaults, validate, load/save shape) is tested.
- **Fill-in pair retired:** the Copy fill-in prompt / Paste fill-ins buttons, `PasteFillSheet`,
  `fillInPrompt`, `POST /api/handoffs/revisions`, `GET /api/vocab/incomplete`, `reviseVocab`,
  `incompleteVocab`, `parseRevisions`, their types and tests go, and `worker/index.ts`'s mount-order
  comment about `/api/vocab/incomplete`. `revised` stays in `HANDOFF_STATUSES`: stored rows carry
  it, and the type describes them. PRD FR-F7 is marked
  superseded by FR-F9's completeness mode.

### Exclusions

- **Per-field stamps** (one `checked_at` per field): the sponsor chose one stamp per mode.
- **A server-side LLM check**: f08, on hold.
- **Changing `urdu` itself**: still a flag only (f11).
- **Tidying the crowded CHATGPT row further** (menus, collapsing): the sponsor deferred it
  ("we can address that later"); this feature only removes the fill-in pair.
- **Choosing the batch by the Vocab list's filters**: rotation replaced it (f11).
- **Remembering options across devices**: per-device is enough for one user on one phone.

### User Stories

- As the learner, I pick Completeness and Examples, copy a prompt for 20 items, and get examples
  filled in, and the next copy moves on to 20 different items even if the chat skipped some.
- As the learner, I run Correctness on English and Roman only, so the chat doesn't pad entries
  while I'm checking meanings.
- As the learner, I tick "only unchecked" to sweep the items never checked this way, then untick
  it to rotate through the rest.

### Non-Functional Requirements

- **No spend:** ChatGPT subscription only.
- **Deterministic writes:** the Worker enforces the mode and fields, whatever the chat sends.
- **Never clobber:** completeness can't overwrite a present value, even if ticked; f11's
  per-field guard still holds.
- **Reply reliability:** 50 is the ceiling; 20 stays the default.
- **Device:** the dialog fits a phone screen; the number field brings up the numeric keypad.
- **Migration order:** 0006 follows f12's 0005; the sponsor applies both remotely before the
  deploy that carries them.

## Planning

### Testing

- **Migration test (s01):** 0006 adds `filled_at` null on every row, rows otherwise intact, index
  present; local D1 run.
- **Worker tests (s01–s02):** option parsing (defaults from `{}`, unknown key, empty/unknown/repeated
  field, count 0/51/non-integer, non-boolean `only_unchecked`); selection per mode (candidates,
  order with each stamp, `only_unchecked`, the count, `candidates`/`unchecked` counts, no
  candidates records nothing); the payload records mode and fields; scope rules per mode (an
  unselected field, a fill in correctness, an overwrite and a remove in completeness, all
  ignored and reported); a legacy batch without `mode` keeps f11's rules; stamps per mode,
  `updated_at` untouched; `mode` on preview, apply and repeat; 50 corrections accepted, 51
  rejected; `updateVocab`, a review and an import leave `filled_at` alone.
- **Client tests (s03):** `checkPrompt` per mode (fields named, the `missing` lists, "never add"
  in correctness, "never change" in completeness); the options model (defaults, invalid stored
  value → defaults, count clamped/refused); the preview's ignored line via the tick model (ignored
  fields get no tick).
- **Retirement (s04):** tsc and the suite prove nothing still references the removed code.
- **Phone smoke (smoke-test-13, written in s04, run in s05):** completeness on Examples for a
  small batch fills empties with no overwrites and stamps them (the next copy moves on);
  correctness on English with a planted mistake fixes it and proposes no fills; both; only
  unchecked narrows the batch; the options are remembered after reopening the app; the CHATGPT
  row shows four buttons.

### Done When

- ✅ `pnpm check` green with the s01–s04 tests.
- ✅ Migration 0006 applied locally (s01) and, by the sponsor, remotely before the deploy (s05).
- ✅ smoke-test-13 green on the installed phone app: met by daily use 2026-10-02 (steps waived on
  the sponsor's report; the Worker tests cover scope rules, ignored fields and per-mode stamps).
- ✅ at close 2026-10-02. Ripples: PRD FR-F9 rewritten for modes and options, FR-F7 marked superseded, Appendix A
  `filled_at`; AGENTS Project state; PLAN roster; journal.

### Roadmap

0. **s00 plan:** ✅ grill settled and stress-tested 2026-09-28.
1. **s01 batch:** ✅ 2026-09-28. migration 0006 + test; `VocabItem.filled_at`; `CheckOptions` and its parser;
   mode-aware selection, counts and payload; cap 50; tests.
2. **s02 apply:** ✅ 2026-09-28. scope rules (`ignored`), the legacy rule, per-mode stamps, `mode` on preview,
   apply and repeat; tests.
3. **s03 client:** ✅ 2026-09-28. options model + dialog; mode-aware `checkPrompt`; ignored line and mode
   wording in the sheets; tests.
4. **s04 retire fill-ins:** ✅ 2026-09-28. remove the FR-F7 client and Worker code and tests; PRD ripple;
   write `smoke-tests/smoke-test-13.md`; reword smoke-test-11's remaining steps (C1, D2) for
   the dialog's defaults and the new copy note.
5. **s05 phone:** ✅ 2026-10-02 (daily use). Sponsor applies 0005 (if not yet) and 0006 remotely, deploys, runs
   smoke-test-13; close.

In order: s02 needs s01's payload, s03 the options shape and responses, s04 the dialog that
replaces what it removes. The Worker/migration/input tests cover s01–s02, the client tests s03,
the suite s04, the phone s05.

## Status

### Recently Completed

- 2026-10-02: closed. 0006 applied remotely and deployed with f17; the sponsor reported the check working through the options dialog in daily use, which met smoke-test-13.
- 2026-09-28: s01–s04 built (`90f588a`, `6e2d574`, `bd3b7ed`, `d6c9fa2`); migration 0006 applied locally; `pnpm check` green at 548. The dialog has not been seen in a browser.
- 2026-09-28: stress-tested: 11 findings resolved by the agent, none escalated (see Decisions).
- 2026-09-28: drafted from the sponsor's request; grill settled (below).

### Next Steps

- None; closed 2026-10-02.

### Open Questions

- None open.

## Decisions

- 2026-09-28 (sponsor, grill): **one Check dialog** over a separate completeness pair or fixing
  the fill-in pair; the fill-in pair is removed. **One stamp per mode** (`checked_at`, new
  `filled_at`; both stamps both) over a shared stamp, so a completeness pass never makes an item
  look accuracy-checked. **Batch cap 50**, default 20.
- 2026-09-28 (agent): a new feature, not f11 scope: f11 is mid-smoke and this adds a migration,
  a dialog and a retirement. f11's in-flight batches stay valid (legacy rule above).
- 2026-09-28 (agent): the Worker, not the prompt, enforces mode and fields (ignored changes are
  reported, never ticked), so a chat that pads or overwrites can't slip a change through a
  default-on tick.
- 2026-09-28 (agent, stress test):
  - The draft's s01 held a migration, a parser, selection, scope rules and stamps; it is split into
    s01 batch and s02 apply.
  - Apply keeps `mode` and `fields` in the rewritten payload, or a repeat couldn't report its mode.
  - A legacy (f11) batch reports `mode: "correctness"`; an accept naming an ignored field is
    reported kept by f11's existing path rather than refused.
  - The dialog disables Copy prompt on invalid options instead of clamping, and each empty case
    has its own note.
  - The draft said the export validates `revised`; nothing does. It stays in `HANDOFF_STATUSES`
    because stored rows carry it.
- 2026-09-28 (agent, build):
  - Correctness candidates are items with at least one chosen field present, so an item with
    no text fields at all is left to completeness. f11's `{}` request inherits this; the one
    f11 test that relied on bare items now gives them an English meaning.
  - The f11 correction tests issue a `both` batch of every field, which allows every kind of
    change as an f11 batch did; the scope rules have their own tests.
  - `checkPrompt` lists every present field as context, even unchosen ones, and tells the chat
    they are context only.
  - The one conflict test the revisions route carried (an id used by the other kind of paste)
    now pastes a check batch's id as new vocab.
