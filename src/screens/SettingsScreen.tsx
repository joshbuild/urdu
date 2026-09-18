// f03 s01/s04, f04 s06. Lock this device (from the f01 shell), the voice picker, and the review
// session limit (FR-I1). Voice spend belongs to f07.

import { useState } from "react";
import { isUrdu, speak } from "../reader/speech";
import type { VoiceState } from "../reader/useVoice";
import {
  MAX_SESSION_LIMIT,
  MIN_SESSION_LIMIT,
  parseSessionLimit,
  readSessionLimit,
  storeSessionLimit,
} from "../settings/sessionLimit";

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
  const [limitText, setLimitText] = useState(() => String(readSessionLimit()));

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

      <h2>Review</h2>
      <label htmlFor="session-limit">Items per review session</label>
      <input
        id="session-limit"
        type="number"
        inputMode="numeric"
        min={MIN_SESSION_LIMIT}
        max={MAX_SESSION_LIMIT}
        value={limitText}
        onChange={(event) => {
          setLimitText(event.target.value);
          const limit = parseSessionLimit(event.target.value);
          if (String(limit) === event.target.value.trim()) storeSessionLimit(limit);
        }}
        onBlur={() => {
          // Leaving the field settles on what was actually stored.
          setLimitText(String(readSessionLimit()));
        }}
      />
      <p className="hint">
        A whole number from {MIN_SESSION_LIMIT} to {MAX_SESSION_LIMIT}. Due items beyond it wait for
        the next session.
      </p>

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
