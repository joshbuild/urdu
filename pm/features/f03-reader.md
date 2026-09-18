# Feature Plan — Reader

**Status**: 🟡 IN PROGRESS *(opened 2026-09-17 — s01-s06 built, s07 next)*
**Handle**: `f03`
**Created**: *2026-09-17* · **Updated**: *2026-09-17*

**Owner docs it serves**:
- `pm/PRD.md` — FR-C1..C8, the FR-I1 voice picker, NFR latency/mobile lines
- `pm/PLAN.md` — Phase 2 roster row
- `shared/normalize.ts` — `urdu_key` equality drives the Define lookup and duplicate rejection

> **One-line:** Paste Urdu into the phone, read it in Nastaliq, tap any word to hear it, select any phrase to speak, define, or save it to the vault.

## Intent

### Vision

Today the sponsor reads Urdu by pasting it somewhere that renders Nastaliq badly, guessing at pronunciation, and typing new words into Airtable later — if at all. The reader collapses that into one surface. Text goes in; it renders properly, large and right-to-left; every token is one tap from being spoken in a real Urdu voice; anything worth keeping is two taps from the vault with its source sentence attached. It is the feature that makes the vault grow from actual reading rather than from a separate act of bookkeeping, and it is the first screen of this app the sponsor will use daily.

It must be useful with no LLM call at all. Define is a vault lookup with dictionary links behind it, not a model.

### Scope

FR-C1..C8 in full, plus the FR-I1 voice picker (the piece of Settings that FR-C4 depends on — the rest of Settings is f04):

- Paste area, RTL Nastaliq render, newlines to paragraphs, self-hosted Noto Nastaliq Urdu.
- Whitespace/punctuation tokenization with ZWNJ-joined compounds intact; tokens tappable; native selection preserved across them.
- `speak(text)` over SpeechSynthesis with the ur-PK voice-resolution ladder, cancel-before-speak, and voice pre-warm.
- Selection action bar (Speak · Add to vocab · Define) floating above the native selection.
- Add-to-vocab form prefilled from the selection/token, kind inferred, source sentence into notes; saves through the existing vocab endpoint; inline duplicate rejection linking the existing item.
- Define: `urdu_key` vault lookup first, external dictionary links second.
- Current text persisted to localStorage.
- A voice picker, persisted locally, shared by every `speak()` caller.

### Exclusions

- **Vocab browse/search/edit (FR-D1..D2)** — f04. The reader only *creates*; the duplicate link may point at a vocab route that does not exist yet and will be a dead end until f04.
- **Review (FR-E)** — f05. Adding from the reader never touches mastery; new items land at mastery 0 and are due immediately, which is existing FR-A behaviour, not new work here.
- **The rest of Settings (review session limit, lock this device, voice spend)** — f04/f07. Only the voice picker comes forward, because FR-C4 cannot ship without it.
- **LLM-backed definitions** — an explicit v0 non-goal. Define is a lookup plus links, deliberately, not a cheaper model call.
- **Saved passages / recent texts** — Phase 4. One current text in localStorage, no server persistence (FR-C8).
- **Hosted TTS** — mp01 settled that device SpeechSynthesis is acceptable; hosted TTS is the v1 fallback behind the same `speak()` seam.
- **Desktop right-click menu** — v1 (Phase 4). Touch selection is the v0 target.

### User Stories

- As the sponsor, I want to paste a WhatsApp message into the app and see it in proper Nastaliq, so that I can read it without fighting the rendering.
- As the sponsor, I want to tap any word and hear it in an Urdu voice, so that I learn pronunciation while reading rather than in a separate drill.
- As the sponsor, I want to select a phrase and speak it, so that I hear how the words join in context.
- As the sponsor, I want to save a word or phrase I just met straight into the vault with the sentence I met it in, so that it comes back in review with the context intact.
- As the sponsor, I want to check whether I already have a word before saving it, so that the vault does not fill with near-duplicates.
- As the sponsor, I want the app to re-open on the text I was reading, so that a phone lock mid-passage costs nothing.

### Non-Functional Requirements

- Tap-to-speech start under 300 ms on the phone (PRD NFR), which is what the pre-warm in FR-C4 exists to buy.
- Hit targets at least 44 px; usable one-handed; the action bar must not sit under the selection handles.
- Nastaliq must not depend on device fonts — the font is self-hosted and subset, and its weight must not wreck first paint on a phone connection.
- Native text selection must keep working across tokens; no custom long-press handler may pre-empt it.
- The reader must be fully functional with no network beyond the initial load, except for Add to vocab and the vault half of Define.
- No secret ever reaches the client; the reader uses the existing session cookie.

