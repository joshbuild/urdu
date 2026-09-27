import { describe, expect, it } from "vitest";
import { LADDERS, ladder } from "../../shared/ladders";
import { spacingRows } from "./spacing";

describe("spacingRows", () => {
  it("groups every rung into one row per unit", () => {
    expect(spacingRows(ladder(8))).toEqual([
      { unit: "hours", values: [2, 4, 10] },
      { unit: "days", values: [1, 2, 6, 13] },
      { unit: "weeks", values: [5, 11, 26] },
      { unit: "months", values: [14] },
      { unit: "years", values: [3, 7, 10] },
    ]);
    expect(spacingRows(ladder(11))).toEqual([
      { unit: "hours", values: [2, 6] },
      { unit: "days", values: [1, 4, 16] },
      { unit: "weeks", values: [9] },
      { unit: "months", values: [8] },
      { unit: "years", values: [3, 10] },
    ]);
  });

  it("starts every offered ladder's days row on 1", () => {
    for (const l of LADDERS.filter((x) => x.selectable)) {
      expect(spacingRows(l).find((r) => r.unit === "days")?.values[0]).toBe(1);
    }
  });
});
