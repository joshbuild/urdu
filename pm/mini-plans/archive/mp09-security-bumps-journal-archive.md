# Journal — mp09 security-bumps

**Current state (2026-10-23):** closed. Deployed by the sponsor and phone smoke passed; `_overwatch` row filled.

## 261023a — opened

Opened from the `_overwatch` vulnerability sweep of 2026-10-23 (window 2026-10-20 to 2026-10-23;
sources CISA KEV, NVD, GitHub Advisory Database, OSV). In urdu it found no malicious packages and
no KEV-listed CVEs. One runtime package ships in the Worker (`hono`). Everything else is dev
tooling pulled in through vite, vitest and miniflare, plus the pinned pnpm. The dependency paths
in the doc's table come from walking `pnpm-lock.yaml`. Full findings:
`C:\Users\jlock\dev\_overwatch\reports\vuln-sweep\2026-10-23\report.md`.

## 261023b — s01–s03 built

- **Release checks.** Every target is on the public registry and weeks old: `hono` 4.13.11
  (2026-09-29), `vite` 8.3.3, `vitest` 4.1.12, `undici` 7.29.1 and `sharp` 0.35.5 all carry SLSA
  provenance. `source-map-js` 1.2.2 (2026-09-30) and `pnpm` 10.34.5 (2026-07-10) have none, but
  they're well past 72 h and come from the same publishers as the versions before them, so both
  were taken.
- **s01 `hono` 4.13.11** `087e03b`. The advisory (GHSA-5r4p-p66f-jhc7) is about `serveStatic`
  decoding paths twice. We import only `hono`, `hono/cookie` and `hono/factory`, so we were never
  exposed. Nothing in the 4.13.8–4.13.11 notes touches our routes or middleware. 4.13.10 deprecates
  `hono/<adapter>` imports, which we don't use. 4.13.13 is out, but we stayed on the planned pin.
- **s02 dev tooling** `080c3cd`. `vite` 8.3.3 and `vitest` 4.1.12 (bringing `@vitest/mocker`
  4.1.12). Both the pool (`^4.1.0`) and `@vitejs/plugin-react` (`^8.0.0`) accept them as peers.
  `undici`, `sharp` and `source-map-js` go through `pnpm.overrides`; see the Decisions entry on
  why wrangler stays put. The lockfile now has exactly one copy of each package, all at the fixed
  versions.
- **s03 pnpm 10.34.5** `a495c7a`. The global pnpm is still 10.11.0. pnpm 10 switches itself to
  the `packageManager` version, so `pnpm --version` in the repo reports 10.34.5. `pnpm install
  --frozen-lockfile` is clean. The global upgrade is still the sponsor's job (`_overwatch` *Global
  pnpm*).
- **Verification.** `pnpm check` was green after each slice, 903 tests, about 2 min a run (slower
  than the 33 s baseline: probably the AVG toggles have re-synced, not the bumps). I wasn't allowed
  to start `pnpm dev`, so that check is skipped. The Workers-pool tests and both production builds
  do run the new vite and the overridden miniflare.

## 261023c — s04 deployed, closed

The sponsor ran `pnpm run deploy` (which also shipped the undeployed mp06, mp07, mp08 and f18 work) and the phone smoke passed. The urdu row in the `_overwatch` remediation log is filled in and marked closed. mp09 is archived.
