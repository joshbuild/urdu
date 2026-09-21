# AGENTS.md | Urdu PWA

Primary agent instructions for this repository. Agent-specific entry points
(`CLAUDE.md`, and any Codex equivalent) point here; keep project guidance in
this file, not in them.

## Shared project guidance

All agents: read `pm/VISION.md` (intent, invariants), `pm/PRD.md` (exact v0
scope and requirements, data model, Coach contract), and `pm/PLAN.md` (phases
and Features Index) before any design or implementation work. PRD wins on
scope; VISION owns intent. Code and verified checks establish what is actually
built. Current work lives in `pm/STATUS.md`.

## Doc architecture

Single-domain project, so the authority catalogue stays inline here. Each row
names the single source of truth for a domain; when two docs disagree, the
owner wins — edit the owner first, then ripple to the surfaces named below.

| Authority doc | Authoritative for | Defers to / wins over |
|---|---|---|
| `pm/VISION.md` | intent, why we're building this | wins on intent; defers to PRD on scope |
| `pm/PRD.md` | v0 scope, requirements, data model, Coach contract | **wins on scope over every other doc** |
| `AGENTS.md` (this file) | architecture shape, invariants, commands, agent process | defers to PRD/VISION on scope and intent |
| `shared/` (`ladders.ts`, `mastery.ts`, `dates.ts`, `normalize.ts`, `ulid.ts`) | as-built domain rules — review ladders, intervals, grading, mastery bands, normalization, IDs | code + its tests win over prose; ripple a rule change into PRD and this file |
| `pm/DECISIONS.md` | cross-cutting decisions and what was rejected | append/prepend-only; correct by a new dated entry |
| `pm/pm-glossary.md` | process vocabulary, work types, identifier ladder | process terms defer here |
| `pm/PLAN.md` | phases and the Features Index | roster mirrors each feature doc's badge |
| `pm/STATUS.md` | where we are now (thin resume hub) | mirrors feature docs; they are canonical |
| `pm/workflows/` | how we work (lifecycle, decisions, clean, approach) | `pm-approach.md` owns the worldview |

No architecture/system-map doc and no `pm/adr/` track exist yet; the
four-component sketch below and the per-feature docs carry that weight. Add
them here if either appears.

