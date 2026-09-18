// f03 s01. Carries "lock this device" forward from the f01 shell; the voice picker lands in s04.
// The rest of FR-I1 (review session limit, voice spend) belongs to f04 and f07.

export function SettingsScreen({ onLock, busy }: { onLock: () => void; busy: boolean }) {
  return (
    <section className="panel">
      <p className="eyebrow">SETTINGS</p>
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
