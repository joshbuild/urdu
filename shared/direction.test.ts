import { describe, expect, it } from "vitest";
import { chooseDirection, productionChance } from "./direction";

const DAY = 86_400;

describe("productionChance", () => {
  it("rises with the interval, each band starting at its edge", () => {
    expect(productionChance(0)).toBe(0.1);
    expect(productionChance(DAY - 1)).toBe(0.1);
    expect(productionChance(DAY)).toBe(0.3);
    expect(productionChance(7 * DAY - 1)).toBe(0.3);
    expect(productionChance(7 * DAY)).toBe(0.5);
    expect(productionChance(30 * DAY - 1)).toBe(0.5);
    expect(productionChance(30 * DAY)).toBe(0.7);
    expect(productionChance(182 * DAY - 1)).toBe(0.7);
    expect(productionChance(182 * DAY)).toBe(0.8);
    expect(productionChance(3650 * DAY)).toBe(0.8);
  });
});

describe("chooseDirection", () => {
  const known = { english: "water", interval_seconds: 7 * DAY };

  it("draws English → Urdu below the chance and Urdu → English at or above it", () => {
    expect(chooseDirection(known, () => 0.49)).toBe("en_ur");
    expect(chooseDirection(known, () => 0.5)).toBe("ur_en");
  });

  it("is always Urdu → English for an item with no English, whatever the draw", () => {
    for (const english of [null, "", "  "])
      expect(chooseDirection({ english, interval_seconds: 365 * DAY }, () => 0)).toBe("ur_en");
  });
});
