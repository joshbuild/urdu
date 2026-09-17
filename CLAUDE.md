# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Primary Agent Instructions

@AGENTS.md

## Project state

Single-user personal Urdu learning PWA. See `pm/STATUS.md` for current progress. f01 s01–s06 provide the scaffold, shared rules, D1 schema, auth, vocab, review and export API; the PWA shell and deployment verification are next. `spikes/` is Phase 0 reference code, excluded from tsc and Biome.

Commands (pnpm; Node 22):
- `pnpm dev` — Vite dev server with the Worker and a local D1 (secrets from `.dev.vars`, see `.dev.vars.example`).
- `pnpm check` — tsc, Biome, Vitest (`shared` node project + `worker` Workers-pool project), build, client-bundle secret scan. Run before every commit.
- `pnpm test` / `pnpm lint` / `pnpm format` / `pnpm typecheck`.
- `pnpm types` — regenerate `worker/worker-configuration.d.ts` after editing `wrangler.jsonc`.
- `pnpm wrangler d1 migrations apply urdu --local` — local schema. `--remote`, `wrangler secret put`, and `pnpm run deploy` (not `pnpm deploy`, a pnpm built-in) are run by the sponsor.

Read `pm/VISION.md` (intent, invariants), `pm/PRD.md` (exact v0 scope and requirements, data model, Coach contract), and `pm/PLAN.md` (phases and Features Index) before any design or implementation work. Where PRD and VISION differ on scope, PRD wins. Project management uses the pm work-front regime: start sessions with `/pm-resume`, end with `/pm-wrap`, open work with `/pm-open`; `pm/STATUS.md` is the resume hub.

## Intended stack (directional, per VISION.md)

- TypeScript + Vite, lightweight responsive UI (likely React), PWA manifest.
- Cloudflare Workers for the API/domain layer; Cloudflare D1 for canonical data.
- Target deployment: `urdu.umber-amber.workers.dev`.
- Prefer boring, widely understood components. Offline-first is not a v0 goal.

## Architecture: four components

1. **Vocab Vault (D1)** — persistence only. Vocabulary terms/phrases, mastery state, review dates, review-event history, saved reading material. No business rules live here.
2. **Urdu Core (Cloudflare Worker)** — the domain layer. Owns auth, validation, normalization, duplicate detection, mastery transitions, review scheduling, vocabulary CRUD, due-vocab selection, Coach handoff import, and any AI enrichment. Exposes meaningful learning operations, not generic DB access. All clients go `client → Urdu Core → D1`; neither the PWA nor the Coach touches D1 or SQL directly.
3. **Coach (planned f06/f07)** — v0 uses in-app GPT-Live-1 voice, chosen by the Phase 0 spike (PRD FR-G Option 2). The Worker brokers WebRTC sessions with server-held credentials; tools use Urdu Core's Coach contract. The external Custom GPT is deferred to v1. Clipboard JSON handoff remains a fallback. Handoffs carry *events and proposals* (e.g. grade `correct`), never absolute mastery values, and include a session/handoff id for duplicate-import detection.
4. **PWA (this repo's UI)** — paste-and-read Urdu in Nastaliq (RTL), tap word → speak, select phrase → speak, right-click/long-press context menu (Speak / Add to vocab / Define), vocabulary browsing/editing, review UI, handoff import. Talks to Urdu Core over HTTP only. Must remain useful with no LLM call.

## Invariants to preserve

- **Deterministic code owns state transitions; AI only proposes.** Mastery changes, intervals, next-review calculation, IDs, timestamps, validation, and persistence are application logic in Urdu Core. AI may grade free-form answers, define, transliterate, suggest duplicates, or propose metadata.
- **Mastery ladder is a single source of truth** (do not duplicate in UI and backend): levels 0–6 = New/Learning/Basic/Firm/Strong/Stable/Permanent with intervals 0/1/5/25/125/625/3125 days. `Next Review = Last Reviewed + interval(mastery)`; never-reviewed items are due immediately.
- **Review grading:** Wrong −2, Partially correct −1, Hesitantly correct 0, Correct +1, Confidently correct +2; clamp to 0–6. A tracked review updates mastery, sets Last Reviewed, recalculates Next Review, and records a review event. Ad-hoc speaking/defining/viewing must **not** alter mastery.
- **Phrases are first-class vocabulary items**, not annotations on words. Check for duplicates/equivalents before creating an entry.
- **Auth is a single personal secret** validated server-side in the Worker, establishing a long-lived per-device session. The secret must never appear in frontend JS, the repo, URLs, or readable browser storage. Coach/tool auth to Urdu Core is separate and narrowly scoped.
- **Language target is everyday Pakistani Urdu**, with practical Roman Urdu transliteration and concise English explanations.
- v0 targets installed Android Chrome; desktop parity is v1. Keep layouts responsive and design touch, native text selection, and audio deliberately. PRD FR-C specifies the selection action bar rather than a custom long-press menu.

## Explicit non-goals (v0)

Multi-user, accounts/OAuth, offline-first, a dictionary or curriculum, a custom voice tutor built from scratch (the chosen GPT-Live-1 integration is allowed), social/billing/analytics features, or any infrastructure built "in case" a later version needs it. No LLM calls for Define/enrichment; the capped voice path is the exception for API spending.
