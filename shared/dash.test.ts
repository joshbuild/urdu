import { describe, expect, it } from "vitest";
import {
  buildDash,
  calendarLevel,
  type DashEvent,
  type DashVocab,
  MIN_RECALL_SAMPLE,
  TROUBLE_LIMIT,
} from "./dash";
import { addDays } from "./dates";
import { KNOWN_MIN_SECONDS } from "./mastery";

const TZ = "America/Vancouver";
const DAY = 86_400;
const DAY_MS = DAY * 1000;
// Thursday 2026-10-01, 12:00 PDT.
const NOW = new Date("2026-10-01T19:00:00.000Z");
const TODAY = "2026-10-01";

let seq = 0;

function item(overrides: Partial<DashVocab> = {}): DashVocab {
  seq += 1;
  return {
    id: `v${seq}`,
    urdu: `لفظ${seq}`,
    english: `word ${seq}`,
    added_at: "2026-09-01T19:00:00.000Z",
    interval_seconds: 3600,
    last_reviewed_at: null,
    due_at: null,
    ...overrides,
  };
}

function reviewed(interval: number, overrides: Partial<DashVocab> = {}): DashVocab {
  return item({
    interval_seconds: interval,
    last_reviewed_at: "2026-09-30T19:00:00.000Z",
    due_at: new Date(Date.parse("2026-09-30T19:00:00.000Z") + interval * 1000).toISOString(),
    ...overrides,
  });
}

function ev(vocab_id: string, overrides: Partial<DashEvent> = {}): DashEvent {
  return {
    vocab_id,
    reviewed_at: "2026-09-30T19:00:00.000Z",
    grade: "correct",
    direction: "ur_en",
    prompt_support: "none",
    interval_before: 3600,
    due_before: "2026-09-30T18:00:00.000Z",
    interval_after: DAY,
    ...overrides,
  };
}

// An instant at 12:00 PDT on a Vancouver date (valid for dates in PDT).
const noon = (date: string) => `${date}T19:00:00.000Z`;
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

const dash = (vocab: DashVocab[], events: DashEvent[] = [], now = NOW) =>
  buildDash(vocab, events, now, TZ);

describe("known (J1)", () => {
  it("counts reviewed items on an interval of 14 days or more, overdue included", () => {
    const vocab = [
      reviewed(KNOWN_MIN_SECONDS),
      reviewed(KNOWN_MIN_SECONDS - 1),
      reviewed(30 * DAY, { due_at: "2026-09-01T00:00:00.000Z" }),
      item({ interval_seconds: 100 * DAY }),
    ];
    expect(dash(vocab).known.count).toBe(2);
  });
});

