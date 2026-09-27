import { describe, expect, it } from "vitest";
import {
  addSeconds,
  correctStep,
  DEFAULT_LADDER_ID,
  entryStep,
  formatInterval,
  generateIntervals,
  isSelectableLadderId,
  LADDERS,
  LEGACY_LADDER_ID,
  ladder,
  MAX_INTERVAL_SECONDS,
  maxStep,
  multiplier,
  nearestStep,
  scheduleReview,
} from "./ladders";

const HOUR = 3600;
const DAY = 86_400;
const AT = "2026-09-18T20:00:00.000Z";
const dense = ladder(8);

// f09's rule for its retired ids 2-6: 10800 × 2^(q·i/4) from i = 0, capped once.
function f09Intervals(q: number): number[] {
  const out: number[] = [];
  for (let i = 0; ; i++) {
    const candidate = Math.round(10800 * multiplier(q * i));
    if (candidate >= MAX_INTERVAL_SECONDS) return [...out, MAX_INTERVAL_SECONDS];
    out.push(candidate);
  }
}

const retired = LADDERS.filter((l) => l.id >= 2 && l.id <= 6);
const current = LADDERS.filter((l) => l.selectable);

describe("ladder versions", () => {
  it("have unique ids and names, with Dense as the default", () => {
    expect(new Set(LADDERS.map((l) => l.id)).size).toBe(LADDERS.length);
    expect(new Set(LADDERS.map((l) => l.name)).size).toBe(LADDERS.length);
    expect(ladder(DEFAULT_LADDER_ID).name).toBe("Dense");
    expect(isSelectableLadderId(DEFAULT_LADDER_ID)).toBe(true);
  });

  it("offer five presets, densest first", () => {
    expect(current.map((l) => [l.id, l.name, l.exponent_quarters])).toEqual([
      [7, "Very dense", 4],
      [8, "Dense", 5],
      [9, "Balanced", 6],
      [10, "Wide", 7],
      [11, "Very wide", 8],
    ]);
  });

  it("keep the legacy ×5 ladder as rung = old mastery level", () => {
    expect(ladder(LEGACY_LADDER_ID).intervals_seconds).toEqual(
      [0, 1, 5, 25, 125, 625, 3125].map((d) => d * DAY),
    );
    expect(isSelectableLadderId(LEGACY_LADDER_ID)).toBe(false);
  });

  // Retired versions are never edited: they still hold exactly what f09 generated.
  for (const l of retired) {
    it(`${l.name} keeps f09's 3 h ladder and is no longer offered`, () => {
      expect(l.intervals_seconds).toEqual(f09Intervals(l.exponent_quarters as number));
      expect(l.name).toMatch(/ v1$/);
      expect(isSelectableLadderId(l.id)).toBe(false);
    });
  }

  // The literals are the source of truth; this proves they are what the documented rule gives.
  for (const l of current) {
    it(`${l.name} matches the generator for 2^(${l.exponent_quarters}/4)`, () => {
      expect(l.intervals_seconds).toEqual(generateIntervals(l.exponent_quarters as number));
    });

    it(`${l.name} has a one-day rung, a floor of at least 1 h, and the cap exactly once`, () => {
      const xs = l.intervals_seconds;
      expect(xs).toContain(DAY);
      expect(xs[0]).toBeGreaterThanOrEqual(HOUR);
      // The floor is the lowest rung: one more step down would be under an hour.
      expect((xs[0] as number) / multiplier(l.exponent_quarters as number)).toBeLessThan(HOUR);
      expect(xs.at(-1)).toBe(MAX_INTERVAL_SECONDS);
      expect(xs.filter((x) => x === MAX_INTERVAL_SECONDS)).toHaveLength(1);
      for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1] as number);
    });
  }

  it("rejects unknown ids", () => {
    expect(() => ladder(99)).toThrow(RangeError);
    expect(isSelectableLadderId(99)).toBe(false);
    expect(isSelectableLadderId("8")).toBe(false);
  });
});

describe("entryStep", () => {
  it("is the rung below one day", () => {
    expect(current.map((l) => entryStep(l))).toEqual([3, 2, 2, 1, 1]);
    for (const l of current) expect(l.intervals_seconds[entryStep(l) + 1]).toBe(DAY);
  });
});

describe("nearestStep", () => {
  it("matches multiplicatively and maps zero to the first rung", () => {
    expect(nearestStep(dense, 0)).toBe(0);
    expect(nearestStep(dense, 3 * HOUR)).toBe(1); // 4.2 h beats 1.8 h (×1.41 vs ×1.68)
    expect(nearestStep(dense, 1 * DAY)).toBe(3);
    expect(nearestStep(dense, 5 * DAY)).toBe(5); // 5.7 d
    expect(nearestStep(dense, 25 * DAY)).toBe(7); // 32 d
    expect(nearestStep(dense, 3125 * DAY)).toBe(13); // the cap
  });

  it("breaks a tie toward the shorter rung", () => {
    // Geometric midpoint of Very dense's 3 h and 6 h.
    expect(nearestStep(ladder(7), Math.sqrt(10800 * 21600))).toBe(1);
  });
});

