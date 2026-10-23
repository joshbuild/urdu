# Mini-plan — Check scope (topic & level, field mask, which words, vocab-json file)

**Status**: 🟡 IN PROGRESS — *opened 2026-10-22; s01 `checked_fields` and s02 Topic & level built 2026-10-22 (migration 0010, local only); s03 Which words next.*
**Handle**: `mp08`
**Created**: 2026-10-22 · **Updated**: 2026-10-22

**Owner docs it serves**:
- `pm/PRD.md` FR-F9 (check round trip), FR-L (topics), FR-E2 (suss round trip rides FR-F9)
- `shared/api.ts` (check fields and options), `shared/topics.ts` (validation of proposed topics)
- `prompts/` (`vocab-json.md`, `urdu-coach-project-instructions.md`)
- `pm/DECISIONS.md` 261022b

**Companions**: mp07 `review-tweaks` (added `conjugation`; suss rides the check batch), f18
`topic-coverage` (the Classify loop, which this leaves in place).

> **One-line:** four changes to the ChatGPT check loop and its prompts, bundled because they all
> serve one daily need (re-sorting words already in the vault, starting with the verb
> conjugations imported on 2026-10-22 before the `conjugation` topic existed) and share one code
> path: topic and level become check fields, a per-field checked mask replaces the all-or-nothing
> stamp, the batch can be chosen by when words were added or by topic, and `vocab-json` moves to
> a generated Project file.

Sponsor request (2026-10-22, paraphrased from the session): reclassify words that already have a
topic, by adding the topic check to the existing check loop rather than a separate reclassify;
filters such as last N added, added between two dates, latest N unchecked; split the `vocab-json`
prompt into a discrete md file like `vocab-tags.md`, with a trigger/pointer left in the
instructions; record which fields a check covered as a bitmask beside the date.

---

## Design

**Field mask (s01).** Migration 0010 adds `vocab.checked_fields INTEGER NOT NULL DEFAULT 0`. Each
check field has a fixed bit in `shared/api.ts`: roman 1, english 2, notes 4, example_urdu 8,
example_english 16, topic 32 (topic, cefr and tags as one field). Bits are immutable like ladder
ids: never renumbered or reused; a new field takes the next free bit.
- Applying a correctness or both batch ORs into every item in it the bits of the chosen fields
  the item has a value in once the batch's writes land, and stamps `checked_at` as now. It never
  clears a bit. An empty field is neither owed a check nor marked checked (261022c).
- `checked_at` keeps its meaning of last checked, any field; it orders the rotation. The mask
  answers *which* fields were ever checked: correctness's "only unchecked" becomes
  `(checked_fields & <ticked and present>) != <ticked and present>`, any ticked field the item
  has not yet checked. Both mode uses the same test in place of `checked_at IS NULL`. The
  rotation ranks an item owing a check with the never-checked, then by `checked_at`.
- Backfill: items with `checked_at` set get the bits of the content fields they have now (the
  dialog defaulted to every field, and the batches don't say which items were applied under which
  fields cheaply enough to be worth replaying). The topic bit starts clear everywhere.
- Completeness is unchanged: `filled_at` stays, and a missing field shows as null, so it needs no
  mask.
- A second `last_checked_fields` column was considered and rejected: each batch's ids, mode and
  fields are already in `handoffs.payload`, so the history is on record (DECISIONS 261022b).

**Topic & level as a check field (s02).** `topic` joins the check dialog's fields as **Topic &
level**, covering `topic`, `cefr` and `tags`.
- Correctness asks whether `topic` is the slug from the list where the entry belongs most, the
  level honest, and the tags right; completeness supplies a missing topic or level (tags are
  never "missing"). With the field ticked the prompt carries the topic list and boundaries, as
  `classifyPrompt` does.
- The Worker validates a proposed topic, level or tags as pastes are validated (FR-L, lenient):
  an unknown slug or level is dropped and noted on the row. AI proposes; Urdu Core writes. No
  schedule change, and like every check field it goes through the FR-D2 edit rules and guards.
- The preview sheet shows `topic`, `cefr` and `tags` changes as old → new rows with their own
  ticks, using topic labels.
- The suss batch (mp07: mode both, every field) gains `topic` too.
- The Classify loop on the Harvest tab stays as the cheap 100-a-time pass for unclassified words.

