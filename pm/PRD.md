# PRD - Urdu PWA
*v0.1 | 2026-09-11*

**File Purpose**: Authoritative reference for scope and requirements. `VISION.md` says why and what shape; this doc says exactly what v0 must do. Where the two disagree, this doc wins for scope and the vision wins for intent. Decisions behind each requirement are in `DECISIONS.md` (session 260911a).

## 1. Introduction

### 1.1 Purpose
Define the v0 deliverable for a single-user Urdu learning PWA: read pasted Urdu in Nastaliq, hear it, save vocabulary, review it on a mastery ladder, and keep one canonical vocabulary vault that both the PWA and a ChatGPT-based Coach read and write.

### 1.2 Background
The sponsor already learns Urdu with (a) a ChatGPT "Urdu Coach" project used mainly in Voice mode and (b) an Airtable base "Urdu Vocab" holding vocabulary with a 0-6 mastery ladder. Two frictions drive this project: reading real Urdu text with instant speech and lookup, and getting words that come up in Voice conversation into the vault without manual re-entry. The vault moves from Airtable to Cloudflare D1 behind a Worker ("Urdu Core"); the Coach connects to that Worker. See `VISION.md` for the four-component architecture and invariants.

## 2. Scope

### 2.1 In Scope (v0)
1. **Urdu Core** (Cloudflare Worker) with D1 schema, mastery/scheduling rules, unlock auth, vocab CRUD, due selection, Coach tool contract, handoff import, admin import endpoint.
2. **One-time Airtable import** of the existing "Urdu Vocab" base into D1, preserving mastery and last-reviewed dates.
3. **PWA on Android Chrome (installed)**: unlock, paste-and-read in Nastaliq, tap-to-speak, selection action bar (Speak / Add to vocab / Define), vocab browse/search/edit, review session with self-grading, clipboard handoff paste.
4. **Coach connection**: the three-operation tool contract exposed by Urdu Core, the clipboard JSON handoff as fallback, and one Coach client chosen by the Phase 0 spike: either a private Custom GPT with Actions or in-app voice via the OpenAI GPT-Live-1 Realtime API.
5. **Two spikes** before build: browser speech on the sponsor's phone; GPT-Live-1 feasibility (see FR-G and Appendix D).

### 2.2 Out of Scope (v0)
- Windows/desktop Chrome parity (staged to v1; v0 layout stays responsive and avoids touch-only assumptions).
- Any LLM call from the PWA or Worker for defining/enriching text (Define is vault lookup + external dictionary links; enrichment happens in ChatGPT).
- Hosted TTS (only if the speech spike fails; behind the same `speak()` interface).
- Saved reading passages, reading history, tag management UI, favourites UI, statistics, undo of a review grade, mixed-direction review, fuzzy duplicate suggestions, approval queue for Coach proposals.
- Everything in `VISION.md` §16 (multi-user, accounts, offline-first, dictionary, curriculum, custom voice tutor built from scratch, analytics, billing). The §16 line on a custom voice tutor is amended: in-app voice using OpenAI's GPT-Live-1 API is permitted because it is the same model family as ChatGPT Voice and allows vault tool calls mid-conversation.

### 2.3 Assumptions
- Sponsor's phone is Android with Chrome; Google TTS provides two local Urdu voices out of the box, `ur_PK` (Urdu Pakistan, preferred) and `ur_IN`. Verified by mp01 on 2026-09-14: median tap-to-speech 60 ms, sponsor rates ur_PK 3.5/5, works installed (standalone). Android reports voice `lang` with underscores (`ur_PK`), not BCP-47 hyphens.
- Sponsor's ChatGPT Plus subscription covers Custom GPTs with Actions; API usage (GPT-Live-1) is paid separately and capped by the sponsor at about $0.50/day.
- Airtable export is available as CSV with record IDs.
- Cloudflare account exists; target host `urdu.umber-amber.workers.dev`.
- Home timezone for scheduling is America/Vancouver.

### 2.4 Constraints
- **Hard**: TypeScript; Cloudflare Workers + D1; single personal secret auth per `VISION.md` §12; no client touches D1 except Urdu Core; deterministic code owns all state transitions; mastery ladder and grade deltas exactly as `VISION.md` §6; no paid LLM credits except the capped GPT-Live-1 voice path if it wins the spike.
- **Soft**: React + Vite; Hono or plain fetch router; Biome; Vitest; prefer boring components; single package, no monorepo.

