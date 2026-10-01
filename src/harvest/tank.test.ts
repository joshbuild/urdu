import { describe, expect, it } from "vitest";
import { tank, tankLabel } from "./tank";

describe("tank", () => {
  it("is empty with nothing queued", () => {
    expect(tank(0, 10)).toEqual({ queued: 0, batchSize: 10, days: 0, level: "empty", fill: 0 });
    expect(tankLabel(tank(0, 10))).toBe("Empty: time to harvest");
  });

  it("is low below three full days, rounding days up", () => {
    expect(tank(1, 10)).toMatchObject({ days: 1, level: "low" });
    expect(tank(29, 10)).toMatchObject({ days: 3, level: "low" });
    expect(tankLabel(tank(29, 10))).toBe("3 days of new words left: harvest soon");
    expect(tankLabel(tank(5, 10))).toBe("1 day of new words left: harvest soon");
  });

  it("is ok from three days, and full from fourteen", () => {
    expect(tank(30, 10)).toMatchObject({ days: 3, level: "ok", fill: 30 / 140 });
    expect(tankLabel(tank(30, 10))).toBe("3 days of new words");
    expect(tank(139, 10)).toMatchObject({ days: 14, level: "ok" });
    expect(tank(140, 10)).toMatchObject({ days: 14, level: "full", fill: 1 });
    expect(tank(500, 10)).toMatchObject({ days: 50, level: "full", fill: 1 });
  });

  it("scales with the batch size", () => {
    expect(tank(5, 2)).toMatchObject({ days: 3, level: "low" });
    expect(tank(6, 2)).toMatchObject({ days: 3, level: "ok" });
  });
});
