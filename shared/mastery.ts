// Review grades and mastery display (PRD FR-A2, f09). Grade deltas are the only implementation:
// shared/ladders.ts applies them, the UI imports the labels. Mastery is no longer stored; it is a
// display band derived from an item's current interval.

import type { ReviewDirection } from "./api";

// Ladder order, worst to best (FR-E3 button order).
export const GRADES = ["wrong", "partial", "hesitant", "correct", "confident"] as const;

export type Grade = (typeof GRADES)[number];

// Recognition (Urdu → English): the original ladder deltas.
export const GRADE_DELTAS: Readonly<Record<Grade, number>> = {
  wrong: -2,
  partial: -1,
  hesitant: 0,
  correct: 1,
  confident: 2,
};

// Production (English → Urdu, and oral Coach answers): failing to produce a word is weak evidence
// it has been forgotten, so misses cost less; successes gain the same (DECISIONS 260918b, kept by
// 260918d over the research report's table).
export const PRODUCTION_GRADE_DELTAS: Readonly<Record<Grade, number>> = {
  wrong: -1,
  partial: 0,
  hesitant: 0,
  correct: 1,
  confident: 2,
};

export function gradeDeltas(direction: ReviewDirection): Readonly<Record<Grade, number>> {
  return direction === "ur_en" ? GRADE_DELTAS : PRODUCTION_GRADE_DELTAS;
}

export const GRADE_LABELS: Readonly<Record<Grade, string>> = {
  wrong: "Wrong",
  partial: "Partially correct",
  hesitant: "Hesitantly correct",
  correct: "Correct",
  confident: "Confidently correct",
};

export function isGrade(value: unknown): value is Grade {
  return typeof value === "string" && (GRADES as readonly string[]).includes(value);
}

// Airtable's 0-6 "Mastery Score" (FR-H). Only the import reads it; it becomes a rung on the
// legacy ladder, whose rung n is the old level n.
export type LegacyLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function isLegacyLevel(value: unknown): value is LegacyLevel {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6;
}

const DAY = 86_400;

// Bands keep the old level names, and their upper bounds sit on the legacy intervals, so a
// migrated item reads exactly as it did before f09. Band 0 is also a legacy level-0 item.
export const MASTERY_BANDS = [
  { band: 0, name: "New", maxSeconds: 3 * 3600 - 1 },
  { band: 1, name: "Learning", maxSeconds: 1 * DAY },
  { band: 2, name: "Basic", maxSeconds: 7 * DAY },
  { band: 3, name: "Firm", maxSeconds: 30 * DAY },
  { band: 4, name: "Strong", maxSeconds: 180 * DAY },
  { band: 5, name: "Stable", maxSeconds: 730 * DAY },
  { band: 6, name: "Permanent", maxSeconds: Number.POSITIVE_INFINITY },
] as const;

export type MasteryBand = (typeof MASTERY_BANDS)[number]["band"];

export function bandForInterval(seconds: number): MasteryBand {
  const found = MASTERY_BANDS.find((b) => seconds <= b.maxSeconds);
  return found ? found.band : 6;
}

export function masteryBand(item: {
  interval_seconds: number;
  last_reviewed_at: string | null;
}): MasteryBand {
  return item.last_reviewed_at === null ? 0 : bandForInterval(item.interval_seconds);
}

export function bandName(band: MasteryBand): string {
  return MASTERY_BANDS[band].name;
}