## 3. Stakeholders & Users
- **Sponsor**: the app owner (single user, Vancouver).
- **Users**: the sponsor only. Two client roles talk to Urdu Core: the human via PWA session cookie, and the Coach via a separate bearer token.

## 4. Use Cases & User Stories
1. As the learner, I paste Urdu text on my phone and read it in Nastaliq, tapping any word to hear it, so that unfamiliar text becomes approachable.
2. As the learner, I select a phrase and speak it, add it to my vocab, or define it, so that useful language is captured while reading.
3. As the learner, I open Review and grade due items one at a time, so that mastery and next-review dates update immediately.
4. As the learner, I browse, search, and edit my vocabulary, including fixing a mis-graded item's mastery.
5. As the learner, I unlock the app once per device and never see a login again.
6. As the learner, after a Voice session with my Coach I say "add those to my vault" (or paste a JSON handoff), so that new words and quiz results land in D1 without re-typing.
7. As the learner, my Coach fetches due vocabulary from the vault before a Voice quiz, so that both surfaces share one learning state.
8. As the sponsor, I run the Airtable import once and see my existing mastery and review dates preserved.

## 5. Functional Requirements

### FR-A Urdu Core: data and rules
- **FR-A1** D1 schema per Appendix A: `vocab`, `review_events`, `handoffs`, `tags`, `sessions`, with D1 migrations under `migrations/`.
- **FR-A2** Mastery ladder, intervals, and grade deltas live once in `shared/` and are the only implementation used by the Worker; the UI imports them for display only.
- **FR-A3** `next_review_on = last_reviewed_on + interval(mastery)` in whole days, computed in the configured home timezone; never-reviewed items are due immediately. Stored on the row and indexed.
- **FR-A4** Recording a tracked review: apply delta, clamp 0-6, set `last_reviewed_on` to today, recompute `next_review_on`, insert a `review_events` row with mastery before/after, grade, direction, source, optional handoff id. Atomic.
- **FR-A5** Urdu normalization (Appendix B) produces `urdu_key`; an insert whose key matches an existing row is rejected with the existing id. Applies to PWA adds, Coach proposals, and import.
- **FR-A6** Vocab CRUD: create, read, list (search by Urdu/Roman/English substring, filter by tag, due-only, sort), update any editable field including mastery, delete.
- **FR-A7** Due selection: items with `next_review_on <= today` or never reviewed, ordered `next_review_on asc, added_at asc`, with limit and optional tag filter.
- **FR-A8** Viewing, speaking, defining, or skipping never changes mastery or review dates.

### FR-B Auth and sessions
- **FR-B1** `POST /api/unlock` with the personal secret; constant-time compare against a Worker secret; on success create a random session token, store its hash in `sessions`, return it as an `HttpOnly; Secure; SameSite=Strict` cookie with about 1 year expiry.
- **FR-B2** All `/api/*` routes used by the PWA require a valid session cookie. Deleting a `sessions` row revokes that device.
- **FR-B3** Coach operations (FR-F) accept only a separate bearer token from Worker secrets, and that token is accepted nowhere else. The PWA cookie is not accepted on Coach routes.
- **FR-B4** The secret and tokens never appear in frontend JS, the repo, URLs, or readable browser storage.
- **FR-B5** If in-app voice ships (FR-G option 2), the Worker mints a short-lived OpenAI client secret per voice session for the browser; the OpenAI API key lives only in Worker secrets.

