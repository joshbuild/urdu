# Journal — f01 urdu-core-foundation

*Verbose per-front record. Hub: `pm/STATUS.md`; doc: `f01-urdu-core-foundation-archive.md`.*

**Final state (2026-09-17):** 🟢 CLOSED. All eight slices shipped. Urdu Core
is deployed at `urdu.umber-amber.workers.dev` (Worker version `b7585268`) on D1
`urdu` at `0001_init`, and the PWA is installed and unlocking on the sponsor's
Android phone. Done-When 1–6 all verified — see the tombstone in the archived
doc and the run record in `smoke-tests/smoke-test-01.md`.

## 2026-09-17 — s08 deploy + phone; f01 closed (260917c)

Picked up with both STATUS pointers sponsor-gated, so the session started on the
one agent-side piece of s08 and ended with the whole front closed.

**`scripts/smoke.ts` (s08).** An end-to-end pass over the deployed API: health,
401-while-locked, wrong secret, unlock, status, create, duplicate 409, due list,
review, export, delete, lock, and a final 401 proving the session was revoked.
The review assertions are the point of the script — it imports `nextReviewOn`
from `shared/dates.ts` and recomputes the expected date rather than trusting the
server's, so a production scheduling bug cannot pass. The created item is deleted
in a `finally`, and the unlock secret is read from `URDU_SECRET` only, never an
argument. AGENTS.md gained the command and its Project state line caught up.

**Deploy went clean.** Sponsor ran `secret put` (which created the Worker —
expected, no deploy had happened yet), remote migrations, `pnpm run deploy`, and
the health check. Bindings confirmed at upload: DB, UNLOCK_LIMITER, HOME_TZ.

**A real defect the first production run exposed.** The script created its item
with `tags: ["smoke"]`, but tag names live in a standalone catalogue table and
`DELETE FROM vocab` does not cascade to it, so a passing run left a stray `smoke`
row in production D1 — directly against Done-When 4's "leaving no smoke rows
behind." The 23 assertions were all sound; only cleanup was wrong. Fixed by
dropping the tag (it was never load-bearing) and filtering the due check by id.
The same edit made that check tolerate a full 200-item page, since once f02
imports the vault the new item can legitimately fall off `MAX_LIMIT`. Sponsor
cleared the stray row over `--remote`, then re-ran: 23/23 with `tags` empty
unaided. Done-When 4 is verified by execution, not by inspection.

**Phone gate green.** Installed PWA, maskable icon correct on the launcher,
unlocked across relaunch and force-close, and Lock genuinely revoked the device.
That is the year-long `__Host-` cookie and the session-row delete both proven
against a real process death — the thing no test in `test/` can reach.

**Process.** Sponsor stated a standing preference for bash over PowerShell; the
smoke-test checklist and the s08 runbook in the doc were both converted, and the
journal's earlier PowerShell was deliberately left as a historical record. The
checklist itself (`smoke-tests/smoke-test-01.md`, 27 items across four parts) is
new and is the durable verification record.

**Carried forward, not lost:** `preview_urls` defaulted on at first deploy, and
`scripts/scan-bundle.mjs` covers `dist/client` only while the build also writes
`dist/urdu/.dev.vars` (not uploaded — checked against the asset list — but
unasserted). Both filed in `pm/TODO.md`.

f01 closed: badge flipped, doc and journal archived in place, roster and hub
updated, Phase 1 now waiting on f02 alone.

## 2026-09-17 — s07 verified + toolchain unblocked (260917b)

Claude Code session after a machine restart cut off the previous one. Two things landed: the test-runner saturation fix the restarts kept forcing, and the resolution of the `EPERM` blocker that stalled s07 across two agents.