describe("band history (J1)", () => {
  it("is one point for today, at current bands, with no events", () => {
    const d = dash([item(), reviewed(20 * DAY)]);
    expect(d.known.history).toEqual([{ day: TODAY, bands: [1, 0, 0, 1, 0, 0, 0] }]);
  });

  it("replays bands from events, the band before a first event, and event-less items", () => {
    const a = reviewed(20 * DAY, { added_at: noon("2026-09-20") });
    // Imported on Strong: its first event was not its first review.
    const b = reviewed(DAY, { added_at: noon("2026-09-20") });
    // Never reviewed before its first event.
    const c = reviewed(5 * DAY, { added_at: noon("2026-09-20") });
    // Added mid-range, never reviewed.
    const d = item({ added_at: noon("2026-09-27") });
    const events = [
      ev(a.id, {
        reviewed_at: noon("2026-09-25"),
        due_before: null,
        interval_before: 3600,
        interval_after: 3 * DAY,
      }),
      ev(a.id, { reviewed_at: noon("2026-09-28"), interval_after: 20 * DAY }),
      ev(b.id, { reviewed_at: noon("2026-09-29"), interval_before: 40 * DAY, interval_after: DAY }),
      ev(c.id, {
        reviewed_at: noon("2026-09-30"),
        due_before: null,
        interval_before: 3600,
        interval_after: 5 * DAY,
      }),
    ];
    const history = dash([a, b, c, d], events).known.history;
    expect(history.map((p) => p.day)).toEqual([
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      TODAY,
    ]);
    const byDay = Object.fromEntries(history.map((p) => [p.day, p.bands]));
    //                                New L  B  F  S  St P
    expect(byDay["2026-09-25"]).toEqual([1, 0, 1, 0, 1, 0, 0]);
    expect(byDay["2026-09-26"]).toEqual([1, 0, 1, 0, 1, 0, 0]);
    expect(byDay["2026-09-27"]).toEqual([2, 0, 1, 0, 1, 0, 0]);
    expect(byDay["2026-09-28"]).toEqual([2, 0, 0, 1, 1, 0, 0]);
    expect(byDay["2026-09-29"]).toEqual([2, 1, 0, 1, 0, 0, 0]);
    expect(byDay["2026-09-30"]).toEqual([1, 1, 1, 1, 0, 0, 0]);
    expect(byDay[TODAY]).toEqual([1, 1, 1, 1, 0, 0, 0]);
  });

  it("buckets events and additions by the home-timezone day", () => {
    // 2026-09-29 23:30 PDT: still the 29th at home, already the 30th in UTC.
    const a = reviewed(5 * DAY, { added_at: "2026-09-30T06:30:00.000Z" });
    const events = [
      ev(a.id, {
        reviewed_at: "2026-09-30T06:30:00.000Z",
        due_before: null,
        interval_after: 5 * DAY,
      }),
    ];
    const history = dash([a], events).known.history;
    expect(history[0]).toEqual({ day: "2026-09-29", bands: [0, 0, 1, 0, 0, 0, 0] });
  });

  it("takes today's point from the current schedule, so it matches the headline", () => {
    // A step correction moved the item without an event.
    const a = reviewed(3 * DAY);
    const events = [ev(a.id, { reviewed_at: noon("2026-09-28"), interval_after: 20 * DAY })];
    const history = dash([a], events).known.history;
    expect(history.at(-2)?.bands).toEqual([0, 0, 0, 1, 0, 0, 0]);
    expect(history.at(-1)?.bands).toEqual([0, 0, 1, 0, 0, 0, 0]);
  });

  it("has a point per day for up to 90 days", () => {
    const a = reviewed(DAY, { added_at: noon("2026-06-01") });
    const start = addDays(TODAY, -89);
    const history = dash([a], [ev(a.id, { reviewed_at: noon(start) })]).known.history;
    expect(history).toHaveLength(90);
    expect(history[0]?.day).toBe(start);
  });

  it("has a point per week, ending today, beyond 90 days", () => {
    const a = reviewed(DAY, { added_at: noon("2026-01-01") });
    const start = addDays(TODAY, -200);
    const history = dash([a], [ev(a.id, { reviewed_at: noon(start) })]).known.history;
    expect(history).toHaveLength(29);
    expect(history[0]?.day).toBe(addDays(TODAY, -196));
    expect(history.at(-1)?.day).toBe(TODAY);
    expect(history[1]?.day).toBe(addDays(TODAY, -189));
  });
});