### FR-C Reader (PWA)
- **FR-C1** Paste area accepting arbitrary Urdu text; pasted newlines become paragraphs; RTL layout.
- **FR-C2** Rendered in self-hosted Noto Nastaliq Urdu with large size and about 2.2 line height; no dependency on device fonts.
- **FR-C3** Text is tokenized on whitespace and punctuation, keeping ZWNJ-joined compounds as one token; each token is a tappable element. Native browser text selection across tokens must still work.
- **FR-C4** Tap on a token speaks it via a `speak(text)` interface backed by browser SpeechSynthesis, using the voice chosen in Settings (list of available Urdu voices; default = first voice whose `lang` normalised to lowercase with `_`→`-` equals `ur-pk`, else any `ur-*`; never the browser default, which on the sponsor's phone is Assamese). `speak()` cancels any queued utterance first, and may pre-warm a newly selected voice, since the first utterance per voice costs ~1 s.
- **FR-C5** When any text is selected, a floating action bar appears above the selection with Speak, Add to vocab, Define. No custom long-press handler; native selection handles are not overridden.
- **FR-C6** Add to vocab opens a form prefilled with the selected Urdu (or tapped token), kind inferred (phrase if it contains whitespace), and the source sentence in notes; user fills Roman/English/notes/example/tags; save calls FR-A6 and surfaces a duplicate rejection inline with a link to the existing item.
- **FR-C7** Define: first looks up the vault by `urdu_key` and shows the existing entry if found; otherwise offers external dictionary links opening in a new tab (Rekhta dictionary, Wiktionary, Google Translate) with the term prefilled. No LLM call.
- **FR-C8** Current text persists in localStorage across reloads. No server persistence of texts in v0.

### FR-D Vocabulary UI
- **FR-D1** List with search (Urdu/Roman/English), tag filter, due-only toggle, sort by added/next review/mastery.
- **FR-D2** Item view shows all fields, mastery level name, last/next review, and a speak button; edit any field including mastery (which recomputes next review); delete with confirmation.
- **FR-D3** Manual "new item" entry from the vocab screen using the same form as FR-C6.

### FR-E Review
- **FR-E1** Session start: choose direction (Urdu to English default, English to Urdu) and see the due count; queue per FR-A7 capped at a per-session limit (default 20, adjustable in Settings).
- **FR-E2** Card front shows the prompt side with a speak button whenever Urdu is showing; Reveal shows Urdu, Roman, English, notes, example.
- **FR-E3** Five grade buttons in ladder order (Wrong, Partially correct, Hesitantly correct, Correct, Confidently correct); tapping records via FR-A4 and advances. Skip advances without recording.
- **FR-E4** End of session shows counts graded and skipped. No streaks or statistics.

### FR-F Coach tool contract and handoff
- **FR-F1** `GET /coach/vocab` returns due items by default (or all, tag filter, limit) with id, urdu, roman, english, mastery, next_review_on.
- **FR-F2** `POST /coach/propose` accepts candidates `{urdu, roman?, english?, notes?, example_urdu?, tags?}`; each is created immediately at mastery 0 with `source=coach`, or rejected as duplicate with the existing id. Returns per-candidate outcomes. No approval queue.
- **FR-F3** `POST /coach/reviews` accepts `{handoff_id, session_at, results:[{vocab_id?|urdu?, grade, direction}]}`; resolves each by id then by `urdu_key`; applies FR-A4 to matched items; returns unmatched or ambiguous results flagged, never guessed. A repeated `handoff_id` is a no-op returning the original outcome.
- **FR-F4** The clipboard handoff is a single JSON document carrying `handoff_id`, `session_at`, optional `proposals` (FR-F2 shape) and optional `results` (FR-F3 shape). The PWA has a Paste-handoff screen that validates, submits through the same Worker logic, and shows per-item outcomes.
- **FR-F5** An OpenAPI 3.1 description of FR-F1..F3 is maintained in-repo for use as the Custom GPT Action schema.

### FR-G Coach client (one of two, chosen by the Phase 0 spike)
- **Option 1: Custom GPT.** A private ("Only me") Custom GPT "Urdu Coach GPT" carrying the current Coach instructions plus Actions bound to FR-F with bearer auth. Voice sessions run in its voice mode; vault operations run in text chat after the session.
- **Option 2: In-app voice.** A Voice screen in the PWA connecting over WebRTC to GPT-Live-1 using a Worker-minted client secret (FR-B5), with the Coach system prompt maintained in-repo, and tools bound to FR-F1..F3 callable mid-conversation. Per-session and daily spend visible in Settings; a soft daily cap (default $0.50) warns and a hard cap ends the session.
- **Selection rule**: Option 2 ships if the spike passes all four criteria in Appendix D; otherwise Option 1 ships and Option 2 is deferred to v1.

### FR-H Airtable import
- **FR-H1** `scripts/airtable-import.ts` reads the Airtable CSV export(s) and posts batches to `POST /api/admin/import` (session-cookie or admin-token protected). Idempotent by `airtable_id`; re-running updates rather than duplicates.
- **FR-H2** Field mapping per Appendix C. `Next Review` and `Review Interval Days` are recomputed, not imported; the script reports any row where the recomputed next review differs from Airtable's value.
- **FR-H3** Tags table imported from the Airtable Tags table (name, description). Mastery Levels table is not imported.

### FR-I Settings
- **FR-I1** Voice picker for speech; review session limit; lock this device (deletes the session); if Option 2 ships, voice spend display and caps.

## 6. Non-Functional Requirements
- **Latency**: tap-to-speech start under 300 ms on the phone; API round trips under 500 ms p95 from Vancouver.
- **Reliability**: review recording is atomic; a failed request never leaves mastery and events inconsistent.
- **Security**: per `VISION.md` §12 and FR-B; all traffic HTTPS; Coach token scoped to FR-F only.
- **Cost**: Cloudflare free or minimum paid tiers; no LLM spend except capped GPT-Live-1 if selected.
- **Portability**: `GET /api/export` returns the full vault as JSON; CSV export deferred.
- **Maintainability**: domain rules in `shared/` with Vitest coverage for ladder, deltas, clamping, scheduling across DST, normalization, and duplicate detection; single `pnpm dev` and `pnpm deploy`.
- **Mobile**: usable one-handed on a phone; hit targets at least 44 px; installed-PWA manifest with icons; no offline data caching.

## Appendix A — Data model (D1)
- `vocab`: id (ULID) · urdu · urdu_key · kind (word|phrase) · roman · english · notes · example_urdu · example_english · tags (JSON array of names) · favourite (0/1) · mastery (0-6) · added_at · last_reviewed_on (date, nullable) · next_review_on (date, nullable = due now) · source (reading|coach|airtable|manual) · airtable_id (nullable, unique) · created_at · updated_at. Unique index on urdu_key; index on next_review_on.
- `review_events`: id · vocab_id · reviewed_at · grade (wrong|partial|hesitant|correct|confident) · mastery_before · mastery_after · direction (ur_en|en_ur|oral) · source (pwa|coach) · handoff_id (nullable).
- `handoffs`: id (Coach-supplied) · imported_at · payload (JSON) · status · outcome (JSON).
- `tags`: name (PK) · description.
- `sessions`: id · token_hash · created_at · last_seen_at · label.

## Appendix B — Urdu normalization for `urdu_key`
NFC normalize; strip tashkeel (U+064B to U+0652, U+0670) and tatweel (U+0640); map Arabic yeh U+064A to Urdu yeh U+06CC, Arabic kaf U+0643 to U+06A9, Arabic heh U+0647 to U+06C1, teh marbuta U+0629 to U+06C1; remove ZWNJ/ZWJ (U+200C/U+200D) and other format characters; strip punctuation; collapse whitespace to single spaces; trim. Equality on the result is "duplicate". Fuzzy matching is out of scope.

## Appendix C — Airtable to D1 field mapping
| Airtable (Vocabulary Terms) | D1 `vocab` |
|---|---|
| record id | airtable_id |
| Urdu Term | urdu (urdu_key computed) |
| Urdu Transliteration | roman |
| English Term | english |
| Meaning | notes |
| Example | example_urdu |
| Tags | tags (names) |
| Added | added_at |
| Mastery Score (e.g. "1-Learning") | mastery = leading digit |
| Last Reviewed | last_reviewed_on |
| Next Review, Review Interval Days | not imported; recomputed and cross-checked |
| (none) | kind = phrase if term contains whitespace else word; favourite = 0; source = airtable |

## Appendix D — GPT-Live-1 spike pass criteria
1. A throwaway page on Android Chrome (installed PWA context) establishes a WebRTC session to GPT-Live-1 using a Worker-minted client secret.
2. Ten minutes of Urdu conversation is judged by the sponsor as comparable to ChatGPT Voice.
3. A tool call ("add X to my vault") executes mid-conversation against a stub of FR-F2 and the conversation resumes.
4. Measured cost for the ten minutes, including backend and tool charges, is at most $0.60. *(Amended 2026-09-14 from $0.50: GPT-Live-1 voice alone is $0.05/min, so $0.50 was the voice-only floor; see DECISIONS 260914b.)*

All four pass leads to FR-G Option 2. Any fail leads to Option 1. Also run, cheaply: one Urdu voice session inside a private Custom GPT to judge its Advanced Voice Mode quality, since that is Option 1's voice surface.
