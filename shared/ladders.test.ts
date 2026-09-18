import { describe, expect, it } from "vitest";
import {
  addSeconds,
  correctStep,
  DEFAULT_LADDER_ID,
  formatInterval,
  generateIntervals,
  isSelectableLadderId,
  LADDERS,
  LEGACY_LADDER_ID,
  ladder,
  MAX_INTERVAL_SECONDS,
  maxStep,
  nearestStep,
  scheduleReview,
} from "./ladders";

const DAY = 86_400;
const AT = "2026-09-18T20:00:00.000Z";
const moderate = ladder(3);

describe("ladder versions", () => {
  it("have unique ids, with Moderate as the default", () => {
    expect(new Set(LADDERS.map((l) => l.id)).size).toBe(LADDERS.length);
    expect(ladder(DEFAULT_LADDER_ID).name).toBe("Moderate");
  });

  it("keep the legacy ×5 ladder as rung = old mastery level", () => {
    expect(ladder(LEGACY_LADDER_ID).intervals_seconds).toEqual(
      [0, 1, 5, 25, 125, 625, 3125].map((d) => d * DAY),
    );
    expect(isSelectableLadderId(LEGACY_LADDER_ID)).toBe(false);
  });

  // The literals are the source of truth; this proves they are what the documented rule gives.
  for (const l of LADDERS.filter((x) => x.exponent_quarters !== null)) {
    it(`${l.name} matches the generator for 2^(${l.exponent_quarters}/4)`, () => {
      expect(l.intervals_seconds).toEqual(generateIntervals(l.exponent_quarters as number));
      expect(isSelectableLadderId(l.id)).toBe(true);
    });

    it(`${l.name} starts at 3 h, rises strictly, and ends at the cap exactly once`, () => {
      const xs = l.intervals_seconds;
      expect(xs[0]).toBe(10800);
      expect(xs.at(-1)).toBe(MAX_INTERVAL_SECONDS);
      for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1] as number);
    });
  }

  it("Moderate follows the research report's rungs", () => {
    const hours = [3, 7.1, 17];
    const days = [1.7, 4.0, 9.5, 22.6, 53.8, 128, 304, 724, 1722];
    const expected = [...hours.map((h) => h * 3600), ...days.map((d) => d * DAY)];
    moderate.intervals_seconds.slice(0, -1).forEach((s, i) => {
      expect(Math.abs(s / (expected[i] as number) - 1)).toBeLessThan(0.02);
    });
  });

  it("rejects unknown ids", () => {
    expect(() => ladder(99)).toThrow(RangeError);
    expect(isSelectableLadderId(99)).toBe(false);
    expect(isSelectableLadderId("3")).toBe(false);
  });
});

describe("nearestStep", () => {
  it("matches multiplicatively and maps zero to the first rung", () => {
    expect(nearestStep(moderate, 0)).toBe(0);
    expect(nearestStep(moderate, 1 * DAY)).toBe(2); // 17 h beats 1.7 d (×1.41 vs ×1.68)
    expect(nearestStep(moderate, 5 * DAY)).toBe(4); // 4 d
    expect(nearestStep(moderate, 25 * DAY)).toBe(6); // 22.6 d
    expect(nearestStep(moderate, 3125 * DAY)).toBe(12); // the cap
  });

  it("breaks a tie toward the shorter rung", () => {
    const dense = ladder(2);
    // Geometric midpoint of 3 h and 6 h.
    expect(nearestStep(dense, Math.sqrt(10800 * 21600))).toBe(0);
  });
});

describe("scheduleReview", () => {
  const onModerate = (step: number) => ({
    ladder_id: 3,
    ladder_step: step,
    interval_seconds: moderate.intervals_seconds[step] as number,
  });

  it("moves along the active ladder and sets due from the review time", () => {
    const r = scheduleReview(onModerate(0), "correct", "ur_en", 3, AT);
    expect(r).toMatchObject({ ladder_id: 3, ladder_step: 1, applied_delta: 1, base_step: 0 });
    expect(r.interval_seconds).toBe(25687);
    expect(r.last_reviewed_at).toBe(AT);
    expect(r.due_at).toBe(addSeconds(AT, 25687));
  });

  it("uses the direction's deltas", () => {
    expect(scheduleReview(onModerate(5), "wrong", "ur_en", 3, AT).ladder_step).toBe(3);
    expect(scheduleReview(onModerate(5), "wrong", "en_ur", 3, AT).ladder_step).toBe(4);
    expect(scheduleReview(onModerate(5), "partial", "oral", 3, AT).ladder_step).toBe(5);
    expect(scheduleReview(onModerate(5), "confident", "en_ur", 3, AT).ladder_step).toBe(7);
  });

  it("clamps at both ends but records the unclamped delta", () => {
    const low = scheduleReview(onModerate(0), "wrong", "ur_en", 3, AT);
    expect(low).toMatchObject({ ladder_step: 0, applied_delta: -2 });
    const top = scheduleReview(onModerate(12), "confident", "ur_en", 3, AT);
    expect(top).toMatchObject({ ladder_step: 12, interval_seconds: MAX_INTERVAL_SECONDS });
  });

  it("moves an item from another ladder onto the active one at its nearest rung", () => {
    const legacy = { ladder_id: 1, ladder_step: 3, interval_seconds: 25 * DAY };
    const r = scheduleReview(legacy, "correct", "ur_en", 3, AT);
    expect(r).toMatchObject({ ladder_id: 3, base_step: 6, ladder_step: 7 });
  });

  it("starts a legacy New item from the first rung", () => {
    const legacyNew = { ladder_id: 1, ladder_step: 0, interval_seconds: 0 };
    expect(scheduleReview(legacyNew, "hesitant", "ur_en", 3, AT)).toMatchObject({
      base_step: 0,
      ladder_step: 0,
      interval_seconds: 10800,
    });
  });
});

describe("correctStep", () => {
  it("puts the item on the active ladder with due from its last review", () => {
    expect(correctStep(2, 3, AT)).toEqual({
      ladder_id: 3,
      ladder_step: 2,
      interval_seconds: 61094,
      due_at: addSeconds(AT, 61094),
    });
    expect(correctStep(2, 3, null).due_at).toBeNull();
  });

  it("rejects a rung the ladder does not have", () => {
    expect(() => correctStep(maxStep(moderate) + 1, 3, AT)).toThrow(RangeError);
  });
});

describe("formatInterval", () => {
  it("rounds to one friendly unit", () => {
    expect(moderate.intervals_seconds.map(formatInterval)).toEqual([
      "3 h",
      "7 h",
      "17 h",
      "2 d",
      "4 d",
      "10 d",
      "3 wk",
      "2 mo",
      "4 mo",
      "10 mo",
      "2 y",
      "4.7 y",
      "10 y",
    ]);
    expect(formatInterval(0)).toBe("now");
    expect(formatInterval(60)).toBe("1 h");
  });
});
