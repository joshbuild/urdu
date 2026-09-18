// f04 s06: the review session limit (FR-I1, used by f05's FR-E1). Per device, like the voice.

export const DEFAULT_SESSION_LIMIT = 20;
export const MIN_SESSION_LIMIT = 1;
// GET /api/vocab/due caps limit at 200 (MAX_LIMIT in worker/routes/api-vocab.ts).
export const MAX_SESSION_LIMIT = 200;

const KEY = "urdu.sessionLimit";

// Anything that is not a whole number in range falls back to the default rather than erroring:
// a corrupt stored value must never block a review session.
export function parseSessionLimit(raw: string | null | undefined): number {
  if (raw == null || !/^\d+$/.test(raw.trim())) return DEFAULT_SESSION_LIMIT;
  const n = Number(raw.trim());
  return n >= MIN_SESSION_LIMIT && n <= MAX_SESSION_LIMIT ? n : DEFAULT_SESSION_LIMIT;
}

export function readSessionLimit(): number {
  try {
    return parseSessionLimit(localStorage.getItem(KEY));
  } catch {
    return DEFAULT_SESSION_LIMIT;
  }
}

export function storeSessionLimit(limit: number): void {
  try {
    localStorage.setItem(KEY, String(limit));
  } catch {
    // Non-fatal: the limit simply does not survive a reload on this device.
  }
}
