// mp06: which way a Mixed review card runs (DECISIONS 261015a). Both directions share one
// schedule, so the choice is a per-card weighted draw: mostly Urdu → English for new words, mostly
// English → Urdu once a word is known. The bands read the current interval, not the rung, so they
// hold across ladder versions. The values are tuning, not invariants; retune here and in the tests.

import type { ReviewDirection } from "./api";

const DAY = 86_400;

// [interval floor in seconds, P(English → Urdu)], longest floor first.
const PRODUCTION_BANDS: readonly (readonly [number, number])[] = [
  [182 * DAY, 0.8],
  [30 * DAY, 0.7],
  [7 * DAY, 0.5],
  [DAY, 0.3],
  [0, 0.1],
];

export function productionChance(intervalSeconds: number): number {
  for (const [floor, chance] of PRODUCTION_BANDS) if (intervalSeconds >= floor) return chance;
  return 0.1;
}

// An item with no English can only be shown Urdu side up, so it is always a recognition review.
export function chooseDirection(
  item: { english: string | null; interval_seconds: number },
  random: () => number = Math.random,
): Extract<ReviewDirection, "ur_en" | "en_ur"> {
  if (!item.english?.trim()) return "ur_en";
  return random() < productionChance(item.interval_seconds) ? "en_ur" : "ur_en";
}
