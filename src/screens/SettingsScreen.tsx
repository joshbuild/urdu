// f03 s01/s04, f04 s06, f09, f07 s04, f18. Lock this device (from the f01 shell), the voice picker,
// the review session limit (FR-I1), review spacing (the active ladder), the Next batch size and the
// voice Coach's spend (today's total and the two daily caps, FR-G / FR-I1). About shows the commit this build came
// from, to match the deployed app against the repo.

import { useEffect, useState } from "react";
import type { SettingsResponse, VoiceSpendResponse } from "../../shared/api";
import { MAX_NEXT_BATCH_SIZE, MIN_NEXT_BATCH_SIZE } from "../../shared/coverage";
import { LADDERS } from "../../shared/ladders";
import { formatUsd, isCapUsd, MAX_CAP_USD } from "../../shared/voice-cost";
import { isUrdu, speak } from "../reader/speech";
import type { VoiceState } from "../reader/useVoice";
import { MAX_BATCH, MIN_BATCH, parseBatchSize } from "../settings/batchSize";
import {
  MAX_SESSION_LIMIT,
  MIN_SESSION_LIMIT,
  parseSessionLimit,
  readSessionLimit,
  storeSessionLimit,
} from "../settings/sessionLimit";
import { spacingRows } from "../settings/spacing";

const SAMPLE = "السلام علیکم، آپ کیسے ہیں؟";

