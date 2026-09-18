# Feature Plan — Coach Contract

**Status**: 🟡 IN PROGRESS — *opened 2026-09-18 at Stage 1 (paste path for new vocab), ahead of f05/f09 closing, at the sponsor's request.*
**Handle**: `f06`
**Created**: *2026-09-18* · **Updated**: *2026-09-18*

**Owner docs it serves**:
- `pm/PRD.md` — FR-B3, FR-F1..F7, Appendix A `handoffs`
- `pm/DECISIONS.md` — 260911a (contract), 260918f (ChatGPT paste path first), 260918g (fill-in round trip)

> **One-line:** Urdu Core's Coach contract and the clipboard handoff, built paste-path first: Copy prompt → ChatGPT web chat → paste JSON, for new vocab and for filling in incomplete items, applied deterministically.

## Intent

### Vision

Vocab drafting should cost nothing beyond the ChatGPT subscription. The app hands the chat a fixed prompt, the chat returns strict JSON, and Urdu Core validates and applies it. The AI proposes, deterministic code decides. The same contract later serves the in-app voice Coach (f07) over bearer-authenticated routes.

### Scope

- **Stage 1: new vocab (FR-F2, F4, F6).** A Copy prompt button, an in-repo prompt, a Paste-handoff screen and a session-cookie route that imports `{handoff_id, session_at, proposals}` through the FR-F2 logic. Duplicates are rejected with the existing id, and each item gets its own outcome. A repeated `handoff_id` is a no-op that returns the stored outcome, using the existing `handoffs` table.
- **Stage 2: fill-in (FR-F7).** Copy fill-in prompt (up to 20 incomplete items with their present fields) and Paste revisions, previewed per item. It fills empty fields only, the echoed `urdu` must match the stored item, and scheduling is untouched.
- **Stage 3: Coach routes (FR-F1, F3, F5, FR-B3).** Bearer-token `/coach/*` routes, review `results` in handoffs, OpenAPI description. Built with or just before f07.

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

- Stages 1–2 are verified on the phone with a real ChatGPT round trip. Stage 3 is verified with the f07 Voice client, and `pnpm check` is green.

### Roadmap

1. Stage 1: prompt + handoff import route + Paste-handoff screen.
2. Stage 2: fill-in prompt + revisions route with preview.
3. Stage 3: bearer auth, `/coach/*` routes, results, OpenAPI (with f07).

## Status

### Recently Completed

- 2026-09-18: opened.

### Next Steps

- Stage 1: define the handoff JSON schema and its `handoffs.status` values, then write the prompt and the import route with Worker tests.

### Open Questions

- Where the buttons live: Stage 1's Copy prompt / Paste on the Vocab screen bottom beside Stage 2's, or a separate Handoff screen. Agent default: the Vocab screen bottom, all four together.

## Decisions

- 2026-09-18: Stages 1–2 use the PWA session cookie, not the Coach bearer token. The sponsor is the one pasting, so FR-B3's bearer applies only to the Stage 3 `/coach/*` routes.
