# Journal — mp09 security-bumps

**Current state (2026-10-23):** opened, nothing built yet. s01 `hono` 4.13.11 is next.

## 261023a — opened

Opened from the `_overwatch` vulnerability sweep of 2026-10-23 (window 2026-10-20 to 2026-10-23;
sources CISA KEV, NVD, GitHub Advisory Database, OSV). In urdu it found no malicious packages and
no KEV-listed CVEs. One runtime package ships in the Worker (`hono`). Everything else is dev
tooling pulled in through vite, vitest and miniflare, plus the pinned pnpm. The dependency paths
in the doc's table come from walking `pnpm-lock.yaml`. Full findings:
`C:\Users\jlock\dev\_overwatch\reports\vuln-sweep\2026-10-23\report.md`.
