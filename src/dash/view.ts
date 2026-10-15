// Pure view helpers for the Dash (f16 s03): wording, percentages and chart geometry. The numbers
// themselves come from shared/dash.ts through GET /api/dash; nothing here derives a metric.

import type {
  BandPoint,
  CalendarDay,
  DashLevel,
  LevelIntervals,
  LevelMastery,
  RecallBand,
  RecallRate,
} from "../../shared/dash";
import { addDays, weekdayOf } from "../../shared/dates";
import { LADDERS } from "../../shared/ladders";
import { MASTERY_BANDS, type MasteryBand } from "../../shared/mastery";

const SELECTABLE = LADDERS.filter((l) => l.selectable).map((l) => l.id);
// Very dense and Very wide: the ends of the Settings picker.
const DENSEST = Math.min(...SELECTABLE);
const WIDEST = Math.max(...SELECTABLE);

// FR-J3's ladder hint; the server sends only the band (f16 Decisions).
export function recallHint(band: RecallBand, ladderId: number): string | null {
  switch (band) {
    case "high":
      return ladderId === WIDEST
        ? "Recall is high, on the widest ladder"
        : "Recall is high: a wider ladder would mean fewer reviews";
    case "on_target":
      return "On target";
    case "low":
      return ladderId === DENSEST
        ? "Recall is low: add fewer new words for a while"
        : "Recall is low: try a denser ladder or add fewer new words";
    case "insufficient":
      return null;
  }
}

export function percent(rate: RecallRate): number | null {
  return rate.n === 0 ? null : Math.round((100 * rate.recalled) / rate.n);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortDate(day: string): string {
  const [, m, d] = day.split("-").map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]}`;
}

// The calendar as Monday-start weeks of seven, null before the first day and after today.
export function calendarWeeks(days: readonly CalendarDay[]): (CalendarDay | null)[][] {
  const first = days[0];
  if (!first) return [];
  const cells: (CalendarDay | null)[] = [...Array(weekdayOf(first.day)).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

// A week's row heading: its Monday as "Sep 2", even when that Monday is padding.
export function weekLabel(week: readonly (CalendarDay | null)[]): string {
  const i = week.findIndex((d) => d !== null);
  const day = week[i];
  if (!day) return "";
  const [, m, d] = addDays(day.day, -i).split("-").map(Number) as [number, number, number];
  return `${MONTHS[m - 1]} ${d}`;
}

// One closed path per band, Permanent at the bottom and New on top, so growth in what is known
// shows as the lower layers thickening. Empty when there is nothing to draw.
export function stackedAreas(
  history: readonly BandPoint[],
  width: number,
  height: number,
): { band: number; d: string }[] {
  const max = Math.max(0, ...history.map((p) => p.bands.reduce((a, b) => a + b, 0)));
  if (history.length < 2 || max === 0) return [];
  const step = width / (history.length - 1);
  const x = (i: number) => round(i * step);
  const y = (v: number) => round(height - (v / max) * height);
  const base = history.map(() => 0);
  const bands = MASTERY_BANDS.map((b) => b.band).reverse();
  return bands.map((band) => {
    const lower = [...base];
    history.forEach((p, i) => {
      base[i] = (base[i] ?? 0) + (p.bands[band] ?? 0);
    });
    const top = base.map((v, i) => `${x(i)},${y(v)}`);
    const bottom = lower.map((v, i) => `${x(i)},${y(v)}`).reverse();
    return { band, d: `M${top.join(" L")} L${bottom.join(" L")} Z` };
  });
}

export function levelName(level: DashLevel): string {
  return level === "none" ? "No level" : level;
}

// J7's x-axis label for a bin: its lower edge in days, the first bin "<1".
export function binLabel(edge: number): string {
  return edge === 0 ? "<1" : edge.toLocaleString("en");
}

// J7: one polyline per level through its bin centres, scaled to the tallest bin of any level.
export function intervalLines(
  intervals: LevelIntervals,
  width: number,
  height: number,
): {
  max: number;
  slot: number;
  lines: { level: DashLevel; counts: number[]; points: [number, number][] }[];
} {
  const max = Math.max(0, ...intervals.series.flatMap((s) => s.counts));
  const slot = width / Math.max(1, intervals.bins.length);
  const lines =
    max === 0
      ? []
      : intervals.series.map((s) => ({
          level: s.level,
          counts: s.counts,
          points: s.counts.map(
            (c, i) =>
              [round((i + 0.5) * slot), round(height - (c / max) * height)] as [number, number],
          ),
        }));
  return { max, slot, lines };
}

export type StackSegment = {
  key: string;
  // A mastery band 1–6, or the two segments that hang below the axis.
  kind: Exclude<MasteryBand, 0> | "not_started" | "queued";
  count: number;
  y: number;
  h: number;
};

// J8: per level, Learning to Permanent stacked up from the axis and, below it, Not started (band
// 0) with Queued hanging under that, so each bar reads from the queue up to Permanent. Above and
// below share one scale; axis is the axis's y, peak the top of a bar's reviewed part.
export function masteryStacks(
  rows: readonly LevelMastery[],
  height: number,
): {
  axis: number;
  stacks: { level: DashLevel; total: number; peak: number; segments: StackSegment[] }[];
} {
  const up = (r: LevelMastery) => r.bands.slice(1).reduce((a, b) => a + b, 0);
  const down = (r: LevelMastery) => (r.bands[0] ?? 0) + r.queued;
  const maxUp = Math.max(0, ...rows.map(up));
  const maxDown = Math.max(0, ...rows.map(down));
  const unit = maxUp + maxDown === 0 ? 0 : height / (maxUp + maxDown);
  const axis = round(maxUp * unit);
  const stacks = rows.map((r) => {
    const segments: StackSegment[] = [];
    let top = maxUp * unit;
    for (const { band } of MASTERY_BANDS.slice(1) as { band: Exclude<MasteryBand, 0> }[]) {
      const count = r.bands[band] ?? 0;
      if (count === 0) continue;
      const h = count * unit;
      top -= h;
      segments.push({ key: `b${band}`, kind: band, count, y: round(top), h: round(h) });
    }
    const peak = round(top);
    let bottom = maxUp * unit;
    for (const [kind, count] of [
      ["not_started", r.bands[0] ?? 0],
      ["queued", r.queued],
    ] as const) {
      if (count === 0) continue;
      const h = count * unit;
      segments.push({ key: kind, kind, count, y: round(bottom), h: round(h) });
      bottom += h;
    }
    return { level: r.level, total: up(r) + down(r), peak, segments };
  });
  return { axis, stacks };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
