# Journal — f01 urdu-core-foundation

*Verbose per-front record. Hub: `pm/STATUS.md`; doc: `f01-urdu-core-foundation.md`.*

**Current state (2026-09-14):** s01 scaffold, s02 shared rules, s03 schema complete (`pnpm check` green, 108 tests); local D1 migrated to `0001_init`; production D1 `urdu` still has no schema (s08 runbook). Next: s04 auth, which needs the sponsor's choice of local dev `UNLOCK_SECRET` (own value in `.dev.vars` or agent-generated).

## 2026-09-14 — opened

Opened after Phase 0 closed (mp01 speech PASS, mp02 GPT-Live PASS → FR-G Option 2). Doc written from PLAN Phase 1, PRD FR-A1..A8, FR-B1..B4, Appendices A/B, and §6 NFRs. Eight slices (s01 scaffold → s08 deploy + phone). Five sponsor questions batched in the doc (unlock rate limiting, cascade on delete, secret shape, production smoke, Hono). Build paused until answered, at sponsor request.

State found at open: `wrangler.jsonc` still points at `spikes/gpt-live/`; `package.json` has only wrangler and was installed with npm (`package-lock.json` present) although the project decision is pnpm; pnpm 10.11 and Node 22.15 available locally. Worker `urdu` does not currently exist on Cloudflare (sponsor deleted the spike Worker), so no D1 database or secrets exist yet.

Noted while planning: `pnpm deploy` is a pnpm built-in command, so the deploy script must be run as `pnpm run deploy`.

## 2026-09-14 — questions answered, s01 built

Sponsor answers: Q1 (b) rate-limit binding on unlock; Q2 (a) cascade review events on delete; Q3 (a) random 24+ char secret in password manager; Q4 production smoke OK; Q5 asked for router pros/cons, agent leaned slightly to plain `fetch` + `URLPattern`, sponsor chose Hono. All recorded in the doc's §Decisions.

s01 landed (commits `3da80c7`, `fb0b9aa`, `733c35f`):
- Deps pinned exact via pnpm: hono 4.13.7, react 19.3.0, vite 8.3.0, @vitejs/plugin-react 6.1.1, @cloudflare/vite-plugin 1.54.9, @cloudflare/vitest-pool-workers 0.22.0, vitest 4.1.11, biome 2.5.13, typescript 6.0.3, wrangler 4.131.2, tsx 4.23.13. `pnpm.onlyBuiltDependencies` allows esbuild and workerd postinstalls.
- Vitest 5.0.0 is out but the Workers pool peers on `^4.1`. TypeScript 7.0.2 is out; stayed on 6.0.3.
- The pool's bundled workerd rejected `compatibility_date` 2026-09-01 (max 2026-08-22); set to 2026-08-22.
- Pool config API in 0.22: `cloudflareTest()` Vite plugin inside a Vitest project, `readD1Migrations()` into a `TEST_MIGRATIONS` binding; tests use `exports` from `cloudflare:workers` (`SELF` is deprecated).
- Worker test run logs "Using secrets defined in .dev.vars": the spike's OpenAI key is still in `.dev.vars`. s04 must set test bindings explicitly so tests don't depend on it.
- `vite build` copies `.dev.vars` into `dist/urdu/` (gitignored; wrangler deploy does not upload it as secrets). Bundle scan covers `dist/client` only.
- `biome init` + `biome check --write .` reformatted `.vscode/settings.json` and `urdu.code-workspace`; reverted and excluded them from Biome.
- `pnpm dev` started on :5199, but the agent's curl probes were denied at the permission prompt; the local HTTP check wasn't done by the agent.
- Sponsor ran `git rm package-lock.json` and `pnpm wrangler d1 create urdu` (WNAM, id `3b3e3582-051e-47e6-a75b-a4d323e198b7`), binding `DB`, declined remote-for-local-dev. Wrangler updated the existing entry in place but re-indented the file with tabs (broke Biome) and kept the stale placeholder comment; both fixed.

## 2026-09-14 — s02 shared rules

Built `shared/mastery.ts`, `dates.ts`, `normalize.ts`, `ulid.ts` with 77 node unit tests (ladder table, 5×7 `applyGrade` matrix, Vancouver `todayIn` either side of local midnight on both 2026 DST days and at UTC-midnight instants, `addDays` across month/year/leap day, `nextReviewOn` per level, every Appendix B rule alone plus collide / must-not-collide pairs, ULID spec time vector, same-ms and clock-backwards monotonicity, overflow). Expected dates were computed with Node `Intl` before writing the tests. `pnpm check` green.

Choices recorded in the doc's §Decisions: punctuation and symbols become spaces; `inferKind` uses the key; empty key is s05's to reject; API types wait for their route slices.

Not covered by Appendix B, left alone: yeh-with-hamza typed as ی + U+0654 does not match precomposed ئ U+0626 (NFC composes only from Arabic yeh); Arabic-Indic vs Extended digits; noon ghunna mark U+0658. Revisit only if a real duplicate slips through.

Tooling gotcha: the agent's file-writing path turns `\uXXXX` escapes into literal characters before they reach disk (Biome was wrongly suspected first). `\u{XXXX}` brace escapes survive, so `shared/normalize*.ts` use that form with `u`-flag regexes.

## 2026-09-14 — s03 schema

`migrations/0001_init.sql` written; `test/apply-migrations.ts` (Worker-project `setupFiles`) runs `applyD1Migrations(env.DB, env.TEST_MIGRATIONS)`; `test/env.d.ts` types the `TEST_MIGRATIONS` binding. 29 tests in `test/schema.test.ts`: table list, due-index query plan, defaults, unique `urdu_key` / `airtable_id` (multiple nulls allowed), mastery and enum CHECKs, JSON-array tags, date shape and null-together dates, FK required, cascade on vocab delete, handoff/tag/session constraints. Also ran `pnpm wrangler d1 migrations apply urdu --local`: 9 commands, applied.

First run had 3 failures, all in the tests: D1's migrations table creates `sqlite_sequence` (excluded from the table list); STRICT reports 2.5 as `SQLITE_CONSTRAINT_DATATYPE` ("cannot store REAL value"), not "constraint failed"; STRICT losslessly coerces text `"3"` into INTEGER 3, so that case was dropped. Local D1 enforces the FK and cascade without a PRAGMA.

Schema choices are in the doc's §Decisions (STRICT, nullable optional text, no FK on `handoff_id`, no CHECK on `handoffs.status`, composite due index, tests clear tables in `beforeEach`).

Noticed for s04: `worker/worker-configuration.d.ts` types `OPENAI_API_KEY` and `SPIKE_TOKEN` on `Env` because `wrangler types` reads `.dev.vars`; regenerate after the spike values leave `.dev.vars`.
