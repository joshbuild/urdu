import { describe, expect, it } from "vitest";
import { ladder } from "../../shared/ladders";
import { spacingSummary } from "./spacing";

describe("spacingSummary", () => {
  it("shows the multiplier, the first rungs and the cap", () => {
    expect(spacingSummary(ladder(3))).toBe("×2.38 · 3 h, 7 h, 17 h, 2 d, 4 d … 10 y");
    expect(spacingSummary(ladder(6))).toBe("×4.00 · 3 h, 12 h, 2 d, 8 d, 5 wk … 10 y");
  });
});
