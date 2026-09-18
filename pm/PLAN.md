# Plan - Urdu PWA
*v0.1 | 2026-09-11*

**File Purpose**: High-level development roadmap (phases) **and** the canonical **Features Index** roster. Rolling-wave: current/next phases carry more detail, later phases stay coarse. Not implementation detail — detailed work fronts live in their own docs under `pm/features/`, referenced here. Requirements are in `PRD.md`; the FR-x references below point there.

## Roadmap

| Phase | Name | Goal |
|---|---|---|
| 0 | Spikes | Prove speech on the phone and decide the Coach client with evidence. |
| 1 | Foundation | Urdu Core deployed with the sponsor's real vocabulary in D1 and unlock working. |
| 2 | Learning surfaces | Reader, vocab, and review usable daily on the phone. |
| 3 | Coach connection | Vault reachable from the Coach; v0 complete. |
| 4 | v1 | Desktop parity and the deferred conveniences. |

## Phases

### Phase 0 — Spikes (✅ Done 2026-09-14)
**Goal:** Remove the two unknowns that could change the build before any product code exists. Throwaway code only.
- mp01 `speech-spike` (✅ PASS 2026-09-14): a static page listing SpeechSynthesis voices on the sponsor's Android phone, speaking sample Urdu words and a phrase; record voice name, latency, and acceptability. Fallback decision: hosted TTS behind `speak()` in v1 if unacceptable.
- mp02 `gpt-live-spike` (✅ PASS 2026-09-14 → FR-G Option 2): a throwaway Worker route brokering a GPT-Live-1 WebRTC session plus a page run installed on the sponsor's Android phone; all four `PRD.md` Appendix D criteria passed. The Custom GPT comparison was skipped as moot once Option 2 was chosen.
- Repo skeleton is allowed here only as far as the spikes need it (wrangler config, a Worker with one route).
- **Exit:** Speech verdict recorded; FR-G option chosen and recorded in `DECISIONS.md`; `PRD.md` FR-G updated to name the chosen option.

### Phase 1 — Foundation (Current)
**Goal:** A deployed Urdu Core with the sponsor's vocabulary in it.
- f01 `urdu-core-foundation` (✅ SHIPPED 2026-09-17): repo layout (`src/`, `worker/`, `shared/`, `migrations/`, `scripts/`), Biome, Vitest, wrangler with D1 + static assets, `pnpm dev` / `pnpm deploy`; `shared/` ladder, deltas, scheduling, normalization with tests; D1 migrations for Appendix A; unlock + session cookie (FR-B1..B4); vocab CRUD, due selection, review recording (FR-A); JSON export; minimal PWA shell with unlock screen and manifest so deploy can be verified on the phone.
- f02 `airtable-import` (🟡 in progress, opened 2026-09-17): admin import endpoint and CSV import script (FR-H); run it for real; cross-check report reviewed by the sponsor.
- **Exit:** `urdu.umber-amber.workers.dev` unlocks on the phone; D1 holds the Airtable vocabulary with mastery and dates preserved; domain tests green.

### Phase 2 — Learning surfaces
**Goal:** The daily loop works on the phone: paste, read, hear, save, review.
- f03 `reader`: FR-C1..C8 including the selection action bar, Add to vocab form, Define ladder, voice picker.
- f04 `vocab-ui`: FR-D1..D3 and Settings (FR-I1 minus voice spend).
- f05 `review`: FR-E1..E4.
- **Exit:** Sponsor uses the app for reading and review on the phone for several consecutive days without needing Airtable.

### Phase 3 — Coach connection
**Goal:** Words from conversation reach the vault with near-zero friction; v0 done.
- f06 `coach-contract`: FR-F1..F5 (Coach routes, bearer auth, handoff idempotency, OpenAPI description, PWA paste-handoff screen).
- f07 `coach-client`: FR-G Option 2 (chosen by mp02). Voice screen, Worker-brokered GPT-Live-1 WebRTC session (FR-B5), Coach prompt in-repo (start from `mini-plans/mp02-coach-instructions.md` and the TODO tuning notes), tools bound to f06, spend display and caps.
- **Exit:** After a Voice session, new vocabulary and quiz results are in D1 via the Coach client, with the clipboard handoff verified as a working fallback. v0 is complete; amend `VISION.md` §16 line on custom voice tutors to match the shipped option.

### Phase 4 — v1 (coarse)
**Goal:** Broaden without changing the core.
- Windows Chrome parity (right-click menu, desktop layout), saved passages and recent texts, tag and favourite UI, review statistics, CSV export, hosted TTS as an option, the FR-G Option 1 Custom GPT if still wanted, fuzzy duplicate suggestions.

## Features Index
*The roster of every feature (`f##`). Each row → its doc in `pm/features/`. Numbers are assigned by roster order, monotonic, never reused (archived items included). See `pm-glossary.md` §1. Spikes are mini-plans (`mp##`) and live in `pm/mini-plans.md` once `/pm-open` stands it up.*

| Handle | Slug / doc | Status | One-line |
|---|---|---|---|
| f01 | `features/archive/f01-urdu-core-foundation-archive.md` | 🟢 shipped 2026-09-17 | Repo, shared domain rules, D1 schema, unlock auth, vocab/review API, PWA shell. |
| f02 | `features/f02-airtable-import.md` | 🟡 in progress (Stage 4) | One-time idempotent import of the Airtable "Urdu Vocab" base into D1. |
| f03 | `features/f03-reader.md` | planned | Paste-and-read in Nastaliq with tap-to-speak, selection action bar, add and define. |
| f04 | `features/f04-vocab-ui.md` | planned | Browse, search, edit, and create vocabulary; settings. |
| f05 | `features/f05-review.md` | planned | Due-item review session with five-grade self-scoring. |
| f06 | `features/f06-coach-contract.md` | planned | Coach tool routes, bearer auth, clipboard handoff import, OpenAPI description. |
| f07 | `features/f07-coach-client.md` | planned | In-app GPT-Live-1 voice Coach (FR-G Option 2, chosen by mp02). |
