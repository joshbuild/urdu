# Feature Plan — Coach Contract

**Status**: 🟢 SHIPPED — *closed 2026-09-23. Stages 1–2 done; smoke-test-06 green on the phone (B1–B2 waived for the `vocab-json` path). Stage 3 re-homed (DECISIONS 260918h): FR-F1/F3 logic to f07, bearer routes and OpenAPI to v1.*
**Handle**: `f06`
**Created**: *2026-09-18* · **Updated**: *2026-09-23*

**Owner docs it serves**:
- `pm/PRD.md` — FR-B3, FR-F1..F7, Appendix A `handoffs`
- `pm/DECISIONS.md` — 260911a (contract), 260918f (ChatGPT paste path first), 260918g (fill-in round trip)

> **One-line:** Urdu Core's Coach contract and the clipboard handoff, built paste-path first: Copy prompt → ChatGPT web chat → paste JSON, for new vocab and for filling in incomplete items, applied deterministically.

> **As shipped (2026-09-23).** A CHATGPT section at the top of the Vocab tab: Copy prompt / Paste new vocab (FR-F2, F4, F6) and Copy fill-in prompt / Paste fill-ins with preview (FR-F7). In daily use the new-vocab path starts from the sponsor's ChatGPT "Urdu Coach" Project, whose standing instructions add a `vocab-json` command (`src/handoff/chatgpt-project-instructions.md`); the chat mints its own `handoff_id`. Live truth: `worker/domain/handoff*.ts`, `worker/routes/api-handoff.ts`, `src/handoff/`, tests `test/handoff.test.ts` and `src/handoff/prompts.test.ts`; decisions 260918f, 260918g, 260918h and §Decisions below. Evidence: `smoke-tests/archive/smoke-test-06_archive.md`. Two polish fixes from the smoke (buttons above the list, fill-in recount after save) are committed and ride the next deploy. The execution record below is historical.

## Intent

### Vision

Vocab drafting should cost nothing beyond the ChatGPT subscription. The app hands the chat a fixed prompt, the chat returns strict JSON, and Urdu Core validates and applies it. The AI proposes, deterministic code decides. The same contract later serves the in-app voice Coach (f07) over bearer-authenticated routes.

### Scope

- **Stage 1: new vocab (FR-F2, F4, F6).** A Copy prompt button, an in-repo prompt, a Paste-handoff screen and a session-cookie route that imports `{handoff_id, session_at, proposals}` through the FR-F2 logic. Duplicates are rejected with the existing id, and each item gets its own outcome. A repeated `handoff_id` is a no-op that returns the stored outcome, using the existing `handoffs` table.
- **Stage 2: fill-in (FR-F7).** Copy fill-in prompt (up to 20 incomplete items with their present fields) and Paste revisions, previewed per item. It fills empty fields only, the echoed `urdu` must match the stored item, and scheduling is untouched.
- ~~**Stage 3: Coach routes (FR-F1, F3, F5, FR-B3).**~~ Re-homed 2026-09-18 (260918h): FR-F1/F3 logic is built in f07 behind cookie routes; bearer `/coach/*` routes and the FR-F5 OpenAPI description are v1.

### Exclusions

- ChatGPT calling Urdu Core directly (Custom GPT Action or MCP connector) is deferred (260918f). ChatGPT never touches D1.
- Overwriting existing fields through revisions (260918g).
- f08's API enrichment is on hold.

### User Stories

- As the learner, I copy a prompt, ask ChatGPT about new words, and paste its JSON into the app, so the words land in the vault without typing and without API spend.
- As the learner, I copy my incomplete items into ChatGPT and paste back its fill-ins, previewing them before they save.

### Non-Functional Requirements

- Strict validation. Invalid JSON is rejected with a readable reason and never repaired.
- Idempotent by `handoff_id`.
- No new secrets in Stages 1–2. They use the existing session cookie and the JSON Content-Type CSRF rule (260918a).

## Planning

### Testing

- Worker tests: valid import, duplicate against the vault, duplicate within one payload, repeated `handoff_id`, malformed payloads (each rejected with its reason), revision rules (empty-only, `urdu` mismatch, unknown id, schedule untouched).
- Client tests: prompt text contains the schema, and the paste parser's error messages.
- Phone smoke test: full ChatGPT round trip for both stages.

### Done When

- Stages 1–2 are verified on the phone with a real ChatGPT round trip. `pnpm check` is green.

### Roadmap

1. Stage 1: prompt + handoff import route + Paste-handoff screen.
2. Stage 2: fill-in prompt + revisions route with preview.
3. ~~Stage 3~~ re-homed (260918h).

## Status

### Recently Completed

- 2026-09-18: opened.
- 2026-09-23: smoke-test-06 green (B5–B7, C1–C6, D1); fixed the two smoke findings (buttons moved above the list; fill-in note recounts after save). Closed.
- 2026-09-23: `vocab-json` Project instructions; first real ChatGPT paste on the phone added words (smoke-test-06 A1, B3–B4).
- 2026-09-18: Stages 1–2 built. `POST /api/handoffs`, `POST /api/handoffs/revisions[?preview=1]` and `GET /api/vocab/incomplete` (`worker/domain/handoff*.ts`, `worker/routes/api-handoff.ts`); prompts and paste parsing in `src/handoff/prompts.ts`; `HandoffPanel` under the Vocab list. 28 Worker + 9 client tests. `smoke-tests/smoke-test-06.md` written (now `smoke-tests/archive/smoke-test-06_archive.md`).

### Next Steps

- None; closed 2026-09-23. The phone check of the two polish fixes is a TODO item.

### Open Questions

- None open. (Button placement: first the agent default, all four at the bottom of the Vocab list; moved above the list 2026-09-23 after smoke-test-06, since a long list buried them.)

## Decisions

- 2026-09-18: Handoff contract as built. The app writes a fresh ULID `handoff_id` (and `session_at`) into each copied prompt, and the chat echoes them back, so a re-paste is a no-op. `handoffs.status` is `applied` (proposals) or `revised` (fill-ins). An id reused by the other kind of paste is a 409. A payload with any invalid field is rejected whole with the field path (`proposals[2].roman`) and no handoff row, so a corrected reply can reuse the id. Per-item outcomes are only for vault facts: created, duplicate, or no Urdu letters. `results` is refused until Stage 3. A surrounding markdown code fence is stripped client-side as packaging; the JSON inside is never repaired.
- 2026-09-18: Fill-ins also cover `example_english` (FR-F7 lists four fields; the fifth is the same kind of empty text). The echoed `urdu` is matched by `urdu_key`, so tashkeel differences don't reject a row. Fills use `COALESCE`, so text written between preview and save is never overwritten. The incomplete list puts items missing Roman or English first, max 20.
- 2026-09-23: Standing ChatGPT Project instructions (`src/handoff/chatgpt-project-instructions.md`) with a `vocab-json` command. The chat mints its own `handoff_id` because there is no Copy prompt step; the contract already accepts any non-empty id, so no code changed. A reused id reads as "already imported", which is safe. Kept in step with `newVocabPrompt` by hand.
- 2026-09-18: Stages 1–2 use the PWA session cookie, not the Coach bearer token. The sponsor is the one pasting, so FR-B3's bearer applies only to the Stage 3 `/coach/*` routes.
- 2026-09-18: Stage 3 leaves f06 (sponsor, DECISIONS 260918h). Voice tools run through cookie routes in f07, so nothing in v0 calls bearer routes; they and the OpenAPI description go to v1 with the Custom GPT. Handoff `results` stay refused.
