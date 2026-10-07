// The new-vocab round trip's sheets (f06 FR-F4/F6, f14 FR-F10). f17 moved them from the Vocab
// tab into a harvest: a paste lands in that harvest, queued unless Start now is ticked.

import { useState } from "react";
import {
  type HandoffResponse,
  MAX_HANDOFF_PROPOSALS,
  MAX_MATCH_WORDS,
  type MatchResponse,
  type ProposalResult,
} from "../../shared/api";
import { Sheet } from "../reader/Sheet";
import { type Copied, CopiedNote, copy, postJson } from "./clipboard";
import { parsePasted } from "./prompts";
import { chatText, extractWords, tooManyWords } from "./wordList";

export function PasteBox({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  return (
    <>
      <label htmlFor="handoff-paste">ChatGPT's JSON reply</label>
      <textarea
        id="handoff-paste"
        rows={8}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        autoCapitalize="none"
      />
    </>
  );
}

// Where a paste into a harvest goes: queued by default, released at once with Start now.
export function pastePath(harvestId: string, start: boolean): string {
  return `/api/harvests/${encodeURIComponent(harvestId)}/handoffs${start ? "?start=1" : ""}`;
}

// "n queued" or "n started" for the words this paste created.
export function pasteSummary(results: readonly ProposalResult[], started: boolean): string {
  const created = results.filter((r) => r.outcome === "created").length;
  const duplicates = results.filter((r) => r.outcome === "duplicate").length;
  const parts = [`${created} ${started ? "started" : "queued"}`];
  if (duplicates > 0) parts.push(`${duplicates} already in your vault`);
  return parts.join(" · ");
}

// `path` gives where the paste goes for the Start now tick: a harvest's (pastePath), or f18's
// batch route.
export function PasteNewSheet({
  path,
  title = "Paste new vocab",
  onClose,
  onChanged,
  onOpen,
}: {
  path: (start: boolean) => string;
  title?: string;
  onClose: () => void;
  onChanged: () => void;
  onOpen: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [start, setStart] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<HandoffResponse | null>(null);

  async function submit() {
    const pasted = parsePasted(text);
    if (!pasted.ok) return setError(pasted.message);
    setBusy(true);
    setError("");
    const posted = await postJson<HandoffResponse>(path(start), pasted.value);
    setBusy(false);
    if (!posted.ok) return setError(posted.message);
    setResult(posted.body);
    onChanged();
  }

  // A repeat reports the first paste's outcome, which this tick didn't decide.
  const created = result?.repeat ? "Saved earlier" : start ? "Started" : "Queued";

  return (
    <Sheet label={title} onClose={onClose}>
      <p className="eyebrow">{title.toUpperCase()}</p>
      {result ? (
        <>
          {result.repeat ? (
            <p className="hint">This reply was already imported; nothing new was saved.</p>
          ) : (
            <p className="hint">{pasteSummary(result.results, start)}</p>
          )}
          <ul className="handoff-results">
            {result.results.map((r) => (
              <li key={r.index}>
                <span className="urdu-inline" dir="rtl" lang="ur">
                  {r.urdu}
                </span>{" "}
                ·{" "}
                {r.outcome === "created"
                  ? created
                  : r.outcome === "duplicate"
                    ? "Already in your vault"
                    : `Rejected (${r.reason})`}
                {r.outcome === "created" && r.dropped && (
                  <span className="hint"> (left out: {r.dropped.join(", ")})</span>
                )}
                {r.outcome !== "rejected" && (
                  <button
                    type="button"
                    className="link"
                    onClick={() => onOpen(r.outcome === "created" ? r.id : r.existing_id)}
                  >
                    Open
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button type="button" onClick={onClose}>
            Done
          </button>
        </>
      ) : (
        <>
          <PasteBox value={text} onChange={setText} />
          <label className="check">
            <input type="checkbox" checked={start} onChange={() => setStart(!start)} />
            Start now (skip the queue)
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="button" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : start ? "Save and start" : "Queue these words"}
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
        </>
      )}
    </Sheet>
  );
}

type Found = { fresh: string[]; known: { urdu: string; id: string }[]; skipped: number };

export function FindWordsSheet({
  onClose,
  onOpen,
}: {
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [copied, setCopied] = useState<Copied>({ kind: "none" });

  async function find() {
    const list = extractWords(text);
    if (list.words.length === 0) return setError("No Urdu words found in that text.");
    if (tooManyWords(list)) return setError(`Paste at most ${MAX_MATCH_WORDS} words at a time.`);
    setBusy(true);
    setError("");
    const posted = await postJson<MatchResponse>("/api/vocab/match", { words: list.words });
    setBusy(false);
    if (!posted.ok) return setError(posted.message);
    const fresh: string[] = [];
    const known: Found["known"] = [];
    for (const r of posted.body.results) {
      if (r.existing) known.push(r.existing);
      else fresh.push(r.urdu);
    }
    setFound({ fresh, known, skipped: list.skipped });
  }

  if (found) {
    const { fresh, known, skipped } = found;
    const tooMany =
      fresh.length > MAX_HANDOFF_PROPOSALS
        ? ` ChatGPT's reply can hold at most ${MAX_HANDOFF_PROPOSALS} words; split the list if it refuses.`
        : "";
    return (
      <Sheet label="New words" onClose={onClose}>
        <p className="eyebrow">NEW WORDS</p>
        <p className="hint">
          {fresh.length} new · {known.length} already in your vault
          {skipped > 0 && `; ${skipped} ${skipped === 1 ? "line" : "lines"} with no Urdu skipped`}
        </p>
        {fresh.length === 0 ? (
          <p className="hint">Every word is already in your vault.</p>
        ) : (
          <>
            <ul className="handoff-results">
              {fresh.map((urdu) => (
                <li key={urdu}>
                  <span className="urdu-inline" dir="rtl" lang="ur">
                    {urdu}
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={async () =>
                setCopied(
                  await copy(
                    chatText(fresh),
                    `Copied. Paste it into the ChatGPT chat, then paste its reply into Paste new vocab.${tooMany}`,
                  ),
                )
              }
            >
              Copy new words for ChatGPT
            </button>
            <CopiedNote copied={copied} label="New words for ChatGPT" />
          </>
        )}
        {known.length > 0 && (
          <>
            <p className="eyebrow find-known">ALREADY IN YOUR VAULT</p>
            <ul className="handoff-results">
              {known.map((k) => (
                <li key={k.id}>
                  <span className="urdu-inline" dir="rtl" lang="ur">
                    {k.urdu}
                  </span>{" "}
                  <button type="button" className="link" onClick={() => onOpen(k.id)}>
                    Open
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        <button type="button" className="secondary" onClick={onClose}>
          Done
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet label="Find new words" onClose={onClose}>
      <p className="eyebrow">FIND NEW WORDS</p>
      <label htmlFor="find-words">Word list from ChatGPT</label>
      <textarea
        id="find-words"
        rows={8}
        value={text}
        onChange={(event) => setText(event.target.value)}
        spellCheck={false}
        autoCapitalize="none"
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="button" onClick={find} disabled={busy}>
        {busy ? "Checking\u{2026}" : "Find"}
      </button>
      <button type="button" className="secondary" onClick={onClose}>
        Cancel
      </button>
    </Sheet>
  );
}
