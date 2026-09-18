// f04 s03: one vault item (FR-D2) — every field, its place on the ladder, speak, delete.
// Viewing and speaking never change mastery (FR-A8); only the edit form does, as a correction.

import { useEffect, useState } from "react";
import type { VocabItem } from "../../shared/api";
import { masteryName } from "../../shared/mastery";
import { speak } from "../reader/speech";
import { reviewLabel } from "./list";

type Load =
  | { kind: "loading" }
  | { kind: "ready"; item: VocabItem }
  | { kind: "missing" }
  | { kind: "error" };

const TEXT_FIELDS: { name: keyof VocabItem; label: string; urdu?: boolean }[] = [
  { name: "roman", label: "Roman Urdu" },
  { name: "english", label: "English" },
  { name: "notes", label: "Notes" },
  { name: "example_urdu", label: "Example (Urdu)", urdu: true },
  { name: "example_english", label: "Example (English)" },
];

export function VocabDetail({
  id,
  today,
  voice,
  onBack,
  onEdit,
  onDeleted,
}: {
  id: string;
  today: string;
  voice: SpeechSynthesisVoice | null;
  onBack: () => void;
  onEdit: (item: VocabItem) => void;
  onDeleted: () => void;
}) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ kind: "loading" });
    fetch(`/api/vocab/${encodeURIComponent(id)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) return setLoad({ kind: "missing" });
        if (!response.ok) throw new Error("load failed");
        setLoad({ kind: "ready", item: (await response.json()) as VocabItem });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ kind: "error" });
      });
    return () => controller.abort();
  }, [id]);

  async function remove() {
    setBusy(true);
    setError("");
    try {
      // The CSRF guard wants JSON on every write, bodyless DELETE included (415 otherwise).
      const response = await fetch(`/api/vocab/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      // Already gone is the outcome the sponsor asked for.
      if (!response.ok && response.status !== 404) throw new Error("delete failed");
      onDeleted();
    } catch {
      setError("Could not delete. Check your connection and try again.");
      setBusy(false);
    }
  }

  const back = (
    <button type="button" className="back" onClick={onBack}>
      ‹ All vocabulary
    </button>
  );

  if (load.kind !== "ready") {
    return (
      <>
        {back}
        <p role={load.kind === "loading" ? "status" : "alert"} className="hint">
          {load.kind === "loading"
            ? "Loading…"
            : load.kind === "missing"
              ? "This item is no longer in your vault."
              : "Could not load this item. Check your connection and try again."}
        </p>
      </>
    );
  }

  const { item } = load;
  return (
    <>
      {back}
      <p className="eyebrow">{item.kind.toUpperCase()}</p>
      <p className="urdu-inline vocab-headword" dir="rtl" lang="ur">
        {item.urdu}
      </p>
      <button type="button" className="secondary" onClick={() => speak(item.urdu, voice)}>
        Speak
      </button>

      <dl className="entry">
        <dt>Mastery</dt>
        <dd>
          {item.mastery} · {masteryName(item.mastery)}
        </dd>
        <dt>Review</dt>
        <dd>
          {reviewLabel(item, today)}
          {item.last_reviewed_on ? ` · last ${item.last_reviewed_on}` : " · never reviewed"}
        </dd>
        {TEXT_FIELDS.map(({ name, label, urdu }) =>
          item[name] ? (
            <div key={name}>
              <dt>{label}</dt>
              <dd
                className={urdu ? "urdu-inline" : undefined}
                dir={urdu ? "rtl" : undefined}
                lang={urdu ? "ur" : undefined}
              >
                {String(item[name])}
              </dd>
            </div>
          ) : null,
        )}
        {item.tags.length > 0 && (
          <>
            <dt>Tags</dt>
            <dd>{item.tags.join(", ")}</dd>
          </>
        )}
        <dt>Added</dt>
        <dd>
          {item.added_at.slice(0, 10)} · {item.source}
        </dd>
      </dl>

      <button type="button" className="edit" onClick={() => onEdit(item)}>
        Edit
      </button>

      {confirming ? (
        <div className="duplicate" role="alert">
          <p>Delete this item and its review history? This cannot be undone.</p>
          <button type="button" className="danger" onClick={remove} disabled={busy}>
            {busy ? "Deleting…" : "Delete"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => setConfirming(false)}
            disabled={busy}
          >
            Keep it
          </button>
        </div>
      ) : (
        <button type="button" className="secondary" onClick={() => setConfirming(true)}>
          Delete…
        </button>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
