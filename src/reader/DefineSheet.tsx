// f03 s07: Define (FR-C7). Vault first, by exact `urdu_key`; when the term is not there, the
// external dictionary links, each opening in a new tab. No LLM call.

import { useEffect, useState } from "react";
import type { VocabItem, VocabListResponse } from "../../shared/api";
import { MasteryPill } from "../vocab/MasteryPill";
import { dictionaryLinks, exactMatch } from "./define";
import { Sheet } from "./Sheet";

type Lookup =
  | { kind: "loading" }
  | { kind: "found"; item: VocabItem }
  | { kind: "missing" }
  | { kind: "error"; message: string };

export function DefineSheet({
  term,
  onAdd,
  onClose,
}: {
  term: string;
  onAdd: () => void;
  onClose: () => void;
}) {
  const [lookup, setLookup] = useState<Lookup>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    // The list search matches substrings of urdu_key; 50 hits is ample to contain the exact one.
    fetch(`/api/vocab?limit=50&q=${encodeURIComponent(term)}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          setLookup({ kind: "error", message: "This device is locked. Unlock it and try again." });
          return;
        }
        if (!response.ok) throw new Error(String(response.status));
        const { items } = (await response.json()) as VocabListResponse;
        const item = exactMatch(items, term);
        setLookup(item ? { kind: "found", item } : { kind: "missing" });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        // The links need no vault, so a failed lookup still offers them.
        console.warn("define lookup failed", err);
        setLookup({ kind: "error", message: "Could not check your vault." });
      });
    return () => controller.abort();
  }, [term]);

  return (
    <Sheet label="Define" onClose={onClose}>
      <p className="eyebrow">DEFINE</p>
      <p className="urdu-inline" dir="rtl" lang="ur">
        {term}
      </p>

      {lookup.kind === "loading" && <p className="hint">Checking your vault…</p>}

      {lookup.kind === "found" && (
        <dl className="entry">
          {lookup.item.roman && (
            <>
              <dt>Roman</dt>
              <dd>{lookup.item.roman}</dd>
            </>
          )}
          {lookup.item.english && (
            <>
              <dt>English</dt>
              <dd>{lookup.item.english}</dd>
            </>
          )}
          {lookup.item.notes && (
            <>
              <dt>Notes</dt>
              <dd>{lookup.item.notes}</dd>
            </>
          )}
          {lookup.item.example_urdu && (
            <>
              <dt>Example</dt>
              <dd className="urdu-inline" dir="rtl" lang="ur">
                {lookup.item.example_urdu}
              </dd>
              {lookup.item.example_english && <dd>{lookup.item.example_english}</dd>}
            </>
          )}
          <dt>Mastery</dt>
          <dd>
            <MasteryPill item={lookup.item} />
          </dd>
        </dl>
      )}

      {lookup.kind !== "loading" && lookup.kind !== "found" && (
        <>
          <p className={lookup.kind === "error" ? "error" : "hint"}>
            {lookup.kind === "error" ? lookup.message : "Not in your vault yet."}
          </p>
          <ul className="links">
            {dictionaryLinks(term).map((link) => (
              <li key={link.label}>
                <a href={link.href} target="_blank" rel="noopener noreferrer">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <button type="button" onClick={onAdd}>
            Add to vocab
          </button>
        </>
      )}

      <button type="button" className="secondary" onClick={onClose}>
        Close
      </button>
    </Sheet>
  );
}
