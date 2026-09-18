import { describe, expect, it } from "vitest";
import { ladder } from "../../shared/ladders";
import { spacingMultiplier, spacingRows } from "./spacing";

describe("spacingMultiplier", () => {
  it("shows the multiplier to two places, none for the legacy ladder", () => {
    expect(spacingMultiplier(ladder(2))).toBe("×2.00");
    expect(spacingMultiplier(ladder(3))).toBe("×2.38");
    expect(spacingMultiplier(ladder(1))).toBeNull();
  });
});

describe("spacingRows", () => {
  it("groups every rung into one row per unit", () => {
    expect(spacingRows(ladder(2))).toEqual([
      { unit: "hours", values: [3, 6, 12] },
      { unit: "days", values: [1, 2, 4, 8, 16] },
      { unit: "weeks", values: [5, 9, 18] },
      { unit: "months", values: [8, 17] },
      { unit: "years", values: [3, 6, 10] },
    ]);
    expect(spacingRows(ladder(6))).toEqual([
      { unit: "hours", values: [3, 12] },
      { unit: "days", values: [2, 8] },
      { unit: "weeks", values: [5, 18] },
      { unit: "months", values: [17] },
      { unit: "years", values: [6, 10] },
    ]);
  });
});
