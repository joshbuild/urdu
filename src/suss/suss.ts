// mp07: suss cards — flag a questionable item with a comment, or clear the flag. Neither is an
// edit: the Worker leaves updated_at and the schedule alone, so flagging mid-review never makes
// the next grade a conflict.

import type { SussRequest, VocabItem } from "../../shared/api";
import { MAX_SUSS_NOTE } from "../../shared/api";

export type Sent = { ok: true; item: VocabItem } | { ok: false; message: string };

export function sussPath(id: string): string {
  return `/api/vocab/${encodeURIComponent(id)}/suss`;
}

// What the comment box holds once trimmed; blank stores no comment.
export function sussBody(note: string): SussRequest {
  return { note: note.trim() || null };
}

export function noteProblem(note: string): string | null {
  const length = note.trim().length;
  return length > MAX_SUSS_NOTE ? `Keep the comment to ${MAX_SUSS_NOTE} characters.` : null;
}

export function isSuss(item: Pick<VocabItem, "suss_at">): boolean {
  return item.suss_at !== null;
}

async function send(id: string, method: "PUT" | "DELETE", note?: string): Promise<Sent> {
  try {
    const response = await fetch(sussPath(id), {
      method,
      ...(note === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sussBody(note)),
          }),
    });
    if (response.ok) return { ok: true, item: (await response.json()) as VocabItem };
    if (response.status === 404) return { ok: false, message: "This item has been deleted." };
    if (response.status === 401) {
      return { ok: false, message: "This device is locked. Unlock it and try again." };
    }
    return { ok: false, message: "Could not save. Please try again." };
  } catch {
    return { ok: false, message: "Could not connect. Check your connection and try again." };
  }
}

export const markSuss = (id: string, note: string) => send(id, "PUT", note);
export const clearSuss = (id: string) => send(id, "DELETE");
