// Mastery ladder and review grades (PRD FR-A2). The only implementation: the Worker
// computes with these, the UI imports them for display.

import type { ReviewDirection } from "./api";

export const MASTERY_LEVELS = [
  { level: 0, name: "New", intervalDays: 0 },
  { level: 1, name: "Learning", intervalDays: 1 },
  { level: 2, name: "Basic", intervalDays: 5 },
  { level: 3, name: "Firm", intervalDays: 25 },
  { level: 4, name: "Strong", intervalDays: 125 },
  { level: 5, name: "Stable", intervalDays: 625 },
  { level: 6, name: "Permanent", intervalDays: 3125 },
] as const;

export type Mastery = (typeof MASTERY_LEVELS)[number]["level"];

export const MIN_MASTERY: Mastery = 0;
export const MAX_MASTERY: Mastery = 6;

export function isMastery(value: unknown): value is Mastery {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_MASTERY &&
    value <= MAX_MASTERY
  );
}

export function masteryName(mastery: Mastery): string {
  return MASTERY_LEVELS[mastery].name;
}

export function intervalDays(mastery: Mastery): number {
  return MASTERY_LEVELS[mastery].intervalDays;
}

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
// it has been forgotten, so misses cost less; successes gain the same (DECISIONS 260918b).
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

export function applyGrade(mastery: Mastery, grade: Grade, direction: ReviewDirection): Mastery {
  const next = mastery + gradeDeltas(direction)[grade];
  return Math.min(MAX_MASTERY, Math.max(MIN_MASTERY, next)) as Mastery;
}
