import { describe, expect, it } from "vitest";
import type { BandPoint, CalendarDay } from "../../shared/dash";
import { calendarWeeks, percent, recallHint, shortDate, stackedAreas, weekLabel } from "./view";

describe("recallHint", () => {
  it("words each band, with the ladder ends", () => {
    expect(recallHint("high", 8)).toBe("Recall is high: a wider ladder would mean fewer reviews");
    expect(recallHint("high", 11)).toBe("Recall is high, on the widest ladder");
    expect(recallHint("on_target", 7)).toBe("On target");
    expect(recallHint("low", 8)).toBe("Recall is low: try a denser ladder or add fewer new words");
    expect(recallHint("low", 7)).toBe("Recall is low: add fewer new words for a while");
    expect(recallHint("insufficient", 8)).toBeNull();
  });
});

describe("percent", () => {
  it("is a whole percentage, or null with no reviews", () => {
    expect(percent({ n: 3, recalled: 2 })).toBe(67);
    expect(percent({ n: 30, recalled: 27 })).toBe(90);
    expect(percent({ n: 0, recalled: 0 })).toBeNull();
  });
});

describe("shortDate", () => {
  it("is day and month, independent of locale", () => {
    expect(shortDate("2026-08-10")).toBe("10 Aug");
    expect(shortDate("2026-12-01")).toBe("1 Dec");
  });
});

describe("calendarWeeks", () => {
  const days = (start: string, n: number): CalendarDay[] =>
    Array.from({ length: n }, (_, i) => {
      const d = new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000);
      return { day: d.toISOString().slice(0, 10), count: 0, level: 0 };
    });

  it("puts each day in a Monday-start week, padding before the first and after today", () => {
    // 2026-07-10 is a Friday; 84 days later ends Thursday 2026-10-01.
    const weeks = calendarWeeks(days("2026-07-10", 84));
    expect(weeks).toHaveLength(13);
    expect(weeks.every((c) => c.length === 7)).toBe(true);
    expect(weeks[0]?.slice(0, 4)).toEqual([null, null, null, null]);
    expect(weeks[0]?.[4]?.day).toBe("2026-07-10");
    expect(weeks[12]?.[3]?.day).toBe("2026-10-01");
    expect(weeks[12]?.slice(4)).toEqual([null, null, null]);
  });

  it("is exactly 12 weeks when today is a Sunday", () => {
    const weeks = calendarWeeks(days("2026-07-13", 84));
    expect(weeks).toHaveLength(12);
    expect(weeks.flat().every((c) => c !== null)).toBe(true);
  });

  it("heads each week with its Monday, padding included", () => {
    const weeks = calendarWeeks(days("2026-07-10", 84));
    expect(weekLabel(weeks[0] ?? [])).toBe("Jul 6");
    expect(weekLabel(weeks[12] ?? [])).toBe("Sep 28");
  });
});

describe("stackedAreas", () => {
  const history: BandPoint[] = [
    { day: "2026-09-29", bands: [2, 0, 0, 0, 0, 0, 0] },
    { day: "2026-09-30", bands: [1, 1, 0, 0, 0, 0, 0] },
    { day: "2026-10-01", bands: [0, 1, 0, 1, 0, 0, 0] },
  ];

  it("stacks the most-known band at the bottom, scaled to the largest total", () => {
    const areas = stackedAreas(history, 100, 50);
    expect(areas.map((a) => a.band)).toEqual([6, 5, 4, 3, 2, 1, 0]);
    // Firm (band 3) is 0, 0, then 1 of 2 at the bottom.
    expect(areas.find((a) => a.band === 3)?.d).toBe("M0,50 L50,50 L100,25 L100,50 L50,50 L0,50 Z");
    // New sits on top of everything else.
    expect(areas.find((a) => a.band === 0)?.d).toBe("M0,0 L50,0 L100,0 L100,0 L50,25 L0,50 Z");
  });

  it("draws nothing for an empty history or an empty vault", () => {
    expect(stackedAreas([], 100, 50)).toEqual([]);
    expect(stackedAreas([{ day: "2026-10-01", bands: [0, 0, 0, 0, 0, 0, 0] }], 100, 50)).toEqual(
      [],
    );
  });
});