**Which words (s03).** `CheckOptions` gains `scope` and an optional `topic`:
- `scope: "rotation"` (default, today's order: least recently checked first, per mode),
  `"newest"` (`added_at` descending: the last N added), or `"added"` with `from`/`to` local dates
  (HOME_TZ, inclusive; oldest first within the range).
- `topic`: a slug narrows any scope to words with that topic; absent means all.
- "Only unchecked" applies on top of any scope, so "latest N unchecked" is newest + only
  unchecked. Count stays 1–50; a big set takes several rounds, each advancing because applying
  sets the ticked bits.
- The dialog gains a **Which words** select, the two date inputs when "Added between" is chosen,
  and a topic select. Options stay remembered per device; an old stored value decodes to the
  defaults for the new keys. The counts line ("N of M") reflects the scope.

**`vocab-json` as a Project file (s04).** `prompts/vocab-json.md` becomes the single source of the
`vocab-json` rules, generated by `scripts/write-vocab-json.ts` from the same constants as
`newVocabPrompt` (field rules, conventions, JSON shape) and pinned by a test, as `vocab-tags.md`
is. `urdu-coach-project-instructions.md` keeps a short `vocab-json` trigger that points to the
file ("when I type `vocab-json`, follow `vocab-json.md` in this Project's files") instead of the
full copy. The sponsor uploads `vocab-json.md` to the Project's files and re-pastes the
instructions. The slice first diffs the three copies (in-app prompt, `vocab-json.md`,
instructions): where their content differs, the daily-used `vocab-json.md` wording (fixed
2026-10-02 to require every field) wins, so the in-app new-vocab prompt may change slightly.
Only the `vocab-json` section is generated: the Aim, Interaction Style and Scoring sections are the
sponsor's own wording (2026-10-22 they added "Speak to me in Urdu fairly slowly" and "or say
things in an odd way", now in the repo copy) and stay hand-kept.
Risk: ChatGPT follows instructions more reliably than files; the trigger line in the
instructions is the hedge, and the first real run after the change is the check.

---

## Slices

- **mp08-s01 checked-fields** — migration 0010 with backfill, bit constants in `shared/api.ts`,
  apply ORs the mask, "only unchecked" uses it. Verify: worker check tests (mask set and ORed,
  unchecked by field, backfill shape), `pnpm wrangler d1 migrations apply urdu --local`.
- **mp08-s02 topic-field** — `topic` check field end to end: shared types, Worker parse/scope/
  lenient validation/apply, prompt with the topic list, dialog tickbox, preview rows, suss
  includes it. Verify: worker apply tests (good slug, unknown slug dropped and noted, level,
  tags), prompt test, headless dialog and preview at 360 px. Depends on s01 (bit 32).
- **mp08-s03 which-words** — `scope`/`from`/`to`/`topic` in options, parse, selection SQL,
  dialog, decode of old stored options. Verify: worker selection tests per scope and topic, with
  and without only unchecked; client `checkOptions` tests; headless dialog shot.
- **mp08-s04 vocab-json-file** — generator script and pinning test, regenerated
  `vocab-json.md`, trigger line in the instructions, ripple PRD/AGENTS (commands list). Verify:
  scripts test; prompt tests still green.

## Done When

- [ ] `pnpm check` green with s01–s04. (s01: green 2026-10-22, 859 tests; s02: green, 874.)
- [ ] Sponsor applies 0010 remotely and deploys (after 0009, mp07); uploads `prompts/vocab-json.md`
      to the ChatGPT Project's files and re-pastes the instructions.
- [ ] Phone: a Topic & level check over the 2026-10-22 conjugation imports (by date or by their
      current topic) runs through ChatGPT, applies, and their chips read Verb conjugation. Daily
      use counts.
- [ ] One real `vocab-json` run after the change returns complete JSON that pastes cleanly.

---

## Open Questions

- None open. The topic filter in Which words is included on the agent's recommendation
  (2026-10-22); drop it at review if it isn't used.

## Decisions

- 2026-10-22: topic is a check field rather than a separate reclassify loop (sponsor), so the
  preview, ticks, guards and repeat handling stay the check's one code path.
- 2026-10-22: one OR-accumulated `checked_fields` mask beside `checked_at` (sponsor's proposal);
  a second "last checked fields" mask rejected as duplicating `handoffs.payload` (agent,
  sponsor asked for the assessment). DECISIONS 261022b.
- 2026-10-22: existing checked items backfill to the bits of their present content fields; topic
  starts unchecked. Bits count only for fields with a value (DECISIONS 261022c, found in s01).
- 2026-10-22: `vocab-json.md` generated and pinned; instructions keep a trigger line (sponsor).
- 2026-10-22 (s02, agent): Topic & level is off in the default options, so the everyday check
  prompt stays short; the remembered options keep it once ticked. A topic or level the paste
  names but the list lacks proposes nothing (never a removal); an explicit null removes. Topic &
  level counts as present once the item has a topic, missing while it lacks a topic or level.
