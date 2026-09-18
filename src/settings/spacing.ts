// f09: how the Settings picker describes a ladder: a "×2.00" multiplier, then its rungs grouped
// one row per unit ("1 > 2 > 4 > 8 > 16  days"). Display only; the units here are coarser than
// formatInterval's so each row reads as a short run of whole numbers.

import { type Ladder, multiplier } from "../../shared/ladders";

const HOUR = 3600;
const DAY = 86_400;

// Upper bound (exclusive, in days) and size of each display unit.
const UNITS = [
  { name: "hours", below: 1, days: HOUR / DAY },
  { name: "days", below: 28, days: 1 },
  { name: "weeks", below: 182, days: 7 },
  { name: "months", below: 730, days: 30.4375 },
  { name: "years", below: Number.POSITIVE_INFINITY, days: 365.25 },
] as const;

export type SpacingRow = { unit: string; values: number[] };

export function spacingMultiplier(l: Ladder): string | null {
  return l.exponent_quarters === null ? null : `×${multiplier(l.exponent_quarters).toFixed(2)}`;
}

export function spacingRows(l: Ladder): SpacingRow[] {
  const rows: SpacingRow[] = [];
  for (const seconds of l.intervals_seconds) {
    const days = seconds / DAY;
    const unit = UNITS.find((u) => days < u.below) ?? UNITS[4];
    const value = Math.round(days / unit.days);
    const last = rows.at(-1);
    if (last?.unit === unit.name) last.values.push(value);
    else rows.push({ unit: unit.name, values: [value] });
  }
  return rows;
}
