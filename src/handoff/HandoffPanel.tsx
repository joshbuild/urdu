// f06 Stages 1-2: the ChatGPT round trip at the bottom of the Vocab list. Copy a prompt, run it
// in any ChatGPT chat, paste the JSON reply back. New vocab (FR-F4/F6) saves on paste; fill-ins
// (FR-F7) are previewed and saved only on confirmation.

import { useState } from "react";
import type {
  ConflictResponse,
  HandoffResponse,
  IncompleteResponse,
  InvalidRequestResponse,
  ProposalResult,
  RevisionResult,
  RevisionsResponse,
} from "../../shared/api";
import { Sheet } from "../reader/Sheet";
import {
  describeInvalid,
  FIELD_LABELS,
  fillInPrompt,
  newVocabPrompt,
  parsePasted,
} from "./prompts";

type Posted<T> = { ok: true; body: T } | { ok: false; message: string };

async function postJson<T>(path: string, value: unknown): Promise<Posted<T>> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    if (response.ok) return { ok: true, body: (await response.json()) as T };
    if (response.status === 400) {
      const body = (await response.json()) as InvalidRequestResponse;
      return { ok: false, message: `Rejected: ${describeInvalid(body)}. Nothing was saved.` };
    }
    if (response.status === 409) {
      return { ok: false, message: ((await response.json()) as ConflictResponse).message };
    }
    if (response.status === 401) {
      return { ok: false, message: "This device is locked. Unlock it and try again." };
    }
    return { ok: false, message: "Could not save. Please try again." };
  } catch {
    return { ok: false, message: "Could not connect. Check your connection and try again." };
  }
}

// When the clipboard is refused, the prompt is shown for a manual copy instead.
type Copied =
  | { kind: "none" }
  | { kind: "copied"; note: string }
  | { kind: "manual"; text: string };

async function copy(text: string, note: string): Promise<Copied> {
  try {
    await navigator.clipboard.writeText(text);
    return { kind: "copied", note };
  } catch {
    return { kind: "manual", text };
  }
}