## Planning

### Testing

- **Unit (node project):** tokenizer — whitespace, Urdu punctuation, ZWNJ-joined compounds kept whole, mixed Latin/digits, empty and whitespace-only input.
- **Unit:** voice resolution — `ur_PK` / `ur-PK` / `ur-IN` / no-Urdu-voice cases, and the never-the-browser-default rule that mp01 found (Assamese on the sponsor's phone).
- **Unit:** kind inference (`phrase` iff the term contains whitespace) and source-sentence extraction from a token or selection.
- **Component:** action bar appears on selection and clears on collapse; Add form prefill; duplicate response renders inline rather than as an error toast.
- **Manual on the phone (the real gate):** paste a real passage; tap latency feels instant; selection handles behave natively; add a word and see it in `GET /api/export`; Define finds an existing word and offers links for a new one; reload restores the text; installed-PWA run, not just a tab.
- Edge cases: very long pasted text; text with no Urdu at all; a token that is pure punctuation; selection spanning paragraphs; speaking while a previous utterance is still playing.

### Done When

1. FR-C1..C8 are each demonstrably implemented, and FR-I1's voice picker exists and drives `speak()`.
2. `pnpm check` is green, including the new tokenizer, voice-resolution and inference tests.
3. Deployed to `urdu.umber-amber.workers.dev` and verified by the sponsor on the installed Android PWA: paste, tap-speak, select-speak, add (visible in export), define both ways, reload restores.
4. Tap-to-speech start is subjectively instant on the phone (PRD's 300 ms budget).
5. `spikes/speech/` is deleted, its `speak()` behaviour now living in the app (TODO, mp01 decision 2026-09-14).
6. A smoke-test doc records the phone run, as f01 and f02 did.

### Roadmap

Vertical slices, each committed to `main` on its own:

- **s01 — Shell and routing.** A reader screen behind the existing unlock, with whatever minimal navigation the app needs to have more than one screen. Nothing Urdu-specific yet.
- **s02 — Font and render.** Self-hosted subset Noto Nastaliq Urdu, RTL paragraph rendering, paste area, localStorage persistence (FR-C1, C2, C8).
- **s03 — Tokenizer.** Pure function in `shared/` with its tests; tokens rendered as tappable elements without breaking native selection (FR-C3).
- **s04 — Speech.** `speak()` plus voice resolution and pre-warm, and the Settings voice picker (FR-C4, FR-I1 partial). Port from `spikes/speech/`; delete the spike.
- **s05 — Selection action bar.** Positioning above the native selection, Speak wired (FR-C5).
- **s06 — Add to vocab.** Form, prefill, kind inference, source sentence, save through the existing endpoint, inline duplicate handling (FR-C6).
- **s07 — Define.** Vault lookup by `urdu_key`, then external links (FR-C7).
- **s08 — Deploy and phone verification.** Sponsor runbook plus smoke-test doc; the Done-When gate.

s01–s03 are independent of the Worker entirely. s06 is the only slice that needs an API, and that API already shipped in f01.

## Status

### Recently Completed

- *2026-09-17* — **s06 Add to vocab (FR-C6).** Add on the action bar opens a bottom sheet over the passage (scroll position survives). Prefilled with the selection; kind inferred from the final Urdu via `shared/normalize.ts` `inferKind`; the source sentence (first sentence of the selection's paragraph holding the term, split on ۔ ؟ . ? !) goes in notes per the PRD; comma or Urdu-comma tags. Saves through `POST /api/vocab` with `source: "reading"`. A 409 shows the existing entry inline, fetched by id. Pure logic in `src/reader/addVocab.ts`. 277 tests. Untested against a live origin or phone.
- *2026-09-17* — **s05 selection action bar (FR-C5).** `src/reader/actionBar.ts` places the bar from the selection rect as a pure function: above when it fits, else below, never under the tab bar, clamped to the screen edges. The screen follows `selectionchange` (plus scroll/resize), only for selections inside the reader, and suppresses pointerdown on the bar so a press does not collapse the selection. Speak is wired; Add and Define render disabled for s06/s07. 266 tests. Collision with Android's own selection toolbar is still unverified on the phone.
- *2026-09-17* — **s04 speech and the voice picker (FR-C4, FR-I1).** `src/reader/speech.ts` ports the spike's `speak()` — cancel-before-speak, pre-warm on silence — with the resolution ladder as a pure function over a narrow `VoiceLike` shape (saved choice, ur-PK, any ur-*, else null; never the browser default). `useVoice` holds the one voice for the app; Settings picks it, Urdu voices first, with a sample and an honest "no Urdu voice installed" state. Reader taps go through one delegated listener and do not fire when the tap merely ends a selection drag. `spikes/speech/` deleted, its TODO item dropped and `spike:check` narrowed to the remaining spike. 257 tests.
- *2026-09-17* — **s03 tokenizer (FR-C3).** `src/reader/tokens.ts` splits a paragraph into word and separator pieces, keeping ZWNJ compounds and tashkeel inside the word; the separator set is code-point ranges, not a regex class, because the class carried invisible characters the formatter rewrote into literal bytes. Words render as spans (not buttons) so native selection keeps flowing across them. 248 tests.
- *2026-09-17* — **s02 paste, render, persist (FR-C1, C2, C8).** Noto Nastaliq Urdu Regular self-hosted, subset to the Arabic block by `scripts/subset-font.sh` — 114 KB woff2 against 172 KB full — with a matching `unicode-range` so Latin falls back to system-ui by design. RTL paste area, paragraphs at 2.2 line height, current text in localStorage. `toParagraphs` tested in a new `client` node Vitest project. 237 tests.
- *2026-09-17* — **s01 shell and navigation.** `src/App.tsx` keeps the unlock gate and grows a fixed bottom tab bar (Read · Vocab · Review · Settings) shown only once unlocked; screens split into `src/screens/`. Reader is a stub; Vocab and Review carry the vault counts the f01 home screen used to show; Settings carries "lock this device" forward and will hold the s04 voice picker. Selected tab persists in localStorage inside try/catch. `pnpm check` green, 232 tests.
- *2026-09-17* — Front opened; doc written from the PRD FR-C block and PLAN Phase 2.

### Next Steps

1. Start **s07**, Define (FR-C7), once the sponsor confirms the link set. A sponsor deploy is worth doing first to check the s05 bar and the s06 sheet on the phone.
2. Unverified on a device: everything from s02 onward has only been typechecked, tested and built locally. The font weight, Nastaliq rendering, tap latency and selection behaviour are all phone questions (s08).

### Open Questions

- **Action bar vs. the OS selection toolbar (sponsor may need to weigh in at s05).** Android Chrome shows its own copy/share bar on selection. If the two collide unusably on the phone, the fallback is a fixed bar at the bottom of the viewport rather than a floating one.
- **Define link set (sponsor).** PRD names Rekhta, Wiktionary and Google Translate. Confirm those three are the ones actually wanted before s07.

## Decisions

*Dated, append-only. Promote project-wide decisions to `pm/DECISIONS.md`.*

- *2026-09-17* — **Duplicate shows the existing entry inline, not a link (s06).** FR-C6 asks for a link to the existing item, but its destination (f04 vocab detail) does not exist, so a link would be a dead end. The sheet fetches `GET /api/vocab/:id` and shows Urdu · Roman · English in place. f04 can turn it into a link.

- *2026-09-17* — **Tab bar, not a router (s01).** Phase 2 adds three screens and none of them are deep-linked or shareable — this is a single-user installed PWA. A four-item tab bar with the selection in localStorage covers it; a router would add a dependency and a URL surface for nothing. Revisit if a screen ever needs to be linked to (e.g. the duplicate link from FR-C6 into f04's vocab detail), which is f04's call to make.
- *2026-09-17* — **No component-test stack in f03.** The repo has no jsdom or testing-library and adding one is a real cost on this machine (AVG, bounded Vitest workers). Instead the reader's decidable logic — tokenizer, voice resolution, kind inference, action-bar positioning from a selection rect — is written as pure functions in `shared/` and tested in the existing node project; the rendered UI is verified on the phone at s08, as f01 and f02 were. If a slice produces UI logic that cannot be pulled into a pure function, reopen this.
- *2026-09-17* — **Voice picker comes forward from f04 into f03.** FR-C4 requires a chosen voice and mp01 proved the browser default is unusable here (Assamese). Shipping the reader without a picker would ship a broken tap-to-speak. The rest of FR-I1 stays in f04.
