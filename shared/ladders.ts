// Review ladders (f09, DECISIONS 260918c/e). The only implementation of scheduling: the Worker
// computes with these, the UI imports them for labels and the Settings picker.
//
// Every version is an immutable literal. Never edit an interval array: a changed ladder is a new
// id, because items and review events keep pointing at the version they were scheduled on.
// `generateIntervals` produces new versions; ladders.test.ts pins each literal to it.

import type { ReviewDirection } from "./api";
import { type Grade, gradeDeltas } from "./mastery";

const HOUR = 3600;
const DAY = 86_400;

export const BASE_INTERVAL_SECONDS = 3 * HOUR;
// Fixed day count, not calendar-aware (research §11, deferred).
export const MAX_INTERVAL_SECONDS = 3650 * DAY;

export type Ladder = {
  id: number;
  name: string;
  // Multiplier = 2^(exponent_quarters / 4). Null for the legacy ladder, which is not geometric.
  exponent_quarters: number | null;
  // Offered in the Settings picker. The legacy ladder only holds migrated items.
  selectable: boolean;
  intervals_seconds: readonly number[];
};

export const LEGACY_LADDER_ID = 1;
export const DEFAULT_LADDER_ID = 3;

export const LADDERS: readonly Ladder[] = [
  {
    id: 1,
    name: "Legacy ×5",
    exponent_quarters: null,
    selectable: false,
    intervals_seconds: [0, 1, 5, 25, 125, 625, 3125].map((days) => days * DAY),
  },
  {
    id: 2,
    name: "Dense",
    exponent_quarters: 4,
    selectable: true,
    intervals_seconds: [
      10800, 21600, 43200, 86400, 172800, 345600, 691200, 1382400, 2764800, 5529600, 11059200,
      22118400, 44236800, 88473600, 176947200, 315360000,
    ],
  },
  {
    id: 3,
    name: "Moderate",
    exponent_quarters: 5,
    selectable: true,
    intervals_seconds: [
      10800, 25687, 61094, 145307, 345600, 821980, 1955009, 4649821, 11059200, 26303359, 62560283,
      148794266, 315360000,
    ],
  },
  {
    id: 4,
    name: "Balanced",
    exponent_quarters: 6,
    selectable: true,
    intervals_seconds: [
      10800, 30547, 86400, 244376, 691200, 1955009, 5529600, 15640071, 44236800, 125120565,
      315360000,
    ],
  },
  {
    id: 5,
    name: "Wide",
    exponent_quarters: 7,
    selectable: true,
    intervals_seconds: [
      10800, 36327, 122188, 410990, 1382400, 4649821, 15640071, 52606717, 176947200, 315360000,
    ],
  },
  {
    id: 6,
    name: "Very wide",
    exponent_quarters: 8,
    selectable: true,
    intervals_seconds: [
      10800, 43200, 172800, 691200, 2764800, 11059200, 44236800, 176947200, 315360000,
    ],
  },
];

export function getLadder(id: number): Ladder | undefined {
  return LADDERS.find((ladder) => ladder.id === id);
}

export function ladder(id: number): Ladder {
  const found = getLadder(id);
  if (!found) throw new RangeError(`Unknown ladder id: ${id}`);
  return found;
}

export function isSelectableLadderId(value: unknown): value is number {
  return typeof value === "number" && getLadder(value)?.selectable === true;
}

export function maxStep(l: Ladder): number {
  return l.intervals_seconds.length - 1;
}

export function multiplier(exponentQuarters: number): number {
  return 2 ** (exponentQuarters / 4);
}

// Rounding policy: nearest whole second of base × 2^(q·i/4); the first rung at or past the cap
// becomes the cap, so the cap appears exactly once.
export function generateIntervals(
  exponentQuarters: number,
  base = BASE_INTERVAL_SECONDS,
  max = MAX_INTERVAL_SECONDS,
): number[] {
  const out: number[] = [];
  for (let i = 0; ; i++) {
    const candidate = Math.round(base * multiplier(exponentQuarters * i));
    if (candidate >= max) {
      out.push(max);
      return out;
    }
    out.push(candidate);
  }
}

// The rung whose interval is multiplicatively closest (10→20 d is as far as 100→200 d). Ties go
// to the shorter rung. A zero interval (legacy New) maps to the first rung.
export function nearestStep(l: Ladder, intervalSeconds: number): number {
  if (intervalSeconds <= 0) return 0;
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  l.intervals_seconds.forEach((rung, step) => {
    if (rung <= 0) return;
    const distance = Math.abs(Math.log(rung / intervalSeconds));
    // Strictly less keeps the earlier (shorter) rung on a tie; the epsilon absorbs float noise.
    if (distance < bestDistance - 1e-12) {
      best = step;
      bestDistance = distance;
    }
  });
  return best;
}

export type ScheduleState = {
  ladder_id: number;
  ladder_step: number;
  interval_seconds: number;
};

export type ScheduledReview = ScheduleState & {
  applied_delta: number;
  // The rung on the active ladder the delta was applied to.
  base_step: number;
  last_reviewed_at: string;
  due_at: string;
};

export function addSeconds(iso: string, seconds: number): string {
  return new Date(Date.parse(iso) + seconds * 1000).toISOString();
}

// One tracked review (research §4.6, §6.1). An item on an older ladder joins the active one here,
// never before: switching ladders rewrites no outstanding due time.
export function scheduleReview(
  current: ScheduleState,
  grade: Grade,
  direction: ReviewDirection,
  activeLadderId: number,
  reviewedAt: string,
): ScheduledReview {
  const active = ladder(activeLadderId);
  const baseStep =
    current.ladder_id === active.id
      ? Math.min(current.ladder_step, maxStep(active))
      : nearestStep(active, current.interval_seconds);
  const delta = gradeDeltas(direction)[grade];
  const step = Math.min(maxStep(active), Math.max(0, baseStep + delta));
  const interval = active.intervals_seconds[step] as number;
  return {
    ladder_id: active.id,
    ladder_step: step,
    interval_seconds: interval,
    applied_delta: delta,
    base_step: baseStep,
    last_reviewed_at: reviewedAt,
    due_at: addSeconds(reviewedAt, interval),
  };
}

// A manual correction (FR-D2): put the item on the active ladder at `step`. The due time follows
// from the last review; a never-reviewed item stays due now.
export function correctStep(
  step: number,
  activeLadderId: number,
  lastReviewedAt: string | null,
): ScheduleState & { due_at: string | null } {
  const active = ladder(activeLadderId);
  const interval = active.intervals_seconds[step];
  if (interval === undefined) throw new RangeError(`Step ${step} is outside ${active.name}`);
  return {
    ladder_id: active.id,
    ladder_step: step,
    interval_seconds: interval,
    due_at: lastReviewedAt === null ? null : addSeconds(lastReviewedAt, interval),
  };
}

// Display only; labels never drive scheduling. Rounded to one unit so the Settings picker and the
// vocab pill read at a glance ("3 h", "10 d", "3 wk", "4 mo", "4.7 y").
export function formatInterval(seconds: number): string {
  if (seconds <= 0) return "now";
  if (seconds < DAY) return `${Math.max(1, Math.round(seconds / HOUR))} h`;
  const days = seconds / DAY;
  if (days < 14) return `${Math.round(days)} d`;
  if (days < 49) return `${Math.round(days / 7)} wk`;
  if (days < 365) return `${Math.round(days / 30.4375)} mo`;
  const years = Math.round((days / 365.25) * 10) / 10;
  return `${Number.isInteger(years) ? years.toFixed(0) : years} y`;
}
