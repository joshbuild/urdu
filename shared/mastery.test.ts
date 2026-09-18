import { describe, expect, it } from "vitest";
import {
  applyGrade,
  GRADE_DELTAS,
  GRADES,
  type Grade,
  gradeDeltas,
  intervalDays,
  isGrade,
  isMastery,
  MASTERY_LEVELS,
  type Mastery,
  masteryName,
  PRODUCTION_GRADE_DELTAS,
} from "./mastery";

describe("mastery ladder", () => {
  it.each([
    [0, "New", 0],
    [1, "Learning", 1],
    [2, "Basic", 5],
    [3, "Firm", 25],
    [4, "Strong", 125],
    [5, "Stable", 625],
    [6, "Permanent", 3125],
  ] as const)("level %i is %s with a %i-day interval", (level, name, days) => {
    expect(masteryName(level)).toBe(name);
    expect(intervalDays(level)).toBe(days);
  });

  it("has exactly seven levels indexed by level", () => {
    expect(MASTERY_LEVELS.map((l) => l.level)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("guards mastery values", () => {
    for (const ok of [0, 3, 6]) expect(isMastery(ok)).toBe(true);
    for (const bad of [-1, 7, 2.5, Number.NaN, "3", null, undefined]) {
      expect(isMastery(bad)).toBe(false);
    }
  });
});

describe("grades", () => {
  it("are in ladder order with deltas -2..+2", () => {
    expect(GRADES).toEqual(["wrong", "partial", "hesitant", "correct", "confident"]);
    expect(GRADES.map((g) => GRADE_DELTAS[g])).toEqual([-2, -1, 0, 1, 2]);
  });

  it("guards grade values", () => {
    expect(isGrade("confident")).toBe(true);
    for (const bad of ["Correct", "right", "", 1, null]) expect(isGrade(bad)).toBe(false);
  });
});

describe("production deltas", () => {
  it("soften misses and keep gains: -1, 0, 0, +1, +2", () => {
    expect(GRADES.map((g) => PRODUCTION_GRADE_DELTAS[g])).toEqual([-1, 0, 0, 1, 2]);
  });

  it("apply to English → Urdu and oral; recognition keeps the original ladder", () => {
    expect(gradeDeltas("ur_en")).toBe(GRADE_DELTAS);
    expect(gradeDeltas("en_ur")).toBe(PRODUCTION_GRADE_DELTAS);
    expect(gradeDeltas("oral")).toBe(PRODUCTION_GRADE_DELTAS);
  });

  it("clamp at the ladder ends", () => {
    expect(applyGrade(0, "wrong", "en_ur")).toBe(0);
    expect(applyGrade(3, "wrong", "en_ur")).toBe(2);
    expect(applyGrade(3, "partial", "en_ur")).toBe(3);
    expect(applyGrade(6, "confident", "oral")).toBe(6);
  });
});

describe("applyGrade (recognition)", () => {
  // Result for mastery 0..6, clamped to the ladder.
  const expected: Record<Grade, Mastery[]> = {
    wrong: [0, 0, 0, 1, 2, 3, 4],
    partial: [0, 0, 1, 2, 3, 4, 5],
    hesitant: [0, 1, 2, 3, 4, 5, 6],
    correct: [1, 2, 3, 4, 5, 6, 6],
    confident: [2, 3, 4, 5, 6, 6, 6],
  };

  for (const grade of GRADES) {
    it(`applies ${grade} at every level`, () => {
      const levels = MASTERY_LEVELS.map((l) => l.level);
      expect(levels.map((m) => applyGrade(m, grade, "ur_en"))).toEqual(expected[grade]);
    });
  }
});