describe("due forecast (J2)", () => {
  it("splits overdue, new and the next 14 home days", () => {
    const due = (due_at: string) => reviewed(DAY, { due_at });
    const vocab = [
      due("2026-10-01T18:59:59.000Z"),
      due(NOW.toISOString()),
      due("2026-10-01T19:00:01.000Z"),
      // 23:59:59 PDT on the 1st.
      due("2026-10-02T06:59:59.000Z"),
      due("2026-10-02T07:00:00.000Z"),
      due("2026-10-15T06:59:59.000Z"),
      due("2026-10-15T07:00:00.000Z"),
      item(),
      item(),
      item(),
    ];
    const f = dash(vocab).forecast;
    expect(f.overdue).toBe(2);
    expect(f.new).toBe(3);
    expect(f.days).toHaveLength(14);
    expect(f.days[0]).toEqual({ day: TODAY, count: 2 });
    expect(f.days[1]).toEqual({ day: "2026-10-02", count: 1 });
    expect(f.days[13]).toEqual({ day: "2026-10-14", count: 1 });
    expect(f.days.reduce((n, d) => n + d.count, 0)).toBe(4);
  });

  it("keeps home days whole across the autumn DST change", () => {
    // Saturday 2026-10-31, 12:00 PDT; clocks go back early on 1 November.
    const now = new Date("2026-10-31T19:00:00.000Z");
    const vocab = [
      reviewed(DAY, { due_at: "2026-11-02T07:59:59.000Z" }),
      reviewed(DAY, { due_at: "2026-11-02T08:00:00.000Z" }),
    ];
    const f = dash(vocab, [], now).forecast;
    expect(f.days.slice(0, 3)).toEqual([
      { day: "2026-10-31", count: 0 },
      { day: "2026-11-01", count: 1 },
      { day: "2026-11-02", count: 1 },
    ]);
  });
});

describe("recall rate (J3)", () => {
  const a = reviewed(DAY);
  const many = (n: number, overrides: Partial<DashEvent> = {}) =>
    Array.from({ length: n }, () => ev(a.id, overrides));

  it("counts scheduled, unsupported reviews in the last 30 days, any source", () => {
    const events = [
      ev(a.id, { reviewed_at: ago(30 * DAY_MS) }),
      ev(a.id, { reviewed_at: ago(30 * DAY_MS + 1) }),
      ev(a.id, { due_before: null }),
      ev(a.id, { prompt_support: "hint" }),
      ev(a.id, { prompt_support: "answer_exposed" }),
      ev(a.id, { grade: "wrong" }),
    ];
    expect(dash([a], events).recall.recognition).toEqual({ n: 2, recalled: 1 });
  });

  it("counts Hesitantly correct and better as recalled", () => {
    const events = ["wrong", "partial", "hesitant", "correct", "confident"].map((grade) =>
      ev(a.id, { grade: grade as DashEvent["grade"] }),
    );
    expect(dash([a], events).recall.recognition).toEqual({ n: 5, recalled: 3 });
  });

  it("splits recognition (ur_en) from production (en_ur and oral)", () => {
    const events = [
      ...many(2, { direction: "ur_en" }),
      ...many(3, { direction: "en_ur" }),
      ...many(4, { direction: "oral", grade: "partial" }),
    ];
    const r = dash([a], events).recall;
    expect(r.recognition).toEqual({ n: 2, recalled: 2 });
    expect(r.production).toEqual({ n: 7, recalled: 3 });
  });

  it("is insufficient below the minimum recognition sample", () => {
    expect(MIN_RECALL_SAMPLE).toBe(30);
    const events = [...many(29), ...many(40, { direction: "en_ur" })];
    expect(dash([a], events).recall.band).toBe("insufficient");
    expect(dash([], []).recall.band).toBe("insufficient");
  });

  it.each([
    [30, 0, "high"],
    [28, 2, "high"],
    [27, 3, "on_target"],
    [24, 6, "on_target"],
    [23, 7, "low"],
  ] as const)("%i recalled, %i missed is %s", (hits, misses, band) => {
    const events = [...many(hits), ...many(misses, { grade: "wrong" })];
    expect(dash([a], events).recall.band).toBe(band);
  });

  it("bands on recognition alone", () => {
    const events = [...many(30), ...many(30, { direction: "en_ur", grade: "wrong" })];
    expect(dash([a], events).recall.band).toBe("high");
  });
});

