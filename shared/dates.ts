// Calendar dates ("YYYY-MM-DD") in the home timezone. Scheduling itself runs on UTC instants
// (shared/ladders.ts, f09); dates remain for "today" labels and for the legacy Airtable schedule,
// which the import cross-checks. Day arithmetic is plain calendar arithmetic; the timezone only
// matters when turning an instant into "today", so DST lives in `todayIn`.

import type { LegacyLevel } from "./mastery";

const LEGACY_INTERVAL_DAYS = [0, 1, 5, 25, 125, 625, 3125] as const;

const DAY_MS = 86_400_000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function todayIn(timeZone: string, instant: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function addDays(date: string, days: number): string {
  if (!isIsoDate(date)) throw new RangeError(`Not a YYYY-MM-DD date: ${date}`);
  if (!Number.isInteger(days)) throw new RangeError(`Not a whole number of days: ${days}`);
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

// The pre-f09 rule, kept for the Airtable cross-check: last reviewed + the legacy interval.
// Null means never reviewed, which means due now.
export function legacyNextReviewOn(
  lastReviewedOn: string | null,
  level: LegacyLevel,
): string | null {
  return lastReviewedOn === null ? null : addDays(lastReviewedOn, LEGACY_INTERVAL_DAYS[level]);
}

// A legacy date as an instant: 08:00 UTC, which is 00:00 PST or 01:00 PDT in Vancouver, so the
// item falls due at the start of the same local day it always did (DECISIONS 260918e).
// migrations/0002_srs_ladder.sql applies the same rule in SQL.
export const LEGACY_TIME = "T08:00:00.000Z";

export function legacyInstant(date: string): string {
  if (!isIsoDate(date)) throw new RangeError(`Not a YYYY-MM-DD date: ${date}`);
  return `${date}${LEGACY_TIME}`;
}
