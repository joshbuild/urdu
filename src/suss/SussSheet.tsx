// mp07: flag an item as suss with a comment, change the comment, or clear the flag. Opened from
// the review card's Suss button and from each row of the Suss view.

import { useState } from "react";
import type { VocabItem } from "../../shared/api";
import { Sheet } from "../reader/Sheet";
import { clearSuss, isSuss, markSuss, noteProblem } from "./suss";

export function SussSheet({
  item,
  onSaved,
  onClose,
}: {
  item: VocabItem;
  // The item as the Worker now holds it.
  onSaved: (item: VocabItem) => void;
  onClose: () => void;
}) {
  const flagged = isSuss(item);
  const [note, setNote] = useState(item.suss_note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const problem = noteProblem(note);

  async function run(action: () => ReturnType<typeof markSuss>) {
    setBusy(true);
    setError("");
    const sent = await action();
    setBusy(false);
    if (!sent.ok) return setError(sent.message);
    onSaved(sent.item);
    onClose();
  }

  return (
    <Sheet label="Suss" onClose={onClose}>
      <p className="eyebrow">SUSS</p>
      <p>
        <span className="urdu-inline" dir="rtl" lang="ur">
          {item.urdu}
        </span>{" "}
        {item.roman && <span className="hint">{item.roman}</span>}
      </p>
      <label htmlFor="suss-note">What looks wrong? (optional)</label>
      <textarea
        id="suss-note"
        rows={3}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="e.g. meaning seems off, example sounds formal"
      />
      {problem && <p className="hint">{problem}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={busy || problem !== null}
        onClick={() => void run(() => markSuss(item.id, note))}
      >
        {busy ? "Saving…" : flagged ? "Save comment" : "Mark suss"}
      </button>
      {flagged && (
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => void run(() => clearSuss(item.id))}
        >
          Clear suss
        </button>
      )}
      <button type="button" className="secondary" onClick={onClose}>
        Cancel
      </button>
    </Sheet>
  );
}