**Vitest saturation.** Vitest defaults `maxWorkers` to all available parallelism (16 logical cores here), and the `worker` project spawns `workerd` children on top of that, so concurrent agent runs multiplied into machine-wide contention and twice forced a hard restart. `vitest.config.ts` now pins `maxWorkers: 2` at the root `test` block, inherited by both projects; the cap lives in config rather than a CLI flag because agents forget flags and the Workers pool has known bugs ignoring `--maxWorkers`. A `minWorkers: 1` companion was reverted — it is not in vitest 4.1.11's `InlineConfig` type and failed `tsc`. Sampled during a full run: 2 `node` + 2 `workerd` at steady state, 0 after exit. CLAUDE.md gained a test-run discipline block (one agent at a time, smallest file first, don't raise the cap).

**EPERM root cause.** The working tree carried an undocumented downgrade of three dev dependencies against the committed s01 scaffold (Biome 2.5.13→2.5.10, `@cloudflare/vite-plugin` 1.54.9→1.54.4, wrangler 4.131.2→4.129.0). Tested rather than assumed: `pnpm dlx @biomejs/biome@2.5.13 --version` reproduces `spawnSync ... biome.exe EPERM` from a fresh cache path, while the installed 2.5.10 runs. The block is version-specific to that binary, not the Node wrapper, the shell, or the repository — which matches the sponsor's earlier finding that `biome.exe --version` failed directly. The downgrade is therefore causal and kept. Only Biome's causality is established; the vite-plugin and wrangler downgrades came in the same undocumented change and were left alone rather than probed.

**s07 verification.** `pnpm check` green end to end: `tsc -b`, Biome, 194 tests in 9 files, both Vite builds, and `Secret scan: clean (dist/client)`. `pnpm dev` boots — Vite ready in 2.7 s with the Miniflare runtime up, the exact command that failed with `spawn EPERM` for both prior agents. Probing it over HTTP with curl was denied by the permission prompt (same boundary as s01), so no local request/response is claimed and the interactive checks remain undone: wrong-secret error, unlock, reload persistence, lock, and Chrome device emulation of the narrow layout and tap targets. Reviewed the diff by reading instead: unlock/status/lock states, abort-on-cleanup for the initial status fetch, no browser-storage credentials, manifest icon entries matching the three generated PNGs.

s07 is committed on that evidence rather than held uncommitted a third time — two restarts have now destroyed sessions holding this same work. The browser gate is recorded as outstanding, not waived.

**Process hygiene.** Stopping the dev-server task left its `pnpm`/`vite`/`workerd` tree orphaned; the three were identified by command line and killed, leaving zero strays. Worth watching after future interrupted runs.

**Underlying cause: AVG Antivirus.** After the green check, the toolchain degraded within the same session: `pnpm check` took 21 minutes, then worker-pool runs began failing with `[vitest-pool]: Timeout starting cloudflare-pool runner` — consistently 3 of 5 worker files passing (53 tests) while 2 never started a runner, over 217 s. Two hypotheses were tested and rejected: stale SQLite `-shm`/`-wal` files left by the force-killed dev server (moving `.wrangler` aside changed nothing; it was restored), and the `maxWorkers: 2` cap (the 194-test green run was already under that cap). The tell was a plain `Rename-Item` of `.wrangler` exceeding 120 seconds — filesystem-level throttling, not a project fault. `Get-MpComputerStatus` reports Defender's AM service not running (`0x800106ba`) and `root\SecurityCenter2` lists **AVG Antivirus** as the registered product. One scanner explains every symptom this front has hit across three sessions: `EPERM` on a newly seen `biome.exe`, `spawn EPERM` on Miniflare's runtime, `workerd` launches exceeding the pool's start timeout, and minutes-long file operations. The 2.5.13-vs-2.5.10 result stands as reproducible, but reads as AVG treating one binary as unknown rather than anything wrong with Biome.

**Confirmed by toggling AVG (same session).** The install is AVG Business Security 26.8 with the Business Console Client, so it is centrally managed and the sponsor reports exclusions do not stick. Two feature toggles were measured against the `worker` project (5 files, 117 tests):

