# Feature Plan — Urdu Core Foundation

**Status**: 🟡 IN PROGRESS (2026-09-14) — opened; Q1–Q4 answered, Q5 (router) pending before s01
**Handle**: `f01`
**Created**: 2026-09-14 · **Updated**: 2026-09-14

**Owner docs it serves**:
- `pm/PRD.md` FR-A1..A8, FR-B1..B4, Appendix A, Appendix B, §6 Maintainability / Mobile / Portability / Reliability / Security
- `pm/PLAN.md` Phase 1 (with f02)
- `CLAUDE.md` (real dev / test / deploy commands land there at close)

> **One-line:** Stand up the repo, the shared domain rules, the D1 schema, unlock auth, the vocab and review API, and a minimal installable PWA shell, deployed to `urdu.umber-amber.workers.dev`.

## Intent

### Vision

f01 is the first real application code. After it, Urdu Core exists as a deployed Worker with a real D1 database, the mastery ladder and scheduling rules exist once in `shared/` with tests, and the sponsor can install the PWA on their Android phone and unlock it. Nothing user-facing beyond unlock is expected; the point is that every later feature (f02 import, f03–f05 surfaces, f06 Coach routes, f07 voice) plugs into a layout and a domain layer that already enforce the invariants.

### Scope

- **Repo layout** (single pnpm package, per DECISIONS 260911a):
  ```
  src/          Vite + React PWA (shell only in f01)
  worker/       Urdu Core Worker
    index.ts      Hono app; mounts route groups
    auth/         unlock, session middleware, cookie helpers
    domain/       vocab + review services (D1 access lives here, routes stay thin)
    routes/       api-*.ts route modules for /api/*
    env.ts        Env bindings type
  shared/       mastery ladder, grade deltas, scheduling, normalization, ULID, API types
  migrations/   D1 SQL migrations
  scripts/      smoke.ts (f01); airtable-import.ts arrives in f02
  test/         Worker integration tests (Workers pool)
  spikes/       untouched (TODO tracks deletion)
  ```
  Room left, not built: `/coach/*` bearer-auth group (f06, FR-B3/F1..F4) mounts beside `/api/*` in `worker/index.ts`; the FR-B5 voice route lands as `worker/routes/api-voice.ts` at `POST /api/voice/session` under the existing session middleware (f07). `run_worker_first` gains `/coach/*` in f06.