export function HandoffPanel({
  onChanged,
  onOpen,
}: {
  onChanged: () => void;
  onOpen: (id: string) => void;
}) {
  const [copied, setCopied] = useState<Copied>({ kind: "none" });
  const [busy, setBusy] = useState(false);
  const [pasting, setPasting] = useState<"new" | "fill" | null>(null);

  async function copyFillIn() {
    setBusy(true);
    try {
      const response = await fetch("/api/vocab/incomplete", { cache: "no-store" });
      if (!response.ok) throw new Error("incomplete failed");
      const { items, total } = (await response.json()) as IncompleteResponse;
      if (items.length === 0) {
        setCopied({ kind: "copied", note: "Every item is complete; nothing to fill in." });
        return;
      }
      const more = total > items.length ? ` of ${total}; repeat for the rest` : "";
      setCopied(
        await copy(
          fillInPrompt(items),
          `Fill-in prompt copied (${items.length} items${more}). Paste it into ChatGPT.`,
        ),
      );
    } catch {
      setCopied({ kind: "copied", note: "Could not load incomplete items. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="handoff">
      <p className="eyebrow">CHATGPT</p>
      <div className="handoff-buttons">
        <button
          type="button"
          className="secondary"
          onClick={async () =>
            setCopied(
              await copy(
                newVocabPrompt(),
                "Prompt copied. Paste it into ChatGPT and add your words after it.",
              ),
            )
          }
        >
          Copy prompt
        </button>
        <button type="button" className="secondary" onClick={() => setPasting("new")}>
          Paste new vocab
        </button>
        <button type="button" className="secondary" onClick={copyFillIn} disabled={busy}>
          Copy fill-in prompt
        </button>
        <button type="button" className="secondary" onClick={() => setPasting("fill")}>
          Paste fill-ins
        </button>
      </div>
      {copied.kind === "copied" && (
        <p className="hint" role="status">
          {copied.note}
        </p>
      )}
      {copied.kind === "manual" && (
        <>
          <p className="hint" role="status">
            The clipboard is unavailable. Select the prompt below and copy it.
          </p>
          <textarea readOnly rows={6} value={copied.text} aria-label="Prompt" />
        </>
      )}

      {pasting === "new" && (
        <PasteNewSheet
          onClose={() => setPasting(null)}
          onChanged={onChanged}
          onOpen={(id) => {
            setPasting(null);
            onOpen(id);
          }}
        />
      )}
      {pasting === "fill" && (
        <PasteFillSheet onClose={() => setPasting(null)} onChanged={onChanged} />
      )}
    </div>
  );
}

function PasteBox({ value, onChange }: { value: string; onChange: (text: string) => void }) {
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

const PROPOSAL_LABEL: Readonly<Record<ProposalResult["outcome"], string>> = {
  created: "Added",
  duplicate: "Already in your vault",
  rejected: "Rejected",
};

function PasteNewSheet({
  onClose,
  onChanged,
  onOpen,
}: {
  onClose: () => void;
  onChanged: () => void;
  onOpen: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<HandoffResponse | null>(null);

  async function submit() {
    const pasted = parsePasted(text);
    if (!pasted.ok) return setError(pasted.message);
    setBusy(true);
    setError("");
    const posted = await postJson<HandoffResponse>("/api/handoffs", pasted.value);
    setBusy(false);
    if (!posted.ok) return setError(posted.message);
    setResult(posted.body);
    onChanged();
  }

  return (
    <Sheet label="Paste new vocab" onClose={onClose}>
      <p className="eyebrow">PASTE NEW VOCAB</p>
      {result ? (
        <>
          {result.repeat && (
            <p className="hint">This reply was already imported; nothing new was saved.</p>
          )}
          <ul className="handoff-results">
            {result.results.map((r) => (
              <li key={r.index}>
                <span className="urdu-inline" dir="rtl" lang="ur">
                  {r.urdu}
                </span>{" "}
                · {PROPOSAL_LABEL[r.outcome]}
                {r.outcome === "rejected" && <> ({r.reason})</>}
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
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="button" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Save to vault"}
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
        </>
      )}
    </Sheet>
  );
}

function RevisionLine({ r }: { r: RevisionResult }) {
  return (
    <li>
      <span className="urdu-inline" dir="rtl" lang="ur">
        {r.urdu}
      </span>
      {r.outcome === "rejected" && <> · Rejected ({r.reason})</>}
      {r.outcome === "nothing" && <> · Nothing to fill</>}
      {r.outcome === "fill" && (
        <dl className="handoff-fills">
          {Object.entries(r.fills).map(([field, value]) => (
            <div key={field}>
              <dt>{FIELD_LABELS[field as keyof typeof FIELD_LABELS]}</dt>
              <dd dir="auto">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {r.outcome !== "rejected" && r.kept.length > 0 && (
        <p className="hint">Kept existing: {r.kept.map((f) => FIELD_LABELS[f]).join(", ")}</p>
      )}
    </li>
  );
}

function PasteFillSheet({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<unknown>(null);
  const [plan, setPlan] = useState<RevisionsResponse | null>(null);
  const [saved, setSaved] = useState<RevisionsResponse | null>(null);

  async function preview() {
    const pasted = parsePasted(text);
    if (!pasted.ok) return setError(pasted.message);
    setBusy(true);
    setError("");
    const posted = await postJson<RevisionsResponse>(
      "/api/handoffs/revisions?preview=1",
      pasted.value,
    );
    setBusy(false);
    if (!posted.ok) return setError(posted.message);
    setPayload(pasted.value);
    setPlan(posted.body);
  }

  async function save() {
    setBusy(true);
    setError("");
    const posted = await postJson<RevisionsResponse>("/api/handoffs/revisions", payload);
    setBusy(false);
    if (!posted.ok) return setError(posted.message);
    setSaved(posted.body);
    onChanged();
  }

  const fills = plan?.results.filter((r) => r.outcome === "fill").length ?? 0;
  const shown = saved ?? plan;

  return (
    <Sheet label="Paste fill-ins" onClose={onClose}>
      <p className="eyebrow">
        {saved ? "FILL-INS SAVED" : plan ? "PREVIEW FILL-INS" : "PASTE FILL-INS"}
      </p>
      {shown ? (
        <>
          {shown.repeat && (
            <p className="hint">This reply was already applied; saving again changes nothing.</p>
          )}
          <ul className="handoff-results">
            {shown.results.map((r) => (
              <RevisionLine key={r.vocab_id} r={r} />
            ))}
          </ul>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {saved || plan?.repeat || fills === 0 ? (
            <button type="button" onClick={onClose}>
              Done
            </button>
          ) : (
            <>
              <button type="button" onClick={save} disabled={busy}>
                {busy ? "Saving…" : `Save ${fills} ${fills === 1 ? "item" : "items"}`}
              </button>
              <button type="button" className="secondary" onClick={onClose}>
                Cancel
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <PasteBox value={text} onChange={setText} />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="button" onClick={preview} disabled={busy}>
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
