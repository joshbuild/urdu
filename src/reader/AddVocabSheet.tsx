// f03 s06: Add to vocab (FR-C6). A bottom sheet over the reader, so the passage and scroll
// position are still there when it closes. Saves through POST /api/vocab (FR-A6).

import { type FormEvent, useState } from "react";
import type { DuplicateResponse, InvalidRequestResponse, VocabItem } from "../../shared/api";
import { inferKind } from "../../shared/normalize";
import { type AddDraft, buildCreateRequest, initialDraft } from "./addVocab";
import { Sheet } from "./Sheet";

type Outcome =
  | { kind: "idle" }
  | { kind: "saved"; item: VocabItem }
  | { kind: "duplicate"; existing: VocabItem | null }
  | { kind: "error"; message: string };

const FIELDS: { name: keyof AddDraft; label: string; urdu?: boolean; multiline?: boolean }[] = [
  { name: "urdu", label: "Urdu", urdu: true },
  { name: "roman", label: "Roman Urdu" },
  { name: "english", label: "English" },
  { name: "notes", label: "Notes", multiline: true },
  { name: "example_urdu", label: "Example (Urdu)", urdu: true, multiline: true },
  { name: "example_english", label: "Example (English)", multiline: true },
  { name: "tags", label: "Tags (comma-separated)" },
];

export function AddVocabSheet({
  term,
  sentence,
  onClose,
}: {
  term: string;
  sentence: string;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => initialDraft(term, sentence));
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setOutcome({ kind: "idle" });
    try {
      const response = await fetch("/api/vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCreateRequest(draft)),
      });
      if (response.status === 201) {
        setOutcome({ kind: "saved", item: (await response.json()) as VocabItem });
      } else if (response.status === 409) {
        // FR-C6: a duplicate is an answer, not a failure — show what is already in the vault.
        // The vocab detail screen is f04; until then the existing entry is shown right here.
        const { existing_id } = (await response.json()) as DuplicateResponse;
        const existing = await fetch(`/api/vocab/${encodeURIComponent(existing_id)}`)
          .then((r) => (r.ok ? (r.json() as Promise<VocabItem>) : null))
          .catch(() => null);
        setOutcome({ kind: "duplicate", existing });
      } else if (response.status === 400) {
        const body = (await response.json()) as InvalidRequestResponse;
        setOutcome({
          kind: "error",
          message: body.field ? `${body.field} ${body.message}` : body.message,
        });
      } else if (response.status === 401) {
        setOutcome({ kind: "error", message: "This device is locked. Unlock it and try again." });
      } else {
        setOutcome({ kind: "error", message: "Could not save. Please try again." });
      }
    } catch {
      setOutcome({
        kind: "error",
        message: "Could not connect. Check your connection and try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (outcome.kind === "saved") {
    return (
      <Sheet label="Add to vocab" onClose={onClose}>
        <p className="eyebrow">ADDED</p>
        <p className="urdu-inline" dir="rtl" lang="ur">
          {outcome.item.urdu}
        </p>
        <p className="hint">Saved as a {outcome.item.kind}. It is due for review now.</p>
        <button type="button" onClick={onClose}>
          Back to reading
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet label="Add to vocab" onClose={onClose}>
      <p className="eyebrow">ADD TO VOCAB · {inferKind(draft.urdu.trim() || term).toUpperCase()}</p>
      <form onSubmit={save}>
        {FIELDS.map(({ name, label, urdu, multiline }) => {
          const props = {
            id: `add-${name}`,
            value: draft[name],
            dir: urdu ? "rtl" : undefined,
            lang: urdu ? "ur" : undefined,
            className: urdu ? "urdu-field" : undefined,
            required: name === "urdu",
            onChange: (event: { target: { value: string } }) =>
              setDraft((current) => ({ ...current, [name]: event.target.value })),
          };
          return (
            <div key={name}>
              <label htmlFor={props.id}>{label}</label>
              {multiline ? <textarea rows={2} {...props} /> : <input {...props} />}
            </div>
          );
        })}

        {outcome.kind === "duplicate" && (
          <div className="duplicate" role="status">
            <p>Already in your vault:</p>
            {outcome.existing ? (
              <p>
                <span className="urdu-inline" dir="rtl" lang="ur">
                  {outcome.existing.urdu}
                </span>
                {outcome.existing.roman && <> · {outcome.existing.roman}</>}
                {outcome.existing.english && <> · {outcome.existing.english}</>}
              </p>
            ) : (
              <p className="hint">The existing entry could not be loaded.</p>
            )}
          </div>
        )}
        {outcome.kind === "error" && (
          <p className="error" role="alert">
            {outcome.message}
          </p>
        )}

        <button type="submit" disabled={busy || draft.urdu.trim() === ""}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          Cancel
        </button>
      </form>
    </Sheet>
  );
}