| AVG state | Files | Runner timeouts | Wall |
|---|---|---|---|
| Hardened Mode + CyberCapture on | 3 of 5 | 2 | 217 s |
| Hardened Mode off | 5 of 5 | 0 | 88 s |
| … + CyberCapture off | 5 of 5 | 0 | 48 s |
| … warm repeat | 5 of 5 | 0 | 38 s |
| … plus a repo folder exception | 3 of 5 | 2 | **492 s** |
| exception removed, both features re-toggled off | 5 of 5 | 0 | **8 s** |

**Hardened Mode is the correctness fix** — with it off the `cloudflare-pool` runner timeouts disappear entirely, which settles the diagnosis: AVG was refusing `workerd.exe` launches. CyberCapture is a speed fix, roughly halving the run. The residual is File Shield scanning each launch: a single worker file costs 6 s wall for 2 s of Vitest, so ≈ 7 s of `workerd` startup per file, and only an exclusion would remove it. For contrast the whole suite ran in 9 s earlier the same day, before the dev-server run appears to have made AVG re-examine these binaries.

**Exceptions are not the remedy here — they are actively harmful.** Adding a folder exception for the repository, with both features still off, took the same suite to 492 s and back to the broken 3-of-5 signature: eight times worse than doing nothing. The signature is the one Hardened Mode produces, so the likely mechanism is that editing settings on a console-managed install provokes a policy re-sync that re-applies the managed policy and discards the local toggles. That also explains the sponsor's prior experience of exceptions "not sticking" — the cost is not just a lost exception, it is losing the toggles that do work. This is inference from the failure signature plus the sponsor's UI check, not a directly observed console event.

Removing the exception and toggling both features off again restored the machine past its earlier state: **8 s** for the worker project and **32.7 s** for a full `pnpm check`, against 38–48 s and minutes before. So the earlier 38–48 s figures were a degraded scan state rather than a floor, and a fresh off/on/off cycle clears it.

Working arrangement: no AVG exceptions; toggle Hardened Mode and CyberCapture off before a work session and back on after. Single-file worker runs (6 s) stay the habit while iterating, though at 8 s the whole project is no longer worth avoiding. The `#sponsor-decide` TODO is closed out by this result rather than left open for an exclusion that measurably backfires. A run of this shape remains environmental: re-run before treating it as a code defect.

## 2026-09-17 — s07 shell implementation (260917a)

Resumed with an empty Inbox and clean main. Sponsor authorized the next tranche with a 15-minute maximum, then requested terminal commands when Codex execution restrictions persisted. f01 was already open; no new front or scope added.

Implemented `src/App.tsx` + `src/app.css`: initial cookie-session check, password-manager-friendly unlock form, total/due counts from the existing status endpoint, lock, disabled pending controls, and wrong-secret/rate-limit/network/server error messages. Successful unlock clears the input; no localStorage credentials. Failed lock preserves the current view and reports that the device remains unlocked. Initial status requests abort on effect cleanup.

Added `public/manifest.webmanifest`, HTML manifest/theme/icon links, 192/512 any icons and a padded 512 maskable icon derived from `design/icon/icon_1254.png`. `scripts/make-icons.ps1` reproduces the assets using System.Drawing; sampled corner teal is #054e51. Controls have a 48 px minimum height. No service worker or new dependencies.

Verification: `pnpm typecheck` passes after implementation; `git diff --check` passes. Inspected the maskable icon visually; all three icon dimensions match the manifest, and measured lettering radius is 176.0 px inside the 204.8 px maskable safe radius. `pnpm check` fails launching Biome with `spawnSync ... biome.exe EPERM`, both default and approved execution. Formatter retry also fails with EPERM. `pnpm dev` fails with spawn EPERM (default in Vite path resolution; approved retry reaches Miniflare but cannot launch its runtime). No browser/phone verification or fresh test/build/secret-scan success is claimed. No commit/push because the required green-check gate is unmet.