describe("trouble items (J4)", () => {
  const lapse = (vocab_id: string, daysAgo: number, overrides: Partial<DashEvent> = {}) =>
    ev(vocab_id, { grade: "wrong", reviewed_at: ago(daysAgo * DAY_MS), ...overrides });

  it("needs two lapses in 30 days, any direction or prompt support", () => {
    const [a, b, c, d] = [reviewed(DAY), reviewed(DAY), reviewed(DAY), reviewed(DAY)] as const;
    const events = [
      lapse(a.id, 1),
      lapse(a.id, 2, { grade: "partial", direction: "oral", prompt_support: "hint" }),
      lapse(b.id, 1),
      ev(b.id, { grade: "hesitant" }),
      lapse(c.id, 1),
      lapse(c.id, 31),
      lapse(d.id, 1, { due_before: null }),
      lapse(d.id, 3, { direction: "en_ur" }),
      lapse("deleted", 1),
      lapse("deleted", 2),
    ];
    // The 30-day edge: a lapse exactly 30 days ago counts, a millisecond earlier does not.
    const [e, f] = [reviewed(DAY), reviewed(DAY)] as const;
    events.push(lapse(e.id, 1), lapse(e.id, 0, { reviewed_at: ago(30 * DAY_MS) }));
    events.push(lapse(f.id, 1), lapse(f.id, 0, { reviewed_at: ago(30 * DAY_MS + 1) }));
    const t = dash([a, b, c, d, e, f], events).trouble;
    expect(t.map((r) => r.id).sort()).toEqual([a.id, d.id, e.id].sort());
    expect(t.find((r) => r.id === a.id)).toEqual({
      id: a.id,
      urdu: a.urdu,
      english: a.english,
      lapses: 2,
      band: 1,
    });
  });

  it("orders by lapses, then latest lapse, then Urdu, and caps the list", () => {
    expect(TROUBLE_LIMIT).toBe(8);
    const three = reviewed(DAY, { urdu: "ج" });
    const recent = reviewed(DAY, { urdu: "ب" });
    const older = reviewed(DAY, { urdu: "ا" });
    // Ties sort by code point: د (U+062F) before پ (U+067E).
    const tieA = reviewed(DAY, { urdu: "د" });
    const tieB = reviewed(DAY, { urdu: "پ" });
    const filler = Array.from({ length: 6 }, (_, i) => reviewed(DAY, { urdu: `ز${i}` }));
    const events = [
      lapse(three.id, 5),
      lapse(three.id, 6),
      lapse(three.id, 7),
      lapse(recent.id, 1),
      lapse(recent.id, 9),
      lapse(older.id, 2),
      lapse(older.id, 9),
      lapse(tieB.id, 3),
      lapse(tieB.id, 9),
      lapse(tieA.id, 3),
      lapse(tieA.id, 9),
      ...filler.flatMap((f) => [lapse(f.id, 20), lapse(f.id, 21)]),
    ];
    const t = dash([three, recent, older, tieB, tieA, ...filler], events).trouble;
    expect(t).toHaveLength(8);
    expect(t.slice(0, 5).map((r) => r.urdu)).toEqual(["ج", "ب", "ا", "د", "پ"]);
  });
});

