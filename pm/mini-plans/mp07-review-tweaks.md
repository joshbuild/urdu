# Mini-plan — Review tweaks (suss cards, search, conjugation, calendar)

**Status**: 🟡 IN PROGRESS — *opened 2026-10-22; s01–s04 built 2026-10-22; deploy (with migration 0009) and phone check next.*
**Handle**: `mp07`
**Created**: 2026-10-22 · **Updated**: 2026-10-22

**Owner docs it serves**:
- `pm/PRD.md` FR-E2 (review card), FR-D1 (vocab list), FR-F9 (check round trip), FR-J6 (review calendar), FR-L (topics)
- `shared/topics.ts` (the topic list), `shared/dash.ts` (calendar shading)
- `pm/DECISIONS.md` 261022a (suss flag; the conjugation topic)

> **One-line:** four sponsor tweaks from daily use, bundled because each is small and none has a
> vision of its own: flag questionable cards during review and send them to ChatGPT with a comment,
> put Vocab search where it is seen, add a grammar topic for verb conjugations, and shade the
> review calendar on to black at 400 reviews a day.

Sponsor request (2026-10-22, verbatim):
- review screen: suss button to mark cards as questionable and a place to see all suss cards, add a
  comment, with a copy prompt button where you can paste this into chat GPT and paste return JSON
- vocab search on vocab screen
- grammar category for verb conjugations
- colors on review calendar to go to black at 400 a day

---

## Design

**Suss (s04).** Migration 0009 adds `vocab.suss_at` (UTC instant the card was flagged, null when
not) and `vocab.suss_note` (the sponsor's comment, null when none). A flag is not an edit: like
`checked_at` and `released_at` it leaves `updated_at` alone, which matters because a grade is
guarded on `updated_at` — flagging mid-review must not make the next grade a 409. It never touches
the schedule.
- `PUT /api/vocab/:id/suss` `{ note }` flags (keeping the first `suss_at`) and sets the comment;
  `DELETE /api/vocab/:id/suss` clears both. `GET /api/vocab?suss=true` lists flagged cards, oldest
  flag first.
- Review card: a **Suss** button in the top action row opens a sheet with the comment box,
  **Mark suss** / **Save comment** and, once flagged, **Clear suss**. The card shows "Suss: comment"
  when flagged. Flagging doesn't advance the card; grade as usual.
- Vocab tab: a **Suss cards** button opens a Suss view listing every flagged card with its
  comment (editable), Open and Clear, plus **Copy suss prompt** and **Paste suss reply**.
- The round trip reuses the f11/f13 check batch: `POST /api/handoffs/check-batch` with
  `{ suss: true, count }` picks flagged cards (oldest flag first), forced to mode `both` over every
  fillable field, and records `suss: true` and the issue time in the batch. The prompt lists each
  card's comment and asks ChatGPT to judge each one against it. The reply pastes into the existing
  corrections preview, ticks and apply. Applying the batch also clears the flag on every card in
  it that was flagged before the prompt was issued (a card re-flagged after the copy keeps it).

**Search (s03).** Search already exists (f04) but sits below New item and the whole ChatGPT panel.
It moves to the top of the Vocab tab, and also matches notes and the example sentences.

**Conjugation topic (s02).** A new grammar topic `conjugation`, "Verb conjugation", after
`modals`: tense and person endings and the forms they make (karta hoon, kar raha hai, kiya,
karega, karo/kijiye, kare). Boundary: an inflected or tense form goes to conjugation; a verb's
dictionary form to its meaning's topic; vector pairs to compound-verbs. Quotas A1 12, A2 15, B1 10
(totals become A1 697, A2 970, B1 945). 51 topics. `prompts/vocab-tags.md` regenerates; the sponsor
re-uploads it to the ChatGPT Project.

**Calendar (s01).** Nine shades instead of five: 0, 1–9, 10–24, 25–49, 50–99, 100–174, 175–274,
275–399, then black from 400. The teal ramp darkens into black; counts turn white from 50.

## Slices

- **mp07-s01 calendar** — `calendarLevel` and its test, heat tokens and legend. Verify: dash tests, headless shot.
- **mp07-s02 conjugation** — `shared/topics.ts`, topic tests, regenerate `prompts/vocab-tags.md`.
- **mp07-s03 search** — move search to the top of the Vocab tab; server matches notes and examples. Verify: worker vocab test.
- **mp07-s04 suss** — migration 0009, API, review button and sheet, Suss view, suss check batch and prompt. Verify: worker tests for flag/clear/list/batch/apply, prompt test, headless shots.

## Done When

- [x] `pnpm check` green with s01–s04.
- [ ] Sponsor applies 0009 remotely (done, confirmed 2026-10-22) and deploys; re-uploads `prompts/vocab-tags.md` to the ChatGPT Project.
- [ ] Phone: flag a card mid-review with a comment, grade it, find it under Suss cards, run the suss
      prompt through ChatGPT, apply, and the card leaves the list. Daily use counts.

---

## Open Questions

- Was "vocab search" about the existing search being hard to find (assumed), or something else
  (e.g. look up a word not in the vault)? Sponsor to confirm on the phone.

## Decisions

- 2026-10-22: suss reuses the check batch rather than a new handoff kind, so the paste, preview,
  ticks, races and repeat handling stay one code path (DECISIONS 261022a).
- 2026-10-22: quotas for `conjugation` are the agent's estimate (A1 12, A2 15, B1 10); adjust freely.