**PRD ↔ as-built boundary.** The PRD owns *what must be true* — planned-but-
unbuilt scope must be marked planned (`post-v0`, `v1`). As-built content (this
file's Project state, feature-doc tombstones, code) owns *what is true now* and
is never aspirational; mark planned-not-built as planned or unknown.

**Keep-in-sync.** A ladder/grading change touches `shared/ladders.ts` or
`shared/mastery.ts`, their tests, PRD Appendix A, and the Invariants below. A command change touches
`package.json` and Project state. Keep this file under 24 KiB so agents that
truncate project docs still load all of it.

## Project state

Single-user personal Urdu learning PWA. See `pm/STATUS.md` for current progress. f01 shipped 2026-09-17: scaffold, shared rules, D1 schema, auth, vocab, review and export API, PWA shell, and the first deployment to `urdu.umber-amber.workers.dev`, verified on the sponsor's phone (`smoke-tests/archive/smoke-test-01_archive.md`). f02 `airtable-import` shipped 2026-09-17: the import endpoint and `scripts/airtable-import.ts`, and the sponsor's production run, which put 36 vocab rows, 3 tags and 0 review events into production D1 with an empty cross-check report (`smoke-tests/archive/smoke-test-02_archive.md`). That closed PLAN Phase 1. In Phase 2, f03 `reader` shipped 2026-09-17 and f04 `vocab-ui` 2026-09-18 (browse/search/edit/delete/manual add, session-limit setting), both verified on the phone. f05 `review` is built, awaiting the end of smoke-test-05. f09 `srs-ladder` (versioned geometric ladders, timestamp scheduling, migration 0002) is built and migrated remotely, awaiting redeploy and smoke-test-09. f06 `coach-contract` Stages 1–2 (ChatGPT copy-prompt/paste-JSON path for new vocab and fill-ins, `/api/handoffs*`) are built, awaiting smoke-test-06. f07 `coach-client` s01–s04 (voice session broker, cookie tool routes, Voice tab, and spend recording with daily caps in migration 0003) are built; adding vocab by voice was verified on the phone 2026-09-21, and migration 0003 is local-only until the sponsor applies it remotely. `spikes/` is Phase 0 reference code, excluded from tsc and Biome.

Commands (pnpm; Node 22):
- `pnpm dev` — Vite dev server with the Worker and a local D1 (secrets from `.dev.vars`, see `.dev.vars.example`).
- `pnpm check` — tsc, Biome, Vitest (`shared`, `scripts` and `client` node projects + `worker` Workers-pool project), build, build-output secret scan (`dist/client` names and values, `dist/urdu` values only — DECISIONS 260917c). Run before every commit.
- `pnpm test` / `pnpm lint` / `pnpm format` / `pnpm typecheck`.
- `pnpm types` — regenerate `worker/worker-configuration.d.ts` after editing `wrangler.jsonc`.
- `pnpm wrangler d1 migrations apply urdu --local` — local schema. `--remote`, `wrangler secret put`, and `pnpm run deploy` (not `pnpm deploy`, a pnpm built-in) are run by the sponsor.
- `pnpm tsx scripts/airtable-import.ts [--dry-run | <base-url>]` — f02 Airtable import (FR-H). `--dry-run` maps and cross-checks the CSVs in `data/airtable/` with no origin contact; a base URL unlocks and writes. Exits 0 only when the cross-check report is empty. Reads `URDU_SECRET` from the environment.
- `pnpm tsx scripts/smoke.ts <base-url>` — end-to-end smoke against a running origin (unlock → create → review → export → delete → lock, leaving no rows). Reads the secret from `URDU_SECRET`; never pass it as an argument.

Test-run discipline (this workstation has been wedged by concurrent Vitest runs):
- Only one agent may run Vitest at a time. Never launch `pnpm test` or `pnpm check`
  from several agents/sessions concurrently — the pools multiply into dozens of
  `node`/`workerd` processes and the machine stops responding.
- Run the smallest relevant test file first: `pnpm test shared/mastery.test.ts`
  (or `pnpm vitest run --project worker test/auth.test.ts`). Run the full suite
  only once, after targeted tests pass.
- `vitest.config.ts` caps `maxWorkers: 2`. Do not raise it, and do not override it
  with a higher `--maxWorkers` on the CLI.
- If the machine bogs down, check for leftover `node.exe` / `workerd.exe` after a
  run finishes and kill the strays.
- AVG Antivirus (not Windows permissions) is what makes `workerd` and other
  binaries fail to launch or crawl here. If Workers-pool runs time out with
  `[vitest-pool]: Timeout starting cloudflare-pool runner`, ask the sponsor to
  turn AVG **Hardened Mode** and **CyberCapture** off — with both off the
  worker project runs in ~8 s and `pnpm check` in ~33 s. Re-run before calling
  a failure of that shape a bug.
- **The toggles revert on their own**, roughly twice a day: this is a
  console-managed install and the policy re-syncs. So the sponsor does not turn
  them back on afterwards, and a long session can degrade from fast to slow with
  no code change — that is the re-sync, not a regression you introduced. It has
  already happened once (2026-09-17: a green 33 s `pnpm check` became 21 minutes
  mid-session, then pool timeouts). If timings collapse mid-session, ask the
  sponsor to re-check the toggles before investigating the code.
- Never suggest AVG exceptions/exclusions. Tested 2026-09-17: a repo folder
  exception made the same suite 492 s and reinstated the failures, apparently
  by triggering a policy re-sync on this console-managed install.

## Intended stack (directional, per VISION.md)

- TypeScript + Vite, lightweight responsive UI (likely React), PWA manifest.
- Cloudflare Workers for the API/domain layer; Cloudflare D1 for canonical data.
- Target deployment: `urdu.umber-amber.workers.dev`.
- Prefer boring, widely understood components. Offline-first is not a v0 goal.

## Architecture: four components

1. **Vocab Vault (D1)** — persistence only. Vocabulary terms/phrases, mastery state, review dates, review-event history, saved reading material. No business rules live here.
2. **Urdu Core (Cloudflare Worker)** — the domain layer. Owns auth, validation, normalization, duplicate detection, mastery transitions, review scheduling, vocabulary CRUD, due-vocab selection, Coach handoff import, and any AI enrichment. Exposes meaningful learning operations, not generic DB access. All clients go `client → Urdu Core → D1`; neither the PWA nor the Coach touches D1 or SQL directly.
3. **Coach (planned f06/f07)** — v0 uses in-app GPT-Live-1 voice, chosen by the Phase 0 spike (PRD FR-G Option 2). The Worker brokers WebRTC sessions with server-held credentials; tools use Urdu Core's Coach contract. The external Custom GPT is deferred to v1. Voice tool calls arrive in the browser and run through session-cookie routes over the Coach contract (DECISIONS 260918h); the bearer-token `/coach/*` routes are v1, with the Custom GPT. Clipboard JSON handoff remains a fallback. Handoffs carry *events and proposals* (e.g. grade `correct`), never absolute mastery values, and include a session/handoff id for duplicate-import detection.
4. **PWA (this repo's UI)** — paste-and-read Urdu in Nastaliq (RTL), tap word → speak, select phrase → speak, right-click/long-press context menu (Speak / Add to vocab / Define), vocabulary browsing/editing, review UI, handoff import. Talks to Urdu Core over HTTP only. Must remain useful with no LLM call.

## Invariants to preserve

- **Deterministic code owns state transitions; AI only proposes.** Mastery changes, intervals, next-review calculation, IDs, timestamps, validation, and persistence are application logic in Urdu Core. AI may grade free-form answers, define, transliterate, suggest duplicates, or propose metadata.
- **Review ladders are a single source of truth** (`shared/ladders.ts`; do not duplicate in UI and backend): immutable versioned interval lists — id 1 legacy 0/1/5/25/125/625/3125 d, ids 2–6 geometric presets 3 h → 10 y (×2^(q/4), q = 4–8), Moderate (id 3) the default; the active one is the `settings` row. Each item has one schedule (`ladder_id`, `ladder_step`, `interval_seconds`, `last_reviewed_at`, `due_at`); `due_at = last_reviewed_at + interval`; never-reviewed items (null) are due immediately. Never edit a version's intervals — add a new id. Mastery is a display band derived from the interval.
- **Review grading:** recognition (`ur_en`) Wrong −2, Partially correct −1, Hesitantly correct 0, Correct +1, Confidently correct +2; production (`en_ur`, `oral`) −1/0/0/+1/+2, in rungs; clamp to the ladder's ends. An item on a non-active ladder first maps to the log-nearest active rung (ties shorter); changing the active ladder rewrites no due time. A tracked review updates the schedule and records a review event (direction, grade, applied delta, ladder/step/interval/due before and after, source, prompt support). Ad-hoc speaking/defining/viewing must **not** alter the schedule.
- **Phrases are first-class vocabulary items**, not annotations on words. Check for duplicates/equivalents before creating an entry.
- **Auth is a single personal secret** validated server-side in the Worker, establishing a long-lived per-device session. The secret must never appear in frontend JS, the repo, URLs, or readable browser storage. Coach/tool auth to Urdu Core is separate and narrowly scoped.
- **Language target is everyday Pakistani Urdu**, with practical Roman Urdu transliteration and concise English explanations.
- v0 targets installed Android Chrome; desktop parity is v1. Keep layouts responsive and design touch, native text selection, and audio deliberately. PRD FR-C specifies the selection action bar rather than a custom long-press menu.

## Explicit non-goals (v0)

Multi-user, accounts/OAuth, offline-first, a dictionary or curriculum, a custom voice tutor built from scratch (the chosen GPT-Live-1 integration is allowed), social/billing/analytics features, or any infrastructure built "in case" a later version needs it. No LLM calls for Define. LLM enrichment of new vocab items is planned v0 scope (f08, DECISIONS 260917h); it and the capped voice path are the only API spending.

## PM workflow (all agents)

Project management uses the pm work-front regime; `pm/STATUS.md` is the resume
hub. Use `pm-resume` at session start, `pm-open` to open work, `pm-close` only
after Done When gates pass, and `pm-wrap` at session end. Use `pm-triage`,
`pm-stress-test`, `pm-clean`, and `pm-release` for their named operations.
An orientation request does not itself start the next product slice.

Canonical skills on this machine:
`C:/Users/jlock/.claude/skills/pm-<name>/SKILL.md`.
Codex adapters at `C:/Users/jlock/.codex/skills/pm-<name>/SKILL.md` read those
originals. If discovery has not refreshed, read the canonical file directly.
Resolve skill-relative references from the original directory. Treat slash
commands, dollar mentions and natural-language requests as skill invocations.
Map agent-specific tool names to available equivalents; one agent's permission
settings do not configure another's. Do not fork the PM procedures per agent.

Read `pm/workflows/pm-approach.md` for the model,
`pm/workflows/feature-lifecycle.md` for lifecycle/git rituals,
`pm/pm-glossary.md` for terms and information homes, and
`pm/workflows/decision-guide-part-1.md` for decision routing (part 2 as needed).

Work directly on `main` in small coherent commits scoped to session-owned
paths; preserve unrelated work. Run `pnpm check` before each commit.
Resume from STATUS, recent SESSIONS, then the active front's doc/journal.
Keep narration in journals, session one-liners in SESSIONS, and STATUS thin.
Feature decisions stay with the feature; cross-cutting decisions go in
DECISIONS. Archive completed fronts in their sibling archive directory,
retaining the handle and adding `-archive`; update live references.

## Execution notes

The OpenAI key (`OPENAI_API_KEY`) is a Cloudflare Worker secret only and is deliberately absent from `.dev.vars`, so agents on this machine cannot read it (DECISIONS 260921a); `pnpm dev` therefore reports `voice_unconfigured` on the Voice tab and live voice checks run against the deployment.

Use the sponsor runbook in the active f01 doc for production secrets,
remote migrations, deployment and phone verification. Local checks do not
establish production readiness. Never print `.dev.vars` secret values.

If Windows reports `spawn EPERM`, distinguish tool execution restrictions
from application failures. Use the permitted execution mode and report
remaining limitations; do not weaken checks to manufacture a green result.
