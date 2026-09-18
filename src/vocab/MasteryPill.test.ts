import { describe, expect, it } from "vitest";
import { masteryPillLabel } from "./MasteryPill";

describe("masteryPillLabel", () => {
  it("prefixes the level number to its name", () => {
    expect(masteryPillLabel(0)).toBe("0 • New");
    expect(masteryPillLabel(6)).toBe("6 • Permanent");
  });
});
