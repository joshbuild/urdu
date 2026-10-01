import { describe, expect, it } from "vitest";
import { parseBatchSize } from "./batchSize";

describe("parseBatchSize (f17)", () => {
  it("takes whole numbers from 1 to 50", () => {
    expect(parseBatchSize("1")).toBe(1);
    expect(parseBatchSize(" 10 ")).toBe(10);
    expect(parseBatchSize("50")).toBe(50);
  });

  it("refuses anything else", () => {
    for (const bad of ["0", "51", "2.5", "", "ten", "-3", "1e1"]) {
      expect(parseBatchSize(bad)).toBeNull();
    }
  });
});