describe("scheduleReview", () => {
  const onDense = (step: number) => ({
    ladder_id: 8,
    ladder_step: step,
    interval_seconds: dense.intervals_seconds[step] as number,
  });

  it("moves along the active ladder and sets due from the review time", () => {
    const r = scheduleReview(onDense(2), "correct", "ur_en", 8, AT);
    expect(r).toMatchObject({ ladder_id: 8, ladder_step: 3, applied_delta: 1, base_step: 2 });
    expect(r.interval_seconds).toBe(DAY);
    expect(r.last_reviewed_at).toBe(AT);
    expect(r.due_at).toBe(addSeconds(AT, DAY));
  });

  // A new item sits on the entry rung, so its first grade lands around a day (f12).
  it("lands a new item's first Correct on the day rung", () => {
    const fresh = onDense(entryStep(dense));
    const land = (direction: "ur_en" | "en_ur") =>
      (["wrong", "partial", "hesitant", "correct", "confident"] as const).map((g) =>
        formatInterval(scheduleReview(fresh, g, direction, 8, AT).interval_seconds),
      );
    expect(land("ur_en")).toEqual(["2 h", "4 h", "10 h", "1 d", "2 d"]);
    expect(land("en_ur")).toEqual(["4 h", "10 h", "10 h", "1 d", "2 d"]);
  });

  it("uses the direction's deltas", () => {
    expect(scheduleReview(onDense(5), "wrong", "ur_en", 8, AT).ladder_step).toBe(3);
    expect(scheduleReview(onDense(5), "wrong", "en_ur", 8, AT).ladder_step).toBe(4);
    expect(scheduleReview(onDense(5), "partial", "oral", 8, AT).ladder_step).toBe(5);
    expect(scheduleReview(onDense(5), "confident", "en_ur", 8, AT).ladder_step).toBe(7);
  });

  it("clamps at both ends but records the unclamped delta", () => {
    const low = scheduleReview(onDense(0), "wrong", "ur_en", 8, AT);
    expect(low).toMatchObject({ ladder_step: 0, applied_delta: -2 });
    const top = scheduleReview(onDense(13), "confident", "ur_en", 8, AT);
    expect(top).toMatchObject({ ladder_step: 13, interval_seconds: MAX_INTERVAL_SECONDS });
  });

  it("moves an item from another ladder onto the active one at its nearest rung", () => {
    const legacy = { ladder_id: 1, ladder_step: 3, interval_seconds: 25 * DAY };
    const r = scheduleReview(legacy, "correct", "ur_en", 8, AT);
    expect(r).toMatchObject({ ladder_id: 8, base_step: 7, ladder_step: 8 });
  });

  it("moves an item off a retired f09 ladder at its next review", () => {
    // Moderate v1's 17 h rung is nearest Dense's 1 d (×1.41 against 10 h's ×1.68).
    const onModerateV1 = { ladder_id: 3, ladder_step: 2, interval_seconds: 61094 };
    const r = scheduleReview(onModerateV1, "correct", "ur_en", 8, AT);
    expect(r).toMatchObject({ ladder_id: 8, base_step: 3, ladder_step: 4 });
  });

  it("starts a legacy New item from the first rung", () => {
    const legacyNew = { ladder_id: 1, ladder_step: 0, interval_seconds: 0 };
    expect(scheduleReview(legacyNew, "hesitant", "ur_en", 8, AT)).toMatchObject({
      base_step: 0,
      ladder_step: 0,
      interval_seconds: 6422,
    });
  });
});

describe("correctStep", () => {
  it("puts the item on the active ladder with due from its last review", () => {
    expect(correctStep(2, 8, AT)).toEqual({
      ladder_id: 8,
      ladder_step: 2,
      interval_seconds: 36327,
      due_at: addSeconds(AT, 36327),
    });
    expect(correctStep(2, 8, null).due_at).toBeNull();
  });

  it("rejects a rung the ladder does not have", () => {
    expect(() => correctStep(maxStep(dense) + 1, 8, AT)).toThrow(RangeError);
  });
});

describe("formatInterval", () => {
  it("rounds to one whole unit", () => {
    expect(dense.intervals_seconds.map(formatInterval)).toEqual([
      "2 h",
      "4 h",
      "10 h",
      "1 d",
      "2 d",
      "6 d",
      "13 d",
      "5 wk",
      "3 mo",
      "6 mo",
      "14 mo",
      "3 y",
      "7 y",
      "10 y",
    ]);
    expect(formatInterval(0)).toBe("now");
    expect(formatInterval(60)).toBe("1 h");
  });

  it("never shows a decimal on any ladder", () => {
    for (const l of LADDERS) {
      for (const s of l.intervals_seconds) expect(formatInterval(s)).not.toContain(".");
    }
  });

  it("reads a span just under a day as 1 d, not 24 h", () => {
    expect(formatInterval(DAY - 20 * 60)).toBe("1 d");
    expect(formatInterval(23 * HOUR)).toBe("23 h");
  });
});
