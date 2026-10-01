// The Dash's derivations (f16, PRD FR-J1–J6). Pure functions over the whole vault and its review
// history: the Worker reads both tables and calls buildDash, the client only draws the result.
// Days are home-timezone calendar days; weeks start on Monday. Nothing here writes. Queued items
// (f17, released_at null) are words waiting, not words in review: the vault-state blocks (J1, J2,
// J5) leave them out, and an item exists from its released_at day.

import type { ReviewEvent, VocabItem } from "./api";
import { addDays, dateIn, weekdayOf } from "./dates";
import {
  bandForInterval,
  type Grade,
  isKnown,
  KNOWN_MIN_SECONDS,
  MASTERY_BANDS,
  type MasteryBand,
  masteryBand,
} from "./mastery";

export type DashVocab = Pick<
  VocabItem,
  | "id"
  | "urdu"
  | "english"
  | "added_at"
  | "released_at"
  | "interval_seconds"
  | "last_reviewed_at"
  | "due_at"
>;
export type DashEvent = Pick<
  ReviewEvent,
  | "vocab_id"
  | "reviewed_at"
  | "grade"
  | "direction"
  | "prompt_support"
  | "interval_before"
  | "due_before"
  | "interval_after"
>;

// Items per mastery band (index = band) on a day.
export type BandPoint = { day: string; bands: number[] };
export type DayCount = { day: string; count: number };
export type RecallRate = { n: number; recalled: number };
export type RecallBand = "high" | "on_target" | "low" | "insufficient";
export type TroubleItem = {
  id: string;
  urdu: string;
  english: string | null;
  lapses: number;
  band: MasteryBand;
};
// started: items released into review that week (f17; was items added).
export type BacklogWeek = { week: string; started: number; known: number };
export type CalendarLevel = 0 | 1 | 2 | 3 | 4;
export type CalendarDay = { day: string; count: number; level: CalendarLevel };

export type Dash = {
  today: string;
  known: { count: number; history: BandPoint[] };
  forecast: { overdue: number; new: number; days: DayCount[] };
  recall: { recognition: RecallRate; production: RecallRate; band: RecallBand };
  trouble: TroubleItem[];
  backlog: { now: number; weeks: BacklogWeek[] };
  calendar: CalendarDay[];
};

const DAY_MS = 86_400_000;
const SLOT_MS = 900_000;
export const WINDOW_DAYS = 30;
export const FORECAST_DAYS = 14;
export const MIN_RECALL_SAMPLE = 30;
// The target recall band (recognition), as fractions.
export const RECALL_TARGET = { low: 0.8, high: 0.9 } as const;
export const TROUBLE_MIN_LAPSES = 2;
export const TROUBLE_LIMIT = 8;
export const BACKLOG_WEEKS = 8;
export const CALENDAR_DAYS = 84;
// History beyond this many days is drawn a point per week.
export const DAILY_HISTORY_DAYS = 90;

const RECALLED: ReadonlySet<Grade> = new Set(["hesitant", "correct", "confident"]);
const LAPSES: ReadonlySet<Grade> = new Set(["wrong", "partial"]);
const BACKLOG_BANDS: ReadonlySet<MasteryBand> = new Set([0, 1, 2]);

// Calendar shading: 0, 1–9, 10–19, 20–39, 40+.
export function calendarLevel(count: number): CalendarLevel {
  if (count <= 0) return 0;
  if (count < 10) return 1;
  if (count < 20) return 2;
  if (count < 40) return 3;
  return 4;
}

export function recallBand(recognition: RecallRate): RecallBand {
  if (recognition.n < MIN_RECALL_SAMPLE) return "insufficient";
  // Banded on the whole percent the Dash shows, so the hint never contradicts the number.
  const pct = Math.round((100 * recognition.recalled) / recognition.n);
  if (pct > RECALL_TARGET.high * 100) return "high";
  if (pct < RECALL_TARGET.low * 100) return "low";
  return "on_target";
}

export function weekStart(date: string): string {
  return addDays(date, -weekdayOf(date));
}

