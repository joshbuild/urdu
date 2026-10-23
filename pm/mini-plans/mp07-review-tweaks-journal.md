# Journal — mp07 review-tweaks

**Current state (2026-10-22):** built and pushed (`be2ddae`); 0009 is applied remotely (the
sponsor's `migrations list --remote` showed none pending). Not deployed; `main` now also needs
mp08's 0010 remotely before the deploy.

## 261022d — 0009 confirmed remote

The sponsor ran `pnpm wrangler d1 migrations list urdu --remote`: "No migrations to apply", so a
later attempt landed 0009. STATUS, the mp07 Done When and AGENTS updated. Deploy still the
sponsor's.

## 261022b — pushed; remote 0009 apply failed

Pushed `be2ddae`. The sponsor ran `pnpm wrangler d1 migrations apply urdu --remote` and got
"A request to the Cloudflare API (…/d1/database/3b3e…/query) failed", without the follow-on
reason line. Likely causes: expired wrangler login (fix: `pnpm wrangler login`, re-apply), a
partial apply ("duplicate column name: suss_at", since 0009 is two ALTERs; fix: mark it applied
rather than re-run), or a network blip (re-run). Next: `pnpm wrangler whoami` and
`pnpm wrangler d1 migrations list urdu --remote`, plus the full error text. Do not deploy until
0009 is applied: the new code reads `suss_at`.

## 261022a — opened and built s01–s04

Sponsor asked for four tweaks in one message: a Suss button on review cards with a place to see
flagged cards, comment, and a copy-prompt / paste-JSON round trip; Vocab search; a grammar topic
for verb conjugations; review calendar colours going to black at 400 a day. Bundled as mp07
(no vision of its own), DECISIONS 261022a.

- **s01 calendar:** `calendarLevel` now counts `CALENDAR_STEPS` (1, 10, 25, 50, 100, 175, 275,
  400), nine shades, teal into black; legend ends "400+".
- **s02 conjugation:** topic 51 `conjugation` after `modals`, quotas 12/15/10 (agent's estimate),
  a boundary line in `TOPIC_BOUNDARIES`; `prompts/vocab-tags.md` regenerated.
- **s03 search:** search already existed (f04) under New item and the ChatGPT panel. Read the
  request as "hard to find": the box now heads the tab, the actions and panel hide while it
  holds text, and the server also matches notes and examples. Flagged as an open question in
  case the sponsor meant something else.
- **s04 suss:** migration 0009 (`suss_at`, `suss_note`); `PUT`/`DELETE /api/vocab/:id/suss`,
  `?suss=true` on the list. A flag leaves `updated_at` alone because grades are guarded on it.
  The round trip reuses the check batch (`suss: true` → mode both, every field, issue time in the
  payload; apply clears flags set before it). The paste sheet gained a suss mode that lists
  "kept as they are" rows with ChatGPT's reasons, since a comment wants an answer even when
  nothing changes. The correction parser now tolerates an echoed `comment`. The comment shows on
  the card after reveal only (it may name the answer).

Verification: targeted tests, then `pnpm check` green at 849. A `git stash` round trip to compare
lint against HEAD left the touched files CRLF (autocrlf), which Biome rejects; converted back to
LF. Headless screenshots were not possible: probing the local dev server was denied by the
session's permissions, so the review top row (now four actions, allowed to wrap at 12 px gaps)
is in the phone smoke instead. Dev server stopped, no strays.

Next: sponsor applies 0009 remotely, deploys, re-uploads `prompts/vocab-tags.md`, runs
`smoke-tests/smoke-test-mp07.md`.
