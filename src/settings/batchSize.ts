// f17 (FR-K, FR-I1): the "New words per day" field. Stored in the vault, not on the device: the
// Worker's top-up reads it. Mirrors the Worker's bounds (worker/domain/intake.ts).

export const MIN_BATCH = 1;
export const MAX_BATCH = 50;

// A whole number in range, or null.
export function parseBatchSize(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n >= MIN_BATCH && n <= MAX_BATCH ? n : null;
}