export function buildDash(
  vocab: readonly DashVocab[],
  events: readonly DashEvent[],
  now: Date,
  timeZone: string,
): Dash {
  const dayOf = dateIn(timeZone);
  // Intl formatting dominates the cost, so memoise by 15-minute slot: every real UTC offset is a
  // multiple of 15 minutes, so all instants in one slot share a home day.
  const slots = new Map<number, string>();
  const day = (instant: string) => {
    const ms = Date.parse(instant);
    const slot = Math.floor(ms / SLOT_MS);
    let d = slots.get(slot);
    if (d === undefined) {
      d = dayOf(new Date(ms));
      slots.set(slot, d);
    }
    return d;
  };
  const today = dayOf(now);
  const nowMs = now.getTime();
  const windowStartMs = nowMs - WINDOW_DAYS * DAY_MS;

  const byId = new Map(vocab.map((v) => [v.id, v]));
  // Events of items still in the vault, oldest first, with their home day.
  const timeline = events
    .filter((e) => byId.has(e.vocab_id))
    .map((e) => ({ ...e, ms: Date.parse(e.reviewed_at), day: day(e.reviewed_at) }))
    .sort((a, b) => a.ms - b.ms);

  const released = vocab.filter((v) => v.released_at !== null);

  return {
    today,
    known: {
      count: released.filter(isKnown).length,
      history: bandHistory(released, timeline, today, day),
    },
    forecast: forecast(released, nowMs, today, day),
    recall: recall(timeline, windowStartMs),
    trouble: trouble(byId, timeline, windowStartMs),
    backlog: backlog(released, timeline, today, day),
    calendar: calendar(timeline, today),
  };
}

type TimedEvent = DashEvent & { ms: number; day: string };

function emptyBands(): number[] {
  return MASTERY_BANDS.map(() => 0);
}

