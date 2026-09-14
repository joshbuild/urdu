# Journal — f01 urdu-core-foundation

*Verbose per-front record. Hub: `pm/STATUS.md`; doc: `f01-urdu-core-foundation.md`.*

## 2026-09-14 — opened

Opened after Phase 0 closed (mp01 speech PASS, mp02 GPT-Live PASS → FR-G Option 2). Doc written from PLAN Phase 1, PRD FR-A1..A8, FR-B1..B4, Appendices A/B, and §6 NFRs. Eight slices (s01 scaffold → s08 deploy + phone). Five sponsor questions batched in the doc (unlock rate limiting, cascade on delete, secret shape, production smoke, Hono). Build paused until answered, at sponsor request.

State found at open: `wrangler.jsonc` still points at `spikes/gpt-live/`; `package.json` has only wrangler and was installed with npm (`package-lock.json` present) although the project decision is pnpm; pnpm 10.11 and Node 22.15 available locally. Worker `urdu` does not currently exist on Cloudflare (sponsor deleted the spike Worker), so no D1 database or secrets exist yet.

Noted while planning: `pnpm deploy` is a pnpm built-in command, so the deploy script must be run as `pnpm run deploy`.
