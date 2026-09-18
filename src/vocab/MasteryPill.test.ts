import { describe, expect, it } from "vitest";
import { masteryPillLabel } from "./MasteryPill";

describe("masteryPillLabel", () => {
  it("names the band and the scheduled interval", () => {
    const reviewed = "2026-09-18T08:00:00.000Z";
    expect(masteryPillLabel({ interval_seconds: 25687, last_reviewed_at: reviewed })).toBe(
      "Learning • 7 h",
    );
    expect(masteryPillLabel({ interval_seconds: 25 * 86_400, last_reviewed_at: reviewed })).toBe(
      "Firm • 4 wk",
    );
  });

  it("says only New for a never-reviewed item", () => {
    expect(masteryPillLabel({ interval_seconds: 10800, last_reviewed_at: null })).toBe("New");
  });
});
