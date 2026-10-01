// The ChatGPT round trips' shared plumbing (f06; split out for f17 so the Harvest tab and the
// Vocab tab's check rows use the same): JSON posts with the app's error wording, clipboard copy
// with a manual fallback, and the ⓘ help rows.

import type { ConflictResponse, InvalidRequestResponse } from "../../shared/api";
import { describeInvalid } from "./prompts";

export type Posted<T> = { ok: true; body: T } | { ok: false; message: string };

export async function postJson<T>(path: string, value: unknown): Promise<Posted<T>> {
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
    if (response.status === 404) {
      return { ok: false, message: "Not found: it may have been deleted. Nothing was saved." };
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
export type Copied =
  | { kind: "none" }
  | { kind: "copied"; note: string }
  | { kind: "manual"; text: string };

export async function copy(text: string, note: string): Promise<Copied> {
  try {
    await navigator.clipboard.writeText(text);
    return { kind: "copied", note };
  } catch {
    return { kind: "manual", text };
  }
}

export function CopiedNote({ copied, label = "Prompt" }: { copied: Copied; label?: string }) {
  if (copied.kind === "copied") {
    return (
      <p className="hint" role="status">
        {copied.note}
      </p>
    );
  }
  if (copied.kind === "manual") {
    return (
      <>
        <p className="hint" role="status">
          The clipboard is unavailable. Select the text below and copy it.
        </p>
        <textarea readOnly rows={6} value={copied.text} aria-label={label} />
      </>
    );
  }
  return null;
}

export function InfoToggle({
  id,
  name,
  open,
  onToggle,
}: {
  id: string;
  name: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="info-toggle"
      aria-label={`How ${name} works`}
      aria-expanded={open}
      aria-controls={`handoff-info-${id}`}
      onClick={onToggle}
    >
      {"\u{24D8}"}
    </button>
  );
}

export function InfoBox({ id, text }: { id: string; text: string }) {
  return (
    <p className="handoff-info" id={`handoff-info-${id}`}>
      {text}
    </p>
  );
}