- **Tooling**: TypeScript, Vite + `@cloudflare/vite-plugin` (Worker runs inside the Vite dev server; one build emits assets + Worker), Hono, Biome, Vitest (node project for `shared/`, `@cloudflare/vitest-pool-workers` project for `worker/` with migrations applied to a real local D1). Scripts: `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm check` (tsc + biome + vitest + bundle secret scan), `pnpm run deploy`.
- **wrangler.jsonc**: repoint `main` → `worker/index.ts`, assets → Vite build output with SPA fallback, `run_worker_first: ["/api/*"]`, D1 binding `DB` (database `urdu`), var `HOME_TZ = "America/Vancouver"`, secret `UNLOCK_SECRET`.
- **shared/** (FR-A2, A3, A5): ladder 0–6 names + intervals 0/1/5/25/125/625/3125; grade deltas −2/−1/0/+1/+2 and `applyGrade` with clamp; `todayIn(tz, instant)`, `addDays(date, n)`, `nextReviewOn(lastReviewedOn, mastery)` on `YYYY-MM-DD` strings; `urduKey()` per Appendix B; `inferKind()`; ULID; request/response types for f01 routes.
- **D1 migration `0001_init.sql`** (FR-A1): all five Appendix A tables, CHECK constraints on enums and mastery range, unique `urdu_key`, unique `airtable_id`, index on `next_review_on`, FK `review_events.vocab_id → vocab.id`.
- **Auth** (FR-B1, B2, B4; B3 structurally): `POST /api/unlock`, `POST /api/lock` (deletes the current session), session middleware on every other `/api/*` route except `GET /api/health`.
- **Vocab API** (FR-A5..A8): `POST /api/vocab`, `GET /api/vocab/:id`, `GET /api/vocab` (q, tag, due, sort, limit, offset), `PATCH /api/vocab/:id`, `DELETE /api/vocab/:id`, `GET /api/vocab/due` (limit, tag), `GET /api/status` (total count, due count).
- **Review API** (FR-A4): `POST /api/vocab/:id/reviews` `{grade, direction}` with `source=pwa`. The review service is written so f06's `POST /coach/reviews` calls the same function with `source=coach` and a handoff id.
- **Export** (§6 Portability): `GET /api/export` → vocab, review_events, tags, handoffs as JSON. Sessions excluded.
- **PWA shell** (§6 Mobile): manifest + 192/512 icons, standalone display, unlock screen (password-manager friendly), post-unlock status screen showing total and due counts from `GET /api/status`, lock button. No service worker (offline is a non-goal; mp01 showed install works without one).

### Exclusions

- **Airtable import and `POST /api/admin/import`** → f02 (FR-H). f01's migration already carries `airtable_id` and `source=airtable` so f02 adds no schema.
- **Coach routes, bearer token, handoff import, OpenAPI** → f06. f01 creates the `handoffs` table only.
- **FR-B5 voice session route** → f07. Layout slot only.
- **Reader, vocab screens, review screen, settings UI** → f03/f04/f05. The shell's lock button is the only settings-like control.
- **Nastaliq font self-hosting** → f03.
- **Tag management UI and endpoints** → deferred (PRD §2.2). f01 auto-inserts a `tags` row (name only) when a vocab write references an unknown tag, so tag filters work.
- **Fuzzy duplicates** → v1. Exact `urdu_key` equality only.
- **CSV export** → v1.
- **Deleting `spikes/`** → TODO items tied to f03 and f07.

### User Stories

- As the learner, I install the app on my phone, unlock it once with my secret (autofilled by my password manager), and it stays unlocked on that device.
- As the learner, I can lock a device, and that device's session stops working immediately.
- As the sponsor, I can export the whole vault as JSON at any time.
- As the builder of f02–f07, I call one domain service for vocab writes and review recording, and the ladder, scheduling, and duplicate rules are already enforced and tested there.

### Non-Functional Requirements

- **Single source of truth**: ladder, intervals, deltas, scheduling, normalization exist only in `shared/`. The Worker computes; the UI only displays.
- **Atomic review**: mastery update and event insert commit together or not at all (D1 `batch`), and a review based on a stale mastery value fails rather than double-applying.
- **Dates**: `last_reviewed_on` and `next_review_on` are `YYYY-MM-DD` calendar dates in `HOME_TZ`; "today" is always computed server-side. Instants (`added_at`, `created_at`, `updated_at`, `reviewed_at`, session times) are ISO 8601 UTC strings.
- **Security**: secret compared in constant time (hash both, `crypto.subtle.timingSafeEqual`); session token = 32 random bytes, only its SHA-256 stored; cookie `__Host-urdu_session`, `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age≈1y`; mutating routes require `Content-Type: application/json` (with SameSite=Strict this closes CSRF); no secret or token in the built JS, URLs, localStorage, or logs.
- **Write budget**: `last_seen_at` updated at most once per hour per session, not on every request.
- **Mobile**: hit targets ≥ 44 px, usable one-handed, responsive without touch-only assumptions.
- **Latency**: API p95 < 500 ms from Vancouver (checked informally by the smoke script's timings).
- **Maintainability**: Vitest coverage for ladder, deltas, clamping, scheduling across DST, normalization, duplicate detection (PRD §6), plus Worker integration tests against local D1.

## Planning

### Testing

**Unit (`shared/`, node):**
- Ladder: every level's name and interval; `applyGrade` for all 5 grades × 7 levels, including clamp at 0 and 6.
- Scheduling: `nextReviewOn` for each level; null last-reviewed → null (due now); `todayIn("America/Vancouver", …)` at instants straddling local midnight on the 2026-03-08 and 2026-11-01 DST transitions, and at UTC-midnight instants where the UTC and local dates differ; `addDays` across month/year ends and a leap day.
- Normalization: each Appendix B rule on its own (tashkeel, superscript alef U+0670, tatweel, yeh/kaf/heh/teh-marbuta mapping, ZWNJ/ZWJ, other Cf chars, Urdu punctuation ۔ ، ؟ and ASCII punctuation, whitespace collapse, trim), NFC equivalence, and pairs that must and must not collide. `inferKind` for word vs phrase.
- ULID: 26 chars, Crockford alphabet, monotonic-sortable across calls.

**Integration (`test/`, Workers pool, local D1 with migrations):**
- Schema: duplicate `urdu_key` and `airtable_id` rejected; mastery outside 0–6 rejected; bad enum rejected.
- Auth: wrong secret → 401 and no session row; right secret → Set-Cookie with all attributes and a `sessions` row whose `token_hash` ≠ token; protected route without cookie → 401; after `POST /api/lock` (or deleting the row) the old cookie → 401; non-JSON POST → 415; health reachable without cookie.
- Vocab: create returns ULID, computed `urdu_key`, inferred kind, mastery 0, null review dates; duplicate (including a tashkeel/kaf variant) → 409 with existing id; list search by Urdu (normalized), Roman, English substrings; tag filter; due filter; sorts; PATCH urdu recomputes key and re-checks duplicates; PATCH mastery recomputes `next_review_on` without touching `last_reviewed_on` or writing an event; DELETE removes the row (and per Q2, its events).
- Due: includes never-reviewed and `next_review_on <= today`; excludes future; order `next_review_on asc` (nulls first) then `added_at asc`; limit and tag honored.
- FR-A8: GET item, list, due, status, export leave `updated_at`, mastery, and dates unchanged.
- Review: each grade applies the right delta and clamp, sets `last_reviewed_on` to today, recomputes next review, inserts one event with before/after; a review against a stale mastery (simulated concurrent write) writes nothing; unknown id → 404; bad grade/direction → 400.
- Export: contains every table except sessions.

**Build checks:** `pnpm check` greps the built client bundle for `UNLOCK_SECRET`, the local dev secret value, and `OPENAI` and fails on a hit.

**Manual (phone, over Cloudflare):** install from Chrome, launch standalone, unlock with password-manager autofill, see counts, kill and relaunch the app (still unlocked), lock (unlock screen returns), unlock again.

**Smoke (`scripts/smoke.ts`, sponsor-run against production):** unlock with a secret read from an env var, create a `__smoke__` item, fetch due, record a review, export, delete the item, lock; prints per-call timings.

### Done When

All true:
1. `https://urdu.umber-amber.workers.dev` serves the f01 build from Worker `urdu` with D1 `urdu` migrated to `0001_init`.
2. On the sponsor's Android phone the installed PWA unlocks, stays unlocked across relaunch, and lock revokes the device (manual check above, sponsor-confirmed).
3. `pnpm check` is green: domain unit tests, Worker integration tests, Biome, tsc, bundle secret scan.
4. `scripts/smoke.ts` passes against production (sponsor-run), leaving no smoke rows behind.
5. `wrangler.jsonc` no longer references `spikes/`; `spikes/` still present.
6. `CLAUDE.md` "Project state" lists the real dev / test / migrate / deploy commands.

(Phase 1's other exit condition, Airtable vocabulary in D1, is f02.)

### Roadmap

Dependencies: s01 → (s02 ∥ s03) → s04 → (s05 → s06) ∥ s07 → s08. Each slice ends with `pnpm check` green and a commit.

| Slice | What | Verified by | Sponsor step |
|---|---|---|---|
| **s01 scaffold** | pnpm package, TS configs (spikes excluded), Vite + React + `@cloudflare/vite-plugin`, Hono Worker with `GET /api/health`, wrangler.jsonc repointed with D1 binding + `HOME_TZ`, Biome, Vitest two-project config, scripts, `.dev.vars` example | `pnpm check` green on a trivial test; `pnpm dev` serves the React placeholder and `/api/health` locally; `pnpm build` output | `git rm package-lock.json`; `pnpm wrangler d1 create urdu` and paste the `database_id` |
| **s02 shared rules** | `shared/mastery.ts`, `dates.ts`, `normalize.ts`, `ulid.ts` | Unit tests above | — |
| **s03 schema** | `migrations/0001_init.sql`; Workers-pool test harness applying migrations | Schema integration tests | — |
| **s04 auth** | unlock, lock, session middleware, cookie helpers, JSON content-type guard, last-seen throttle, unlock rate limit (per Q1) | Auth integration tests | put a local `UNLOCK_SECRET` in `.dev.vars` (or let the agent generate a dev-only one) |
| **s05 vocab + due** | `worker/domain/vocab.ts`, `routes/api-vocab.ts`, `GET /api/status`, tag auto-insert | Vocab, due, FR-A8 tests | — |
| **s06 review + export** | `worker/domain/review.ts` (batch with stale-mastery guard), review route, `GET /api/export` | Review and export tests | — |
| **s07 PWA shell** | manifest, icons, unlock screen, status screen, lock; 44 px targets | `pnpm dev` desktop run through Chrome device emulation; bundle secret scan | — |
| **s08 deploy + phone** | `scripts/smoke.ts`; CLAUDE.md commands; deploy runbook executed | Done-When 1–6 | runs the commands below, then the phone check and smoke |

**s08 sponsor runbook** (the classifier blocks the agent from these):
```powershell
# 1. Production secret (prompts for the value; use a password manager to generate and store it)
pnpm wrangler secret put UNLOCK_SECRET
# 2. Schema on the remote D1
pnpm wrangler d1 migrations apply urdu --remote
# 3. Build and deploy (note: `pnpm deploy` is a pnpm built-in; the script must be run as `pnpm run deploy`)
pnpm run deploy
# 4. Confirm
curl.exe -s https://urdu.umber-amber.workers.dev/api/health
# 5. Smoke against production
$env:URDU_SECRET = "<secret>"; pnpm tsx scripts/smoke.ts https://urdu.umber-amber.workers.dev; Remove-Item Env:URDU_SECRET
```
If `secret put` runs before the first deploy, wrangler creates the Worker; either order works. If the agent is permitted to run local-only D1 commands (`--local`), it will; anything `--remote` is the sponsor's.

## Status

### Recently Completed

- 2026-09-14 — Doc and journal written; front opened; roster and STATUS updated.

### Next Steps

1. Sponsor decides Q5 (router).
2. Build s01; sponsor runs `git rm package-lock.json` and `pnpm wrangler d1 create urdu`.

### Open Questions

*Q1–Q4 answered 2026-09-14 (see Decisions).*

- **Q5 Router.** PRD leaves Hono vs plain fetch open. Sponsor asked for the trade-offs before deciding (2026-09-14); pros/cons given in session. Blocks s01.

## Decisions

*Agent-resolved at open unless marked sponsor; sponsor can overturn.*

- 2026-09-14 (sponsor, Q1) — Unlock brute-force protection = long random secret plus a Workers rate-limit binding on `POST /api/unlock` (about 5 attempts/min per IP). No lockout table.
- 2026-09-14 (sponsor, Q2) — Deleting a vocab item deletes its `review_events` (FK `ON DELETE CASCADE`).
- 2026-09-14 (sponsor, Q3) — Secret is a random 24+ character string kept in the sponsor's password manager; unlock form built for autofill; Worker rejects a configured secret shorter than 24 chars.
- 2026-09-14 (sponsor, Q4) — Smoke script runs against production, creating and deleting one `__smoke__` item and its review.

- 2026-09-14 — Vite dev/build via `@cloudflare/vite-plugin` rather than separate `vite` + `wrangler dev` processes: one `pnpm dev`, one build output, local D1 via Miniflare.
- 2026-09-14 — Package manager is pnpm per DECISIONS 260911a; the spike-era `package-lock.json` goes. Deploy script invoked as `pnpm run deploy` because `pnpm deploy` is a pnpm built-in (PRD §6 wording to be aligned at close).
- 2026-09-14 — Scheduling dates are plain `YYYY-MM-DD` strings and day arithmetic is calendar arithmetic; timezone matters only when computing "today" from an instant. This makes DST a property of `todayIn`, which is where the DST tests aim.
- 2026-09-14 — Manual mastery edit (PATCH) recomputes `next_review_on` from the existing `last_reviewed_on`, leaves `last_reviewed_on` alone, and writes no review event (it is a correction, not a review). Never-reviewed items stay due now.
- 2026-09-14 — Review atomicity: read the row, compute in `shared/`, then one D1 `batch` whose event insert and vocab update are both conditioned on the mastery value read, so a concurrent change makes both no-ops and the route returns 409.
- 2026-09-14 — Session middleware mounts on `/api/*` only; Coach routes will live under `/coach/*` with their own bearer middleware (f06), which gives FR-B3's "cookie not accepted on Coach routes, token not accepted elsewhere" by construction.
- 2026-09-14 — No service worker in f01; install works from the manifest alone (mp01 evidence) and offline is a non-goal.
- 2026-09-14 — Urdu search matches the normalized query against `urdu_key`, so tashkeel and letter variants don't defeat search.
