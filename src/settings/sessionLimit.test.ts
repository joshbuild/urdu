import { describe, expect, it } from "vitest";
import { DEFAULT_SESSION_LIMIT, parseSessionLimit } from "./sessionLimit";

describe("parseSessionLimit", () => {
  it("defaults to 20 when nothing is stored", () => {
    expect(DEFAULT_SESSION_LIMIT).toBe(20);
    expect(parseSessionLimit(null)).toBe(20);
    expect(parseSessionLimit(undefined)).toBe(20);
  });

  it("accepts whole numbers from 1 to 200", () => {
    expect(parseSessionLimit("1")).toBe(1);
    expect(parseSessionLimit(" 35 ")).toBe(35);
    expect(parseSessionLimit("200")).toBe(200);
  });

  it("falls back to the default for anything else", () => {
    for (const raw of ["", "0", "201", "-5", "12.5", "abc", "1e2"]) {
      expect(parseSessionLimit(raw), raw).toBe(20);
    }
  });
});
