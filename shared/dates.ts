// Review dates (PRD FR-A3). `last_reviewed_on` and `next_review_on` are calendar dates
// ("YYYY-MM-DD") in the home timezone. Day arithmetic is plain calendar arithmetic; the
// timezone only matters when turning an instant into "today", so DST lives in `todayIn`.

import { intervalDays, type Mastery } from "./mastery";

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

// Null means never reviewed, which means due now.
export function nextReviewOn(lastReviewedOn: string | null, mastery: Mastery): string | null {
  return lastReviewedOn === null ? null : addDays(lastReviewedOn, intervalDays(mastery));
}