Sponsor commands, from the repository root (Git Bash; `.cmd` avoids the PowerShell launcher):

```bash
pnpm.cmd exec biome check --write src/App.tsx src/app.css index.html public/manifest.webmanifest &&
pnpm.cmd check &&
pnpm.cmd dev
```

Browser checks: open the printed localhost URL, try a wrong secret, unlock with the local secret, confirm counts, reload (session retained), lock (unlock form returns), unlock again. In Chrome phone emulation check narrow layout and tap targets; offline/retry and failed-lock messaging should be checked too. Password-manager autofill and installed Android behavior remain the production s08 sponsor gate. Do not paste secret values into chat. If local schema is missing, apply `pnpm wrangler d1 migrations apply urdu --local` before retrying.

### Final wrap / Claude Code handoff

Sponsor reproduced the same Biome `spawnSync ... EPERM` using `pnpm.cmd` in Git Bash. Directly invoking the installed `biome.exe --version` returned `Permission denied`, so the observed failure is not confined to the Node wrapper or PowerShell script launcher. The terminal's isolation context was not independently verified.

Read-only sponsor diagnostics: stream listing showed only `:$DATA` (no Zone.Identifier shown); `icacls` processed the file successfully but printed "The trust relationship between this workstation and the primary domain failed", followed by an unresolved inherited Modify entry and inherited Full Control entries for SYSTEM, Administrators, and `cjinc\JLock`. No CodeIntegrity events appeared in the supplied output; the command suppressed errors, so this does not establish that the log is clear. The trust message alone does not establish the cause of execution denial. Requested follow-up `whoami /user` and raw ACL SDDL was not run/reported before wrap. No permission, domain, or security-setting changes were made.

Sponsor is switching to Claude Code to try verification there. Start with `/pm-resume`, inspect the existing s07 diff, and retry the formatter/check/dev commands above in that environment. Do not rebuild the slice from scratch or mark it complete based only on typechecking. Resolve findings, complete browser verification, then path-scope the s07 commit on main. All session changes remain uncommitted and unpushed because the required green-check gate is unmet; preserve them. s08 (smoke script + production runbook + phone) remains untouched. PM hub/roster and CLAUDE state reflect verification pending; CHANGELOG starts the user-facing unreleased record. No new cross-cutting decision or TODO was introduced by the diagnostics.

## 2026-09-16 — Codex handoff (260916a)

Completed orientation across VISION, PRD, PLAN, STATUS, sessions, this front,
its journal, PM workflows, and the implemented route/tooling layout. No
product code changed; f01 s07 remains next.

Installed and validated 12 personal Codex PM adapters under
`C:/Users/jlock/.codex/skills/pm-*/SKILL.md`. They read the canonical skills
under `C:/Users/jlock/.claude/skills/`, resolving references there, so both
agents share one procedure. Codex's refreshed skills catalogue confirms
discovery. These personal adapters are outside the repository and depend
on the original Claude skill files remaining available on this machine.

AGENTS.md now provides durable PM routing and execution guidance. CLAUDE.md
now reflects s01–s06 completion, the chosen in-app voice Coach, Android-first
v0 scope, and the permitted voice API exception.

Verification: Node 22.15.0 and pnpm 10.11.0 available. Typecheck passes.
Lint passed on the initial September 15 attempt, but subsequent full
`pnpm check` attempts, including elevated execution on September 16, fail
launching Biome with `spawnSync ... EPERM`. Separate test attempts encountered
Vite subprocess EPERM; an elevated test run reached Workers startup but its
completion was lost on interruption. Local `pnpm dev` failed launching the
Miniflare runtime with `spawn EPERM`. The previous 194-test green baseline
is Claude's September 14 result, not a newly verified Codex result.

Runtime execution remains unresolved; no dependency or check was weakened.
Resolve Windows subprocess permissions and rerun checks plus local HTTP
verification before treating the Codex development runtime as ready.

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