describe("learning backlog (J5)", () => {
  it("counts items in New, Learning and Basic now", () => {
    const vocab = [item(), reviewed(DAY), reviewed(7 * DAY), reviewed(7 * DAY + 1)];
    expect(dash(vocab).backlog.now).toBe(3);
  });

  it("buckets additions by Monday-start home weeks over the last 8 weeks", () => {
    const vocab = [
      item({ added_at: noon("2026-09-28") }),
      item({ added_at: noon("2026-10-01") }),
      // Sunday 23:59 PDT: the week before.
      item({ added_at: "2026-09-28T06:59:00.000Z" }),
      item({ added_at: noon("2026-08-10") }),
      item({ added_at: noon("2026-08-09") }),
    ];
    const weeks = dash(vocab).backlog.weeks;
    expect(weeks.map((w) => w.week)).toEqual([
      "2026-08-10",
      "2026-08-17",
      "2026-08-24",
      "2026-08-31",
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
    ]);
    expect(weeks.map((w) => w.added)).toEqual([1, 0, 0, 0, 0, 0, 1, 2]);
  });

  it("counts distinct items whose interval crossed 14 days in the week", () => {
    const [a, b, c] = [reviewed(20 * DAY), reviewed(20 * DAY), reviewed(20 * DAY)] as const;
    const cross = (vocab_id: string, date: string, before: number, after: number) =>
      ev(vocab_id, { reviewed_at: noon(date), interval_before: before, interval_after: after });
    const d = reviewed(20 * DAY);
    const events = [
      // Twice in one week: counted once.
      cross(a.id, "2026-09-29", 10 * DAY, 15 * DAY),
      cross(a.id, "2026-09-30", 10 * DAY, 15 * DAY),
      // Already Known.
      cross(b.id, "2026-09-30", 14 * DAY, 20 * DAY),
      // Lands on exactly 14 days.
      cross(c.id, "2026-09-22", 13 * DAY, KNOWN_MIN_SECONDS),
      cross(c.id, "2026-08-01", 13 * DAY, 15 * DAY),
      // Stops a second short.
      cross(d.id, "2026-09-23", 13 * DAY, KNOWN_MIN_SECONDS - 1),
    ];
    const weeks = dash([a, b, c, d], events).backlog.weeks;
    expect(weeks.map((w) => w.known)).toEqual([0, 0, 0, 0, 0, 0, 1, 1]);
  });
});

describe("review calendar (J6)", () => {
  it.each([
    [0, 0],
    [1, 1],
    [9, 1],
    [10, 2],
    [19, 2],
    [20, 3],
    [39, 3],
    [40, 4],
    [400, 4],
  ])("%i reviews shade at level %i", (count, level) => {
    expect(calendarLevel(count)).toBe(level);
  });

  it("covers the 84 home days ending today, counting every review event", () => {
    const a = reviewed(DAY);
    const start = addDays(TODAY, -83);
    const events = [
      ev(a.id, { reviewed_at: noon(start) }),
      ev(a.id, { reviewed_at: noon(addDays(start, -1)) }),
      ev(a.id, { reviewed_at: noon(TODAY), prompt_support: "hint" }),
      ev(a.id, { reviewed_at: "2026-10-01T07:00:00.000Z", due_before: null }),
      // 23:59 PDT on the 30th.
      ev(a.id, { reviewed_at: "2026-10-01T06:59:00.000Z" }),
    ];
    const cal = dash([a], events).calendar;
    expect(cal).toHaveLength(84);
    expect(cal[0]).toEqual({ day: start, count: 1, level: 1 });
    expect(cal[82]).toEqual({ day: "2026-09-30", count: 1, level: 1 });
    expect(cal[83]).toEqual({ day: TODAY, count: 2, level: 1 });
  });
});

describe("empty vault", () => {
  it("builds every block without errors", () => {
    const d = dash([], []);
    expect(d.today).toBe(TODAY);
    expect(d.known).toEqual({ count: 0, history: [{ day: TODAY, bands: [0, 0, 0, 0, 0, 0, 0] }] });
    expect(d.forecast.overdue + d.forecast.new).toBe(0);
    expect(d.forecast.days).toHaveLength(14);
    expect(d.recall).toEqual({
      recognition: { n: 0, recalled: 0 },
      production: { n: 0, recalled: 0 },
      band: "insufficient",
    });
    expect(d.trouble).toEqual([]);
    expect(d.backlog.now).toBe(0);
    expect(d.backlog.weeks).toHaveLength(8);
    expect(d.calendar).toHaveLength(84);
    expect(d.calendar.every((c) => c.count === 0)).toBe(true);
  });
});
