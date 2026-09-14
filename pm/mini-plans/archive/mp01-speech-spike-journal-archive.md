# Journal — mp01 speech-spike

*Verbose per-front record. Hub: `pm/STATUS.md`; doc: `mp01-speech-spike-archive.md`.*

## 2026-09-14 — s01 verified, s02 served via Cloudflare, s03 tab-mode run

**s01 desktop check (Windows, Chrome 152).** No `ur-*` voice on the work machine (31 voices, en/es/fr/hi/... only). Urdu samples produced silent utterances: `startToEnd` 1–31 ms, i.e. the voice had nothing it could pronounce. Latin text ("hello world") with Microsoft David spoke fine, so audio path, voice selection, and latency readout are proven. **s01 done.**

Observation for f03: a non-empty utterance whose `onend` fires within ~50 ms of `onstart` is a reliable "voice cannot render this text" signal.

**s02 serve.** LAN route failed: laptop tethered to the phone's hotspot, Python `http.server` on 0.0.0.0:8765 was reachable locally but the phone could not load it (Windows Firewall, Public profile). Sponsor declined a firewall rule; switched to the Cloudflare fallback. Scaffolded `package.json` (wrangler 4.131.2 devDep), `wrangler.jsonc` (name `urdu`, `assets.directory = ./spikes/speech`, no Worker script yet), `.gitignore`. `npx wrangler login` (sponsor, OAuth) then `npx wrangler deploy` → **https://urdu.urdu.workers.dev/** (version 0eede4ea). Note: the account's workers.dev subdomain is `urdu`, not `umber-amber` as the pm docs assume — see open item below. **s02 done.**

**s03 phone run, tab mode (Android 10, Chrome 152, Google TTS).**

- Urdu voices present without installing anything: `Urdu India` (`ur_IN`) and `Urdu Pakistan` (`ur_PK`), both `localService: true`. 96 voices total, all local. Default voice is `as_IN` (Assamese), so the app must select explicitly.
- **Lang tags use underscores** (`ur_PK`, `hi_IN_#Latn`), not BCP-47 hyphens. `startsWith('ur')` matching works; anything comparing to `'ur-PK'` exactly would miss. f03 must normalise.
- Latency, ur_PK, single words, steady state: 50, 52, 56, 58, 58, 61, 64, 152 ms tap-to-`onstart`. **Median of last 10 = 60 ms** (bound: 300 ms). Pass.
- First utterance after page load: 845 ms. First utterance after switching voice (ur_IN→ur_PK): 1358 ms. One phrase at 1030 ms mid-run (n=3, cause unknown; the repeat was 13 ms). So warm-up is ~1 s per voice, then fast. f03 could pre-warm with an empty/silent utterance on voice select.
- Speech duration (`startToEnd`): words 730–1120 ms, short phrase ~1.1–1.5 s, long phrase 2.1 s. ur_PK is ~25% faster than ur_IN on the same words.
- Rate 1.0, pitch 1.0 throughout.

Raw results JSON: two runs pasted by the sponsor, kept in this session's transcript; utterance table summarised above.

**Still owed for s03:** sponsor 1–5 scores (words, phrases) for ur_PK; standalone (installed) run; quirks (screen lock, long-utterance cut-off, gesture requirement).

**Open item (not mp01's):** deploy target is `urdu.urdu.workers.dev`; CLAUDE.md, VISION, PRD, PLAN say `urdu.umber-amber.workers.dev`. Sponsor to confirm which account is intended; then fix docs or redeploy.

**s03 completed (sponsor report).** ur_PK scored 3.5/5 for words and 3.5/5 for phrases ("sounded fine to my ear"); ur_PK preferred over ur_IN. Installed from Chrome; launched from the home-screen icon; results JSON reports `standalone: true`; speech works. Speech stops when switching apps (acceptable). No gesture problem, no cut-off observed on the long phrase. **s03 done.**

**s04 verdict: PASS** on all four criteria. Recorded in the mini-plan §Decisions and promoted to `pm/DECISIONS.md` (260914a). PRD §2.3 now states the finding; FR-C4 gained the explicit ur-PK default rule, cancel-before-speak, and pre-warm note. PLAN Phase 0 mp01 line marked pass. Open question resolved: keep `spikes/speech/` until f03 ships `speak()`. Spike Worker deleted (`wrangler delete --name urdu`); `wrangler.jsonc` kept for mp02. Sponsor chose `umber-amber` as the hosting identity: the account's workers.dev subdomain needs renaming in the dashboard (sponsor). **s04 done; ready for `/pm-close`.**
