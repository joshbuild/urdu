// f04 s04: edit any field of a vault item, mastery included (FR-D2). Sends only changed fields;
// the Worker recomputes next review for a mastery change and records no review event (FR-A8).

import { type FormEvent, useState } from "react";
import type { DuplicateResponse, InvalidRequestResponse, VocabItem } from "../../shared/api";
import { MASTERY_LEVELS, type Mastery } from "../../shared/mastery";
import { VOCAB_KINDS, type VocabKind } from "../../shared/normalize";
import { DraftFields } from "../reader/DraftFields";
import { buildUpdate, draftFromItem } from "./edit";

export function VocabEdit({
  item,
  onCancel,
  onSaved,
  onOpenExisting,
}: {
  item: VocabItem;
  onCancel: () => void;
  onSaved: (item: VocabItem) => void;
  onOpenExisting: (id: string) => void;
}) {
  const [draft, setDraft] = useState(() => draftFromItem(item));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const update = buildUpdate(item, draft);
    if (!update) return onCancel();
    setBusy(true);
    setError("");
    setDuplicateId(null);
    try {
      const response = await fetch(`/api/vocab/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      if (response.ok) return onSaved((await response.json()) as VocabItem);
      if (response.status === 409) {
        setDuplicateId(((await response.json()) as DuplicateResponse).existing_id);
      } else if (response.status === 400) {
        const body = (await response.json()) as InvalidRequestResponse;
        setError(body.field ? `${body.field} ${body.message}` : body.message);
      } else if (response.status === 404) {
        setError("This item is no longer in your vault.");
      } else if (response.status === 401) {
        setError("This device is locked. Unlock it and try again.");
      } else {
        setError("Could not save. Please try again.");
      }
    } catch {
      setError("Could not connect. Check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={save}>
      <p className="eyebrow">EDIT</p>
      <DraftFields idPrefix="edit" draft={draft} onChange={setDraft} />

      <label htmlFor="edit-kind">Kind</label>
      <select
        id="edit-kind"
        value={draft.kind}
        onChange={(event) => setDraft({ ...draft, kind: event.target.value as VocabKind })}
      >
        {VOCAB_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {kind}
          </option>
        ))}
      </select>

      <label htmlFor="edit-mastery">Mastery</label>
      <select
        id="edit-mastery"
        value={draft.mastery}
        onChange={(event) => setDraft({ ...draft, mastery: Number(event.target.value) as Mastery })}
      >
        {MASTERY_LEVELS.map(({ level, name, intervalDays }) => (
          <option key={level} value={level}>
            {level} · {name} ({intervalDays} {intervalDays === 1 ? "day" : "days"})
          </option>
        ))}
      </select>
      <p className="hint">
        Changing mastery is a correction, not a review. Next review moves to match, and no review is
        recorded.
      </p>

      {duplicateId && (
        <div className="duplicate" role="status">
          <p>Another item already has this Urdu.</p>
          <button type="button" className="secondary" onClick={() => onOpenExisting(duplicateId)}>
            Open it
          </button>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="save" disabled={busy || draft.urdu.trim() === ""}>
        {busy ? "Saving…" : "Save"}
      </button>
      <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
        Cancel
      </button>
    </form>
  );
}
