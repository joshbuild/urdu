# Mini-plan — Security bumps (vuln sweep 2026-10-23)

**Status**: 🟡 IN PROGRESS — *opened 2026-10-23 from the `_overwatch` vulnerability sweep; s01 next.*
**Handle**: `mp09`
**Created**: 2026-10-23 · **Updated**: 2026-10-23

**Owner docs it serves**:
- `package.json` / `pnpm-lock.yaml` (dependency versions, `packageManager`)
- The deployed Worker (`urdu.umber-amber.workers.dev`)

**Companions**: the sweep report `C:\Users\jlock\dev\_overwatch\reports\vuln-sweep\2026-10-23\report.md`
(findings, sources, rubric) and its remediation log `…\2026-10-23\remediation.md` (report back there).

> **One-line:** take the fixed versions for the advisories the 2026-10-23 sweep matched in this
> project: one runtime package shipped in the Worker (`hono`), dev tooling (vite, vitest,
> miniflare's undici and sharp, postcss's source-map-js), and the pinned pnpm. They're bundled
> because they come from one sweep, change one lockfile, and ride one deploy.

Findings for this project (all confirmed by GitHub Advisory Database and OSV; no KEV, no malware):

| Sev | Package @ now | Fix ≥ | Path in the lockfile | Shipped? |
|---|---|---|---|---|
| High | `hono@4.13.7` (direct, exact pin) | `4.13.11` | direct dependency | **yes, in the Worker** (GHSA-5r4p-p66f-jhc7, new) |
| High | `vite@8.3.0` (direct dev, exact pin) | `8.3.3` | direct; also via `@cloudflare/vite-plugin`, `@vitejs/plugin-react`, `vitest` | no (6 new advisories, e.g. GHSA-587h-7wmj-h5pm) |
| High | `undici@7.29.0` | `7.29.1` | `wrangler` / `@cloudflare/vite-plugin` / `@cloudflare/vitest-pool-workers` > `miniflare` | no (10 advisories) |
| High | `sharp@0.35.2` | `0.35.5` | same `miniflare` paths | no |
| High | `source-map-js@1.2.1` | `1.2.2` | `vite` > `postcss` | no |
| Medium | `@vitest/mocker@4.1.11` | `4.1.12` | `vitest@4.1.11`; also `@cloudflare/vitest-pool-workers` > `vitest` | no (new) |
| — | `packageManager: pnpm@10.11.0` | `10.34.5` | toolchain (26 advisories against pnpm itself) | no |

---

## Stages

- **Stage 1 — bump and verify** (s01–s03). s01 goes first because it is the only change that
  ships; s02 and s03 can follow in the same session.
- **Stage 2 — deploy and report** (s04). Sponsor deploy; then report back to `_overwatch`.

## Slices

Ground rules for every slice (sweep recipe §3.4 and §8):
- Take only the **original package** at a higher version. A "fix" package with a different name
  (`hono-patched` and the like) is a typosquat lure.
- Before each bump, look up the target release (`pnpm view <pkg>@<ver> time dist.attestations`).
  It must exist on the public registry; prefer one with npm provenance. If it was published less
  than 72 h ago and has no provenance, hold it and say so in the journal.
- Change versions only through `package.json` (exact pins stay exact) and `pnpm install`. If a
  parent can't be bumped, use a `pnpm.overrides` entry.

**mp09-s01 — `hono` 4.13.7 → 4.13.11 (shipped).** Bump the exact pin in `package.json`, run
`pnpm install`, and confirm the lockfile has a single `hono@4.13.11`. Read the hono 4.13.8–4.13.11
changelog for anything touching the routes or middleware in use. Verify: `pnpm check` green.

**mp09-s02 — dev tooling.**
- Bump `vite` to `8.3.3` (exact). Check that `@cloudflare/vite-plugin` and `@vitejs/plugin-react`
  still accept it as a peer.
- Bump `vitest` to `≥ 4.1.12`, which brings `@vitest/mocker` up. If `@cloudflare/vitest-pool-workers@0.22.0`
  pins `vitest@4.1.11`, bump the pool to a release that allows 4.1.12, or override.
- Bump `wrangler`, `@cloudflare/vite-plugin` and `@cloudflare/vitest-pool-workers` together to
  releases whose `miniflare` resolves `undici ≥ 7.29.1` and `sharp ≥ 0.35.5`. If none exists yet,
  add `pnpm.overrides` for `undici` and `sharp` instead.
- Confirm `source-map-js` resolves `≥ 1.2.2` (through the vite/postcss bump, or an override).

Verify: `pnpm check` green (typecheck, lint, tests, build, bundle scan), and `pnpm dev` starts.

**mp09-s03 — pnpm 10.11.0 → ≥ 10.34.5.** Update `packageManager` in `package.json`. The global
pnpm on this machine is the sponsor's to update (it's in the sweep's toolchain findings). Verify:
`pnpm --version` matches, `pnpm install --frozen-lockfile` is clean, `pnpm check` green.

**mp09-s04 — deploy and report.** The sponsor runs `pnpm run deploy`. This also ships whatever
else is built and undeployed on `main`, so check STATUS first. Do a quick phone smoke test
(load, review a few cards, Coach opens). Then append the outcome to
`C:\Users\jlock\dev\_overwatch\reports\vuln-sweep\2026-10-23\remediation.md`: the resolved
versions, the commit, the deploy date, and anything held or overridden.

## Done When

1. `pnpm-lock.yaml` resolves `hono ≥ 4.13.11`, `vite ≥ 8.3.3`, `@vitest/mocker ≥ 4.1.12`,
   `undici ≥ 7.29.1`, `sharp ≥ 0.35.5` and `source-map-js ≥ 1.2.2`, with no older copies left
   (`pnpm why <pkg>`).
2. `packageManager` is `pnpm@≥10.34.5`.
3. `pnpm check` is green.
4. The Worker is deployed with the new `hono` and passes the phone smoke test.
5. The `_overwatch` remediation log has this project's row filled in.

---

## Open Questions

- None yet. If a bump forces a major version on the Cloudflare tooling, that's the sponsor's call;
  record the option in this section before taking it.

---

## Decisions

- 2026-10-23 — Opened from the `_overwatch` sweep. Severity was ranked there (recipe §6.1):
  urdu counts as deployed, and its dev tooling counts as not shipped. Fix versions come only from
  the advisories' structured fields, never from advisory prose.
