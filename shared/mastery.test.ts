import { describe, expect, it } from "vitest";
import {
  applyGrade,
  GRADE_DELTAS,
  GRADES,
  type Grade,
  intervalDays,
  isGrade,
  isMastery,
  MASTERY_LEVELS,
  type Mastery,
  masteryName,
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

describe("applyGrade", () => {
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
      expect(levels.map((m) => applyGrade(m, grade))).toEqual(expected[grade]);
    });
  }
});
