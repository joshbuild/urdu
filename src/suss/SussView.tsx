// mp07: every suss card, oldest flag first, with its comment. Copy suss prompt issues a check batch
// of them (the Worker records it, as for any check), and the reply pastes into the check preview;
// applying it clears the flags, so the cards leave this list.

import { useCallback, useEffect, useState } from "react";
import type { CheckBatchResponse, VocabItem, VocabListResponse } from "../../shared/api";
import { MAX_CHECK_BATCH } from "../../shared/api";
import { type Copied, CopiedNote, copy, postJson } from "../handoff/clipboard";
import { PasteCheckSheet } from "../handoff/HandoffPanel";
import { sussPrompt } from "../handoff/prompts";
import { SussSheet } from "./SussSheet";

export function SussView({
  onBack,
  onOpen,
  onChanged,
}: {
  onBack: () => void;
  onOpen: (id: string) => void;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<VocabItem[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<VocabItem | null>(null);
  const [pasting, setPasting] = useState(false);
  const [copied, setCopied] = useState<Copied>({ kind: "none" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/vocab?suss=true&limit=200`, { cache: "no-store" });
      if (!response.ok) throw new Error("list failed");
      setItems(((await response.json()) as VocabListResponse).items);
    } catch {
      setError("Could not load the suss cards. Check your connection and try again.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function copySuss() {
    setBusy(true);
    const posted = await postJson<CheckBatchResponse>("/api/handoffs/check-batch", {
      suss: true,
      count: MAX_CHECK_BATCH,
    });
    setBusy(false);
    if (!posted.ok) return setCopied({ kind: "copied", note: posted.message });
    const { handoff_id, items: batch, candidates } = posted.body;
    if (handoff_id === null) return setCopied({ kind: "copied", note: "No suss cards to send." });
    const of = candidates > batch.length ? ` (the oldest ${batch.length} of ${candidates})` : "";
    setCopied(
      await copy(
        sussPrompt(batch, handoff_id),
        `Suss prompt copied${of}. Paste it into ChatGPT, then tap Paste suss reply with its JSON.`,
      ),
    );
  }

  const changed = () => {
    onChanged();
    void load();
  };

  return (
    <>
      <button type="button" className="back" onClick={onBack}>
        Back
      </button>
      <h2>Suss cards</h2>
      <p className="hint">
        Cards you flagged as questionable. Send them to ChatGPT with your comments, then paste its
        reply to review the fixes. Applying the reply clears the flags.
      </p>
      <div className="handoff-buttons">
        <button
          type="button"
          className="secondary"
          onClick={() => void copySuss()}
          disabled={busy || !items?.length}
        >
          {busy ? "Copying…" : "Copy suss prompt"}
        </button>
        <button type="button" className="secondary" onClick={() => setPasting(true)}>
          Paste suss reply
        </button>
      </div>
      <CopiedNote copied={copied} />

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {items === null && !error && <p className="hint">Loading…</p>}
      {items?.length === 0 && (
        <p className="hint">No suss cards. Tap Suss on a review card to flag one.</p>
      )}

      <ul className="vocab-list">
        {items?.map((item) => (
          <li key={item.id} className="suss-row">
            <button type="button" className="vocab-row" onClick={() => onOpen(item.id)}>
              <span className="vocab-row-head">
                <span className="vocab-row-roman">{item.roman}</span>
                <span className="urdu-inline" dir="rtl" lang="ur">
                  {item.urdu}
                </span>
              </span>
              <span className="vocab-row-gloss">{item.english || "—"}</span>
              <span className="suss-note">{item.suss_note ?? "No comment"}</span>
            </button>
            <button type="button" className="link" onClick={() => setEditing(item)}>
              Comment or clear
            </button>
          </li>
        ))}
      </ul>

      {editing && <SussSheet item={editing} onSaved={changed} onClose={() => setEditing(null)} />}
      {pasting && (
        <PasteCheckSheet
          suss
          onClose={() => setPasting(false)}
          onChanged={changed}
          onOpen={(id) => {
            setPasting(false);
            onOpen(id);
          }}
        />
      )}
    </>
  );
}
