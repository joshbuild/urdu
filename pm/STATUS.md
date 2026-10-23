# Status - Urdu PWA
*v0.01 | 2026-09-11*

**File Purpose**: The **thin hub** — a cross-front map of where things stand *right now*. Not a journal, not a sessions log. Verbose per-front narration lives in each front's `*-journal.md`; what-happened one-liners live in `SESSIONS.md`. Keep this file scannable.

*As of: 2026-10-22*

## Open Workfronts
*Work items actively in flight. One line each → its doc/journal. Closed fronts drop off (rosters keep the full list).*

- f07 `coach-client` — 🟡 IN PROGRESS, s01–s04 built (migration 0003 applied remotely and deployed 2026-09-23); s05 prompt tuning next → `features/f07-coach-client.md`
- f18 `topic-coverage` — 🟡 IN PROGRESS, opened 2026-10-06 (DECISIONS 261006a); s01–s05 built and deployed (0008 remote); smoke-test-18 steps 1–3, 5 pass, step 4 open → `features/f18-topic-coverage.md`
- mp05 `voice-vocab-bucket` — 🟡 IN PROGRESS, opened and stress-tested 2026-10-02 (s01–s07; Voice words held from top-up, DECISIONS 261002a); s01 `find_vocab` built 2026-10-22, s02 Voice harvest next (no migration) → `mini-plans/mp05-voice-vocab-bucket.md`
- mp07 `review-tweaks` — 🟡 IN PROGRESS, opened and built 2026-10-22 (DECISIONS 261022a): suss cards, search first, `conjugation` topic, calendar to black at 400; migration 0009 applied remotely (confirmed 2026-10-22); deploy + phone next → `mini-plans/mp07-review-tweaks.md`
- mp08 `check-scope` — 🟡 IN PROGRESS, opened 2026-10-22 (DECISIONS 261022b): topic & level as a check field, `checked_fields` mask (migration 0010), Which words, generated `vocab-json.md`; s01–s02 built (0010 local only), s03 Which words next → `mini-plans/mp08-check-scope.md`
- mp06 `mixed-direction` — 🟡 IN PROGRESS, opened 2026-10-15 (DECISIONS 261015a); s01–s03 built (`b600b71`, not deployed); s04 phone next → `mini-plans/mp06-mixed-direction.md`

## Next Session Pointers
*The 1–3 concrete next actions for a cold start.*

1. **mp07 `review-tweaks`**: 0009 is applied remotely (the sponsor's `migrations list --remote` showed none pending, 2026-10-22, after the first attempt failed). Sponsor runs `pnpm wrangler d1 migrations apply urdu --remote` (mp08's 0010: `main` needs it, or check batches fail) then `pnpm run deploy` (also ships mp06 and f18's undeployed work), re-uploads `prompts/vocab-tags.md` to the ChatGPT Project, then `smoke-tests/smoke-test-mp07.md`. Confirm "vocab search" meant the buried search box.
2. **mp08 `check-scope`**: s01–s02 built (Topic & level is a check field); s03 Which words next, then s04 `vocab-json.md` → `mini-plans/mp08-check-scope.md`.
3. **mp06 `mixed-direction`**: built, not deployed. Sponsor runs `pnpm run deploy` (no migration; this also ships f18's Dash charts and batch fix) and uses Mixed in normal review; close on a report that the mix feels right and production recall fills in → `smoke-tests/smoke-test-mp06.md`.
4. **mp05 `voice-vocab-bucket`**: s01 `find_vocab` built (not deployed; `get_vocab`'s `tag` is now `topic`); s02 Voice harvest next (no migration) → `mini-plans/mp05-voice-vocab-bucket.md`.
5. **f07 `coach-client`**: s04 spend is deployed; the sponsor compares Settings spend with the OpenAI dashboard later on 2026-09-23 (TODO). Then s05 prompt tuning. The rest of the s03 checks ride smoke-test-07. The OpenAI key is a Cloudflare secret only, so live voice checks run against the deployment, never `pnpm dev` (260921a). Once f07 closes, open f10 `coach-followups` (planned 2026-09-22 from the grill of the two Coach scope calls, DECISIONS 260922a): a vocab-edit voice tool, tappable Urdu in bubbles, the last transcript kept on the device. Toolchain: AVG Hardened Mode + CyberCapture off; never add exceptions.
6. **f18 `topic-coverage`**: Next batch size fix (DECISIONS 261008a) and the two Dash charts by level (FR-J7/J8) committed, not deployed: sponsor runs `pnpm run deploy`; the next Next batch at the A1 tail should fill to 25 and move into A2. smoke-test-18 steps 1–3 and 5 pass. Step 4: sponsor reveals a word that shows a chip on Vocab (Topic filter); if the chip shows, reword step 4 and close f18; if not, debug with a screenshot → `features/f18-topic-coverage-journal.md`.
