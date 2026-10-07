// f18 (FR-L): paste a classify reply, preview it row by row, untick any you disagree with, apply.
// Nothing is written until Apply; an item edited since the prompt was copied is left alone.

import { useState } from "react";
import type { ClassifyResponse } from "../../shared/api";
import { topicBySlug } from "../../shared/topics";
import { postJson } from "../handoff/clipboard";
import { PasteBox } from "../handoff/NewVocabSheets";
import { parsePasted } from "../handoff/prompts";
import { Sheet } from "../reader/Sheet";
import { classifySummary, initiallyTicked } from "./classify";

type Row = ClassifyResponse["results"][number];

function Label({ row }: { row: Row }) {
  const urdu = (
    <span className="urdu-inline" dir="rtl" lang="ur">
      {row.urdu}
    </span>
  );
  if (row.outcome === "rejected") {
    return (
      <>
        {row.n !== null && `${row.n}. `}
        {urdu} · Rejected ({row.reason})
      </>
    );
  }
  if (row.outcome === "missing") {
    return (
      <>
        {row.n}. {urdu} · Left out by the reply; stays unclassified
      </>
    );
  }
  const tags = row.tags.map((t) => topicBySlug(t)?.label ?? t);
  return (
    <>
      {row.n}. {urdu} · {topicBySlug(row.topic)?.label ?? row.topic} · {row.cefr}
      {tags.length > 0 && ` · also ${tags.join(", ")}`}
      {row.dropped && <span className="hint"> (left out: {row.dropped.join(", ")})</span>}
    </>
  );
}

export function ClassifySheet({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [body, setBody] = useState<unknown>(null);
  const [preview, setPreview] = useState<ClassifyResponse | null>(null);
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [applied, setApplied] = useState<ClassifyResponse | null>(null);

  async function check() {
    const pasted = parsePasted(text);
    if (!pasted.ok) return setError(pasted.message);
    setBusy(true);
    setError("");
    const posted = await postJson<ClassifyResponse>(
      "/api/handoffs/classify?preview=1",
      pasted.value,
    );
    setBusy(false);
    if (!posted.ok) return setError(posted.message);
    setBody(pasted.value);
    if (posted.body.repeat) return setApplied(posted.body);
    setPreview(posted.body);
    setTicked(initiallyTicked(posted.body.results));
  }

  async function apply() {
    setBusy(true);
    setError("");
    const posted = await postJson<ClassifyResponse>("/api/handoffs/classify", {
      ...(body as object),
      accept: [...ticked],
    });
    setBusy(false);
    if (!posted.ok) return setError(posted.message);
    setApplied(posted.body);
    onChanged();
  }

  const toggle = (n: number) => {
    const next = new Set(ticked);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    setTicked(next);
  };

  const errorLine = error && (
    <p className="error" role="alert">
      {error}
    </p>
  );

  return (
    <Sheet label="Paste classify reply" onClose={onClose}>
      <p className="eyebrow">PASTE CLASSIFY REPLY</p>
      {applied ? (
        <>
          <p className="hint">
            {applied.repeat ? "This reply was already applied; nothing new was saved. " : ""}
            {classifySummary(applied.results)}
          </p>
          <button type="button" onClick={onClose}>
            Done
          </button>
        </>
      ) : preview ? (
        <>
          <p className="hint">{classifySummary(preview.results)}. Untick any you disagree with.</p>
          <ul className="handoff-results">
            {preview.results.map((row, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list; malformed rows share n null
              <li key={`${row.n}-${i}`}>
                {row.outcome === "classify" ? (
                  <label className="check change">
                    <input
                      type="checkbox"
                      checked={ticked.has(row.n)}
                      onChange={() => toggle(row.n)}
                    />
                    <span>
                      <Label row={row} />
                    </span>
                  </label>
                ) : (
                  <Label row={row} />
                )}
              </li>
            ))}
          </ul>
          {errorLine}
          <button type="button" onClick={apply} disabled={busy || ticked.size === 0}>
            {busy ? "Saving…" : ticked.size === 0 ? "Nothing ticked" : `Apply ${ticked.size}`}
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <PasteBox value={text} onChange={setText} />
          {errorLine}
          <button type="button" onClick={check} disabled={busy}>
            {busy ? "Checking…" : "Preview"}
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
        </>
      )}
    </Sheet>
  );
}
