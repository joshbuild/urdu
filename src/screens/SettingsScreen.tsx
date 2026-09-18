// f03 s01/s04. Carries "lock this device" forward from the f01 shell and holds the voice picker
// (FR-I1). The rest of FR-I1 — review session limit, voice spend — belongs to f04 and f07.

import { isUrdu, speak } from "../reader/speech";
import type { VoiceState } from "../reader/useVoice";

const SAMPLE = "السلام علیکم، آپ کیسے ہیں؟";

export function SettingsScreen({
  onLock,
  busy,
  voiceState,
}: {
  onLock: () => void;
  busy: boolean;
  voiceState: VoiceState;
}) {
  const { voices, voice, select, supported } = voiceState;

  // Urdu voices first: a phone can carry dozens, and the two that matter should not be buried.
  // The rest stay listed, because an explicit choice is the sponsor's to make.
  const ordered = [...voices].sort(
    (a, b) =>
      Number(isUrdu(b)) - Number(isUrdu(a)) ||
      a.lang.localeCompare(b.lang) ||
      a.name.localeCompare(b.name),
  );

  return (
    <section className="panel">
      <p className="eyebrow">SETTINGS</p>

      <h2>Voice</h2>
      {!supported ? (
        <p className="hint">
          This browser has no speech synthesis, so tap-to-speak is unavailable.
        </p>
      ) : voices.length === 0 ? (
        <p className="hint">Looking for installed voices…</p>
      ) : (
        <>
          <label htmlFor="voice">Speaking voice</label>
          <select
            id="voice"
            value={voice?.voiceURI ?? ""}
            onChange={(event) => select(event.target.value)}
          >
            {voice === null && <option value="">No Urdu voice installed</option>}
            {ordered.map((option) => (
              <option key={option.voiceURI} value={option.voiceURI}>
                {option.lang} · {option.name}
              </option>
            ))}
          </select>
          <p className="hint">
            {voice
              ? "Urdu voices are listed first by language code. Pakistani Urdu (ur-PK) is chosen by default."
              : "Android has no Urdu voice installed. Add one under Settings › Accessibility › Text-to-speech, then reopen this app."}
          </p>
          <button
            type="button"
            className="secondary"
            onClick={() => speak(SAMPLE, voice)}
            disabled={!voice}
          >
            Hear a sample
          </button>
        </>
      )}

      <h2>This device</h2>
      <p className="hint">
        Locking deletes this device's session. You will need your personal secret to unlock again.
      </p>
      <button type="button" className="secondary" onClick={onLock} disabled={busy}>
        {busy ? "Locking…" : "Lock this device"}
      </button>
    </section>
  );
}