function historyDays(start: string, today: string): string[] {
  const span = daysBetween(start, today) + 1;
  if (span <= DAILY_HISTORY_DAYS) {
    return Array.from({ length: span }, (_, i) => addDays(start, i));
  }
  const weeks = Math.floor((span - 1) / 7);
  return Array.from({ length: weeks + 1 }, (_, i) => addDays(today, -7 * (weeks - i)));
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

// J1: items per band on each day, replayed from events. Today's point is the current schedule, so
// it always matches the headline even after a step correction (which records no event). Takes
// released items only; each counts from its released_at day.
function bandHistory(
  vocab: readonly DashVocab[],
  timeline: readonly TimedEvent[],
  today: string,
  day: (instant: string) => string,
): BandPoint[] {
  const first = timeline[0];
  const start = first && first.day < today ? first.day : today;
  const days = historyDays(start, today);

  const eventsOf = new Map<string, TimedEvent[]>();
  for (const e of timeline) {
    const list = eventsOf.get(e.vocab_id);
    if (list) list.push(e);
    else eventsOf.set(e.vocab_id, [e]);
  }

  const points = days.map((d) => ({ day: d, bands: emptyBands() }));
  for (const v of vocab) {
    const addedDay = day(v.released_at as string);
    const own = eventsOf.get(v.id) ?? [];
    const current = masteryBand(v);
    const firstEvent = own[0];
    const before: MasteryBand = !firstEvent
      ? current
      : firstEvent.due_before === null
        ? 0
        : bandForInterval(firstEvent.interval_before);
    let next = 0;
    let band = before;
    for (const point of points) {
      if (point.day < addedDay) continue;
      while (next < own.length && (own[next] as TimedEvent).day <= point.day) {
        band = bandForInterval((own[next] as TimedEvent).interval_after);
        next += 1;
      }
      const shown = point.day === today ? current : band;
      point.bands[shown] = (point.bands[shown] ?? 0) + 1;
    }
  }
  return points;
}

// J2: overdue (due now or earlier), new (released, never reviewed), then today and the next 13
// days. Takes released items only.
function forecast(
  vocab: readonly DashVocab[],
  nowMs: number,
  today: string,
  day: (instant: string) => string,
): Dash["forecast"] {
  const days = Array.from({ length: FORECAST_DAYS }, (_, i) => ({
    day: addDays(today, i),
    count: 0,
  }));
  const index = new Map(days.map((d, i) => [d.day, i]));
  let overdue = 0;
  let fresh = 0;
  for (const v of vocab) {
    if (v.due_at === null) {
      fresh += 1;
      continue;
    }
    if (Date.parse(v.due_at) <= nowMs) {
      overdue += 1;
      continue;
    }
    const i = index.get(day(v.due_at));
    if (i !== undefined) (days[i] as DayCount).count += 1;
  }
  return { overdue, new: fresh, days };
}

// J3: scheduled reviews with no prompt support in the last 30 days, any source.
function recall(timeline: readonly TimedEvent[], windowStartMs: number): Dash["recall"] {
  const recognition = { n: 0, recalled: 0 };
  const production = { n: 0, recalled: 0 };
  for (const e of timeline) {
    if (e.ms < windowStartMs || e.due_before === null || e.prompt_support !== "none") continue;
    const rate = e.direction === "ur_en" ? recognition : production;
    rate.n += 1;
    if (RECALLED.has(e.grade)) rate.recalled += 1;
  }
  return { recognition, production, band: recallBand(recognition) };
}

// J4: items with at least two Wrong or Partially correct grades in 30 days, any event.
function trouble(
  byId: ReadonlyMap<string, DashVocab>,
  timeline: readonly TimedEvent[],
  windowStartMs: number,
): TroubleItem[] {
  const tally = new Map<string, { lapses: number; latest: number }>();
  for (const e of timeline) {
    if (e.ms < windowStartMs || !LAPSES.has(e.grade)) continue;
    const t = tally.get(e.vocab_id) ?? { lapses: 0, latest: 0 };
    t.lapses += 1;
    t.latest = Math.max(t.latest, e.ms);
    tally.set(e.vocab_id, t);
  }
  return [...tally]
    .filter(([, t]) => t.lapses >= TROUBLE_MIN_LAPSES)
    .map(([id, t]) => ({ v: byId.get(id) as DashVocab, ...t }))
    .sort(
      (a, b) =>
        b.lapses - a.lapses ||
        b.latest - a.latest ||
        (a.v.urdu < b.v.urdu ? -1 : a.v.urdu > b.v.urdu ? 1 : 0),
    )
    .slice(0, TROUBLE_LIMIT)
    .map(({ v, lapses }) => ({
      id: v.id,
      urdu: v.urdu,
      english: v.english,
      lapses,
      band: masteryBand(v),
    }));
}

// J5: released items in New, Learning or Basic now; per week, items started (released) and items
// reaching Known.
function backlog(
  vocab: readonly DashVocab[],
  timeline: readonly TimedEvent[],
  today: string,
  day: (instant: string) => string,
): Dash["backlog"] {
  const weeksOf = new Map<string, string>();
  const weekOf = (d: string) => {
    let w = weeksOf.get(d);
    if (w === undefined) {
      w = weekStart(d);
      weeksOf.set(d, w);
    }
    return w;
  };
  const current = weekStart(today);
  const weeks = Array.from({ length: BACKLOG_WEEKS }, (_, i) => ({
    week: addDays(current, -7 * (BACKLOG_WEEKS - 1 - i)),
    started: 0,
    known: 0,
  }));
  const index = new Map(weeks.map((w, i) => [w.week, i]));
  for (const v of vocab) {
    const i = index.get(weekOf(day(v.released_at as string)));
    if (i !== undefined) (weeks[i] as BacklogWeek).started += 1;
  }
  const crossed = new Set<string>();
  for (const e of timeline) {
    if (e.interval_before >= KNOWN_MIN_SECONDS || e.interval_after < KNOWN_MIN_SECONDS) continue;
    const week = weekOf(e.day);
    const i = index.get(week);
    if (i === undefined || crossed.has(`${week}|${e.vocab_id}`)) continue;
    crossed.add(`${week}|${e.vocab_id}`);
    (weeks[i] as BacklogWeek).known += 1;
  }
  return {
    now: vocab.filter((v) => BACKLOG_BANDS.has(masteryBand(v))).length,
    weeks,
  };
}

// J6: review events per day over the 84 days ending today, any source or support.
function calendar(timeline: readonly TimedEvent[], today: string): CalendarDay[] {
  const counts = new Map<string, number>();
  for (const e of timeline) counts.set(e.day, (counts.get(e.day) ?? 0) + 1);
  return Array.from({ length: CALENDAR_DAYS }, (_, i) => {
    const d = addDays(today, i - (CALENDAR_DAYS - 1));
    const count = counts.get(d) ?? 0;
    return { day: d, count, level: calendarLevel(count) };
  });
}
