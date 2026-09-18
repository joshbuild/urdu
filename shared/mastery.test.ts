import { describe, expect, it } from "vitest";
import {
  bandName,
  GRADE_DELTAS,
  GRADES,
  gradeDeltas,
  isGrade,
  isLegacyLevel,
  masteryBand,
  PRODUCTION_GRADE_DELTAS,
} from "./mastery";

const DAY = 86_400;

describe("grades", () => {
  it("are in ladder order with recognition deltas -2..+2", () => {
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

  it("apply to English → Urdu and oral; recognition keeps the original deltas", () => {
    expect(gradeDeltas("ur_en")).toBe(GRADE_DELTAS);
    expect(gradeDeltas("en_ur")).toBe(PRODUCTION_GRADE_DELTAS);
    expect(gradeDeltas("oral")).toBe(PRODUCTION_GRADE_DELTAS);
  });
});

describe("legacy levels", () => {
  it("accept the Airtable range 0-6 only", () => {
    for (const ok of [0, 3, 6]) expect(isLegacyLevel(ok)).toBe(true);
    for (const bad of [-1, 7, 2.5, Number.NaN, "3", null, undefined]) {
      expect(isLegacyLevel(bad)).toBe(false);
    }
  });
});

describe("mastery bands", () => {
  const reviewed = "2026-09-18T08:00:00.000Z";

  it("call a never-reviewed item New whatever its interval", () => {
    expect(masteryBand({ interval_seconds: 10800, last_reviewed_at: null })).toBe(0);
  });

  it("give every legacy level its old name", () => {
    const names = [0, 1, 5, 25, 125, 625, 3125].map((days) =>
      bandName(masteryBand({ interval_seconds: days * DAY, last_reviewed_at: reviewed })),
    );
    expect(names).toEqual(["New", "Learning", "Basic", "Firm", "Strong", "Stable", "Permanent"]);
  });

  it("band the Moderate ladder's rungs", () => {
    const rungs = [10800, 25687, 61094, 145307, 345600, 821980, 1955009, 4649821, 11059200];
    expect(
      rungs.map((s) => masteryBand({ interval_seconds: s, last_reviewed_at: reviewed })),
    ).toEqual([1, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});