## 2026-09-14 — s04 auth

Built in a session that was interrupted before commit; resumed and verified the next session: `pnpm check` green, 130 tests (22 in `test/auth.test.ts`). `.dev.vars` now has an `UNLOCK_SECRET` alongside the spike's `OPENAI_API_KEY`/`SPIKE_TOKEN`; tests don't read it. The generic JSON-404 test moved from `health.test.ts` into auth tests, since unknown `/api/*` routes now return 401 without a session.

Files: `worker/env.ts` (Hono `AppEnv`), `worker/auth/{cookie,crypto,sessions,middleware}.ts`, `worker/routes/api-auth.ts`, `test/constants.ts`; `wrangler.jsonc` gains the `UNLOCK_LIMITER` ratelimit binding (namespace 1001); types regenerated.

Gotcha: Vite warns that `import "./test/constants"` in `vitest.config.ts` lacks an extension under the future native config loader; adding `.ts` fails tsc (TS5097, `allowImportingTsExtensions` off). Left as-is.

Still open: spike values in `.dev.vars` keep `OPENAI_API_KEY`/`SPIKE_TOKEN` on the generated `Env`; sponsor to remove them, then `pnpm types`.

## 2026-09-14 — s05 vocab + due

Built in a session that was interrupted before commit; the next session found the files untracked, ran `pnpm check` (green, 175 tests, 45 new in `test/vocab.test.ts`) and committed as `6e1efea`.

Files: `shared/api.ts` (vocab request/response types, sources, sorts), `worker/domain/vocab-input.ts` (body parsing and validation), `worker/domain/vocab.ts` (D1 service: create, get, list, update, delete, due, counts), `worker/routes/api-vocab.ts` (`/api/vocab*`, `/api/status`), `test/client.ts` (shared `clearTables` + unlocked API helper for Worker tests). `worker/index.ts` mounts the routes behind `requireSession`.

Sponsor removed `OPENAI_API_KEY`/`SPIKE_TOKEN` from `.dev.vars`; `pnpm types` regenerated `Env` without them (in the same commit). Test runs still print "Using secrets defined in .dev.vars", which now means only `UNLOCK_SECRET`.

Slice choices are in the doc's §Decisions (s05 entries).

## 2026-09-14 — s06 review + export

Built in a session that was interrupted before commit (files written 19:05–19:07, after the 260914i wrap). The next session found five modified and five untracked files, confirmed nothing else was loose (no s07 files, no stray edits from the parallel session), ran `pnpm check` (green, 194 tests, 19 new in `test/review.test.ts` plus `/api/export` added to the FR-A8 read-only test) and committed as `f619c9c`.

Files: `worker/domain/review.ts` (`recordReview` reads then `applyReview`: one D1 batch, `INSERT … SELECT … WHERE EXISTS` for the event and a guarded `UPDATE`, both conditioned on the row's `mastery` and `updated_at`; zero changes → re-read to report `stale` vs `not_found`), `worker/domain/review-input.ts` (grade + direction only, unknown fields rejected), `worker/domain/export.ts` (batch-reads vocab, review_events, tags, handoffs; parses handoff `payload`/`outcome` JSON), `worker/routes/api-review.ts` (`POST /api/vocab/:id/reviews` → 201 `{item, event}` / 404 / 409 `conflict`; `GET /api/export` with `Content-Disposition` attachment and `no-store`), `shared/api.ts` (review/export/conflict types). `worker/domain/vocab.ts` now exports `VocabRow`/`toItem`; `worker/routes/api-vocab.ts` exports `today`/`invalid`/`readJson` for reuse by the review routes.

Loose end noted, not acted on: route helpers are imported from a sibling route module (`api-vocab.ts`). Fine at two modules; move them to a `routes/helpers.ts` if a third route group (f06 `/coach/*`) needs them.

Slice choices are in the doc's §Decisions (s06 entries).