export function SettingsScreen({
  onLock,
  busy,
  voiceState,
  activeLadderId,
  batchSize,
  onChanged,
}: {
  onLock: () => void;
  busy: boolean;
  voiceState: VoiceState;
  activeLadderId: number;
  // f17: new words per day, from status.
  batchSize: number;
  // Settings on the server changed; App refreshes status, which carries the active ladder.
  onChanged: () => void;
}) {
  const { voices, voice, select, supported } = voiceState;
  const [limitText, setLimitText] = useState(() => String(readSessionLimit()));
  const [spacingBusy, setSpacingBusy] = useState(false);
  const [spacingError, setSpacingError] = useState("");
  const [spend, setSpend] = useState<VoiceSpendResponse | null>(null);
  const [capError, setCapError] = useState("");
  const [batchText, setBatchText] = useState(() => String(batchSize));
  const [batchError, setBatchError] = useState("");

  // Today's voice spend, read once when Settings opens.
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const response = await fetch("/api/voice/spend");
        if (response.ok && live) setSpend((await response.json()) as VoiceSpendResponse);
      } catch {}
    })();
    return () => {
      live = false;
    };
  }, []);

  async function saveCap(which: "soft" | "hard", usd: number) {
    if (!spend) return;
    setCapError("");
    const field = which === "soft" ? "voice_soft_cap_usd" : "voice_hard_cap_usd";
    // Shown at once; the server's answer is authoritative and replaces it below.
    setSpend({ ...spend, [field]: usd });
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: usd }),
      });
      const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (response.ok && data) {
        setSpend((current) =>
          current === null
            ? current
            : {
                ...current,
                soft_cap_usd: data.voice_soft_cap_usd as number,
                hard_cap_usd: data.voice_hard_cap_usd as number,
              },
        );
        return;
      }
      const message = typeof data?.message === "string" ? data.message : "Could not save.";
      setCapError(which === "soft" ? `Soft cap ${message}` : `Hard cap ${message}`);
      const fresh = await fetch("/api/voice/spend");
      if (fresh.ok) setSpend((await fresh.json()) as VoiceSpendResponse);
    } catch {
      setCapError("Could not connect. Check your connection and try again.");
    }
  }

  // f17: saved when the field is left; the Worker validates 1–50.
  async function saveBatch() {
    const n = parseBatchSize(batchText);
    if (n === null) {
      setBatchError(`A whole number from ${MIN_BATCH} to ${MAX_BATCH}.`);
      return;
    }
    setBatchError("");
    setBatchText(String(n));
    if (n === batchSize) return;
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intake_batch_size: n }),
      });
      if (response.ok) onChanged();
      else if (response.status === 401)
        setBatchError("This device is locked. Unlock it and try again.");
      else setBatchError("Could not save. Please try again.");
    } catch {
      setBatchError("Could not connect. Check your connection and try again.");
    }
  }

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

      <label htmlFor="batch-size">New words per day</label>
      <input
        id="batch-size"
        type="number"
        inputMode="numeric"
        min={MIN_BATCH}
        max={MAX_BATCH}
        value={batchText}
        onChange={(event) => setBatchText(event.target.value)}
        onBlur={() => void saveBatch()}
        aria-describedby="batch-size-hint"
      />
      <p id="batch-size-hint" className="hint">
        Released each day when the new pile is below it; also the size of Intake.
      </p>
      {batchError && (
        <p className="error" role="alert">
          {batchError}
        </p>
      )}

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
              <strong>{l.name}</strong>
              <span className="spacing-rows">
                {spacingRows(l).map((row) => (
                  <span key={row.unit} className="spacing-row">
                    <span>{row.values.join(" → ")}</span>
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

      <h2>Harvest</h2>
      <NextBatchField />

      <h2>Voice Coach</h2>
      {spend === null ? (
        <p className="hint">Reading today's spend…</p>
      ) : (
        <>
          <p className="hint">
            Spent today ({spend.day}): <strong>{formatUsd(spend.today_usd)}</strong> of{" "}
            {formatUsd(spend.hard_cap_usd)}. An estimate from billed seconds and backend tokens.
          </p>
          <CapField
            id="soft-cap"
            label="Warn at (per day)"
            value={spend.soft_cap_usd}
            onSave={(usd) => void saveCap("soft", usd)}
          />
          <CapField
            id="hard-cap"
            label="Stop at (per day)"
            value={spend.hard_cap_usd}
            onSave={(usd) => void saveCap("hard", usd)}
          />
          <p className="hint">
            A live session ends at the stop amount, and no new session starts until tomorrow. Voice
            costs about $0.05 a minute.
          </p>
          {capError && (
            <p className="error" role="alert">
              {capError}
            </p>
          )}
        </>
      )}

      <h2>This device</h2>
      <p className="hint">
        Locking deletes this device's session. You will need your personal secret to unlock again.
      </p>
      <button type="button" className="secondary" onClick={onLock} disabled={busy}>
        {busy ? "Locking…" : "Lock this device"}
      </button>

      <h2>About</h2>
      <p className="hint">
        Version <strong>{__BUILD__.commit}</strong>
        {__BUILD__.dirty && " + local changes"}
        {__BUILD__.committedAt && <>, committed {when(__BUILD__.committedAt)}</>}. Built{" "}
        {when(__BUILD__.builtAt)}.
      </p>
    </section>
  );
}

// f18: how many words one Next batch asks ChatGPT for. Read when Settings opens; saved when the
// field is left, and the Worker validates 1–50. Only the Harvest tab uses it, so no status refresh.
function NextBatchField() {
  const [saved, setSaved] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const response = await fetch("/api/settings");
        if (!response.ok || !live) return;
        const { next_batch_size } = (await response.json()) as SettingsResponse;
        setSaved(next_batch_size);
        setText(String(next_batch_size));
      } catch {}
    })();
    return () => {
      live = false;
    };
  }, []);

  async function save() {
    const n = parseBatchSize(text);
    if (n === null) {
      setError(`A whole number from ${MIN_NEXT_BATCH_SIZE} to ${MAX_NEXT_BATCH_SIZE}.`);
      return;
    }
    setError("");
    setText(String(n));
    if (n === saved) return;
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next_batch_size: n }),
      });
      if (response.ok) setSaved(((await response.json()) as SettingsResponse).next_batch_size);
      else if (response.status === 401) setError("This device is locked. Unlock it and try again.");
      else setError("Could not save. Please try again.");
    } catch {
      setError("Could not connect. Check your connection and try again.");
    }
  }

  if (saved === null) return <p className="hint">Reading the Next batch size…</p>;
  return (
    <>
      <label htmlFor="next-batch-size">Words per Next batch</label>
      <input
        id="next-batch-size"
        type="number"
        inputMode="numeric"
        min={MIN_NEXT_BATCH_SIZE}
        max={MAX_NEXT_BATCH_SIZE}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => void save()}
        aria-describedby="next-batch-size-hint"
      />
      <p id="next-batch-size-hint" className="hint">
        How many words one Next batch asks ChatGPT for, across as many topics as it takes. Larger
        batches take ChatGPT longer and are harder for it to get right.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// A dollar cap. Edits stay local while typing; a valid amount saves when the field is left, and
// an invalid one snaps back to what the server holds.
function CapField({
  id,
  label,
  value,
  onSave,
}: {
  id: string;
  label: string;
  value: number;
  onSave: (usd: number) => void;
}) {
  const [text, setText] = useState(() => value.toFixed(2));
  // Follow the server's value once it comes back or changes.
  useEffect(() => setText(value.toFixed(2)), [value]);

  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        max={MAX_CAP_USD}
        step="0.05"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          const usd = Math.round(Number(text) * 100) / 100;
          if (text.trim() !== "" && isCapUsd(usd) && usd !== value) onSave(usd);
          else setText(value.toFixed(2));
        }}
      />
    </>
  );
}
