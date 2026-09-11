# Mini-plan — Speech Spike

**Status**: 🟡 IN PROGRESS — opened 2026-09-11; Stage 0 (build the spike page)
**Handle**: `mp01`
**Created**: 2026-09-11 · **Updated**: 2026-09-11

**Owner docs it serves**:
- `pm/PRD.md` §2.3 (assumption: Android Chrome + Google TTS provides an Urdu voice, "verified by spike"), FR-C4 (`speak()` over SpeechSynthesis), FR-I1 (voice picker), §6 latency NFR (tap-to-speech under 300 ms).
- `pm/PLAN.md` Phase 0 exit ("speech verdict recorded") and Phase 4 (hosted TTS fallback if the verdict is fail).
- `pm/VISION.md` §5.2 (speech tested early; Pakistani voice preferred).

**Companions**: `mp02-gpt-live-spike` (the other Phase 0 spike; shares nothing but the phone and the Phase 0 exit gate). Feeds `f03-reader` (which will implement `speak()` for real).

> **One-line:** Build a throwaway static page, run it on the sponsor's Android phone, and record whether browser SpeechSynthesis produces an acceptable Urdu voice with acceptable latency, so f03 can build on `speak()` with evidence rather than hope. It's one mini-plan because the page, the phone run, and the verdict are worthless apart and none of them owns a vision.

---

## Stages

- **Stage 0 — Build the spike page.** One self-contained HTML file under `spikes/speech/`. No build tooling, no framework, no Worker. Verifiable in desktop Chrome before touching the phone.
- **Stage 1 — Run on the phone.** Serve the page to the sponsor's Android phone, exercise it in tab and installed (standalone) modes, capture measurements and impressions. Gated on Stage 0 and on the sponsor having the phone in hand.
- **Stage 2 — Verdict.** Record pass/fail against the criteria in §Done When, promote the verdict to `pm/DECISIONS.md`, amend PRD §2.3 / FR-C4 wording as needed, then `/pm-close`.

Stages are strictly sequential.

## Slices

- **mp01-s01 — Spike page.** `spikes/speech/index.html` (single file, inline CSS/JS, no dependencies). Contents:
  - Voice list: every `speechSynthesis.getVoices()` entry with name, `lang`, `localService`, `default`; Urdu voices (`lang` starting `ur`) highlighted and preselected. Must handle the async `voiceschanged` event (Android Chrome returns an empty list on first call) and a manual "Reload voices" button.
  - Sample bank rendered in Nastaliq-capable RTL text: six everyday words (پانی, کتاب, دوست, شکریہ, بازار, مہربانی) and two phrases (آپ کیسے ہیں؟ · مجھے اردو سیکھنا پسند ہے), plus a free-text box.
  - Tap any sample to speak it with the selected voice; rate and pitch sliders.
  - Latency readout per utterance: milliseconds from the tap handler to `onstart`, and from `speak()` to `onend`; last ten shown with a median. Errors from `onerror` shown inline.
  - `speechSynthesis.cancel()` before each `speak()` (Android Chrome queues otherwise).
  - Minimal inline web-app manifest (data URI) so the page can be added to the home screen and tested in standalone display mode.
  - Verify: opens in desktop Chrome on Windows, lists voices, speaks a sample with whatever voice exists, latency readout populates.
- **mp01-s02 — Serve it to the phone.** Depends on s01. First choice: serve `spikes/speech/` over the LAN (`npx serve spikes/speech` or Python `http.server`) and open the LAN URL in Android Chrome. SpeechSynthesis does not require a secure context, so plain HTTP is fine. Fallback if the LAN route is awkward: `wrangler deploy` with static assets to `urdu.umber-amber.workers.dev` (the Worker skeleton mp02 needs anyway). Verify: the page loads on the phone and lists voices.
- **mp01-s03 — Phone run and measurements.** Depends on s02. Sponsor performs, agent records in the journal:
  - Which Urdu voices appear (name, lang, local vs network). If none: install Urdu in Android *Settings → Google Text-to-speech → Install voice data* and retry; note whether that was needed.
  - Ten taps on single words: median tap-to-`onstart` latency.
  - Subjective acceptability, sponsor-scored 1–5 for words and for phrases separately: pronunciation, naturalness, whether the phrase is intelligible as Pakistani Urdu.
  - Same checks launched from the home-screen icon (standalone mode). Note any difference (voices missing, first-utterance silence, audio focus issues).
  - Quirks: first utterance after page load needing a gesture; long utterances cut off; rate/pitch effects; behaviour with screen locked.
- **mp01-s04 — Verdict.** Depends on s03. Fill §Decisions with the verdict and the evidence summary; prepend the speech verdict to `pm/DECISIONS.md`; update `pm/PRD.md` §2.3 assumption from "verified by spike" to the actual finding, and FR-C4 if the default-voice rule changes. If fail: leave PLAN Phase 4 hosted-TTS line as is and add a note to f03 that `speak()` must be adapter-shaped from day one. Then `/pm-close mp01`.

## Done When

All of the following are true:
1. `spikes/speech/index.html` exists, runs on the phone, and its measurements are recorded in `mp01-speech-spike-journal.md`.
2. A pass/fail verdict is recorded in this doc's §Decisions and promoted to `pm/DECISIONS.md`, using these criteria:
   - **Pass** = at least one Urdu (`ur-*`) voice is available in Android Chrome (after installing voice data if needed) **and** median tap-to-`onstart` latency is under 300 ms **and** the sponsor scores both words and phrases at 3/5 or better **and** speech works in standalone (installed) mode.
   - **Fail** = any criterion unmet. Consequence: f03 builds `speak()` as an adapter and v1 adds hosted TTS (Azure ur-PK) behind it, per PLAN Phase 4.
3. `pm/PRD.md` §2.3 no longer says "verified by spike"; it states the finding.
4. Phase 0 exit for speech is satisfied in `pm/PLAN.md` terms (the FR-G half of the exit belongs to mp02).

---

## Open Questions

- **Is the spike page kept or deleted after the verdict?** Options: (a) keep `spikes/speech/` as a reference until f03 lands its `speak()`, then delete; (b) delete at close. Agent's call; leaning (a) because the voice-list and latency harness is useful during f03. Resolve at s04.
- **What if only a network (non-local) Urdu voice exists?** Network voices on Android Chrome add latency and fail offline. Treat as pass only if latency still meets 300 ms; record the distinction either way. Agent's call at s04.

---

## Decisions

- 2026-09-11 — Spike is a single dependency-free HTML file under `spikes/speech/`, served over LAN first, Cloudflare only as fallback. Rationale: PLAN Phase 0 allows repo skeleton "only as far as the spikes need it"; a static page needs none.
- 2026-09-11 — Pass criteria fixed as in §Done When before any measurement is taken, so the verdict cannot be argued to fit the result. The 300 ms bound comes from the PRD §6 latency NFR.
