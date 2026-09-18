// f03 s01/s04, f04 s06, f09. Lock this device (from the f01 shell), the voice picker, the review
// session limit (FR-I1) and review spacing (the active ladder). Voice spend belongs to f07.

import { useState } from "react";
import { LADDERS } from "../../shared/ladders";
import { isUrdu, speak } from "../reader/speech";
import type { VoiceState } from "../reader/useVoice";
import {
  MAX_SESSION_LIMIT,
  MIN_SESSION_LIMIT,
  parseSessionLimit,
  readSessionLimit,
  storeSessionLimit,
} from "../settings/sessionLimit";
import { spacingMultiplier, spacingRows } from "../settings/spacing";

const SAMPLE = "السلام علیکم، آپ کیسے ہیں؟";

export function SettingsScreen({
  onLock,
  busy,
  voiceState,
  activeLadderId,
  onChanged,
}: {
  onLock: () => void;
  busy: boolean;
  voiceState: VoiceState;
  activeLadderId: number;
  // Settings on the server changed; App refreshes status, which carries the active ladder.
  onChanged: () => void;
}) {
  const { voices, voice, select, supported } = voiceState;
  const [limitText, setLimitText] = useState(() => String(readSessionLimit()));
  const [spacingBusy, setSpacingBusy] = useState(false);
  const [spacingError, setSpacingError] = useState("");

  async function chooseLadder(id: number) {
    if (spacingBusy || id === activeLadderId) return;
    setSpacingBusy(true);
    setSpacingError("");
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active_ladder_id: id }),
      });
      if (response.ok) onChanged();
      else if (response.status === 401)
        setSpacingError("This device is locked. Unlock it and try again.");
      else setSpacingError("Could not save. Please try again.");
    } catch {
      setSpacingError("Could not connect. Check your connection and try again.");
    }
    setSpacingBusy(false);
  }

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

      <fieldset className="direction" disabled={spacingBusy}>
        <legend>Review spacing</legend>
        {LADDERS.filter((l) => l.selectable).map((l) => (
          <label key={l.id}>
            <input
              type="radio"
              name="spacing"
              value={l.id}
              checked={l.id === activeLadderId}
              onChange={() => void chooseLadder(l.id)}
            />
            <span className="spacing">
              <span>
                <strong>{l.name}</strong> {spacingMultiplier(l)}
              </span>
              <span className="spacing-rows">
                {spacingRows(l).map((row) => (
                  <span key={row.unit} className="spacing-row">
                    <span>{row.values.join(" > ")}</span>
                    <span>{row.unit}</span>
                  </span>
                ))}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="hint">
        How far apart reviews are. Wider spacing means fewer reviews and more forgetting. Changing
        it moves no due dates: each item switches at its next review.
      </p>
      {spacingError && (
        <p className="error" role="alert">
          {spacingError}
        </p>
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
