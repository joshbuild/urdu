# Journal — f03 `reader`

*Verbose per-session narration for f03. The feature doc (`f03-reader.md`) is canonical for scope, plan and decisions; this file is the story of how it went. Newest session at the top.*

## 260917g — opened f03; s01–s04

**Current state**: s01–s04 built and committed on `main`, `pnpm check` green at 257 tests. Nothing has been on a device. s05 (selection action bar) is next.

**Opened the front from a cold Phase 2 start.** The roster's next row was f03 and Phase 1's exit conditions were all met, so the gate was a formality. The doc was written from the PRD's FR-C block rather than invented: eight vertical slices, each small enough to commit on its own, with s01–s03 needing no Worker at all and only s06 touching an API that f01 already shipped.

**One scope call at open time.** FR-I1's voice picker is nominally f04's, but FR-C4 cannot work without a chosen voice, and mp01 established that the browser default on the sponsor's phone is Assamese. Shipping the reader without a picker would ship a broken tap-to-speak, so the picker came forward and the rest of Settings stayed behind.

**s01 — a tab bar, not a router.** The f01 shell was one screen; Phase 2 needs four. Nothing in this app is deep-linked or shareable — it is a single-user installed PWA — so a router would buy a URL surface nobody uses and a dependency to keep. Four tabs with the selection in localStorage covers it. The vault counts that used to be the home screen moved onto Vocab and Review, where they mean something, and "lock this device" moved to Settings.

**s02 — the font was the whole slice.** The sponsor supplied Google Fonts' zip, which is TTFs; the web needs woff2. `python -m fontTools` was already available, so `scripts/subset-font.sh` now extracts the Regular weight, subsets it and compresses it, reproducibly, with the zip and extracted TTFs gitignored and only the 114 KB result committed. Measurements: 529 KB TTF → 172 KB full woff2 → **130 KB** subset with Latin → **114 KB** Urdu-only. Took the last one and declared a matching `unicode-range`, which makes the Latin fallback to system-ui *deliberate* rather than something that merely happens; the 13 KB was the smaller half of that argument. `--layout-features='*'` is not optional here — Nastaliq is almost entirely GSUB/GPOS, and a feature-pruned subset is not the script any more.

**s03 — the regex that could not be read.** The tokenizer's separator class was written with `\uXXXX` escapes; Biome's formatter decoded them into literal characters on write, leaving a no-break space sitting invisibly in the source. Rewrote the set as commented code-point ranges. That is not a workaround — it is better code, since every range now says what it covers, but the underlying formatter behaviour applies to any regex in this repo and went to DECISIONS.

Tokens render as `<span>`, not `<button>`. A button leaves the inline flow, fights Nastaliq's shaping and brings Android's own press handling to a surface whose hard requirement (FR-C3) is that native selection keeps working across tokens.

**s04 — the spike's findings did the design work.** mp01 measured ~1 s for a voice's first utterance and 13–60 ms after, and found that Android Chrome queues utterances unless you cancel first. Both are in `speak()`: cancel-before-speak, and a silent zero-volume pre-warm fired when a voice is first settled on, so the first real tap is not the one that pays. The resolution ladder is a pure function over a narrow `VoiceLike` shape — three fields — specifically so it could be tested in node without a DOM: saved choice, then `ur-PK`, then any `ur-*`, then **null**. Returning null matters: with no Urdu voice installed the app says so and points at Android's TTS settings rather than reading Urdu aloud in Assamese.

Voice state lives once in `App` and is passed to both the reader and Settings, because two components disagreeing about which voice speaks is the obvious failure here. Reader taps use one delegated listener rather than a handler per token (a long passage is thousands of tokens), and a tap that merely ends a selection drag is ignored — the selection belongs to s05's action bar.

**Deleted `spikes/speech/`**, which was mp01's stated condition and Done-When #5: `speak()` now lives in `src/reader/speech.ts`. Consumed the TODO item and narrowed `spike:check` to the one remaining spike.

**Testing shape settled early.** The repo has no jsdom or testing-library, and adding one on this machine is a real cost. Rather than pay it, the reader's decidable logic is written as pure functions in `src/reader/` and tested in a new `client` node Vitest project; the rendered UI is verified on the phone at s08, as f01 and f02 were. This shaped the code for the better — `toParagraphs`, `tokenize`, `inferKind` and `chooseVoice` are all pure because they had to be — and s05's bar positioning is written the same way. If a slice ever produces UI logic that resists that, the decision reopens.

**Left at**: everything from s02 onward is typechecked, tested and built, and none of it has rendered on a phone. Font weight over a mobile connection, Nastaliq at 2.2 line height, tap latency against the 300 ms budget, and whether a floating action bar can coexist with Android Chrome's own selection toolbar are all device questions. s08 is where they get answered, but s05 is about to be built on top of the last of them — worth considering a deploy first.
