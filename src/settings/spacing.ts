// f09: how the Settings picker describes a ladder, e.g. "×2.38 · 3 h, 7 h, 17 h, 2 d … 10 y".

import { formatInterval, type Ladder, multiplier } from "../../shared/ladders";

export function spacingSummary(l: Ladder, shown = 5): string {
  const labels = l.intervals_seconds.map(formatInterval);
  const head = labels.slice(0, shown).join(", ");
  const rungs = labels.length > shown ? `${head} … ${labels.at(-1)}` : head;
  if (l.exponent_quarters === null) return rungs;
  return `×${multiplier(l.exponent_quarters).toFixed(2)} · ${rungs}`;
}
