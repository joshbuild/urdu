import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHECK_OPTIONS,
  decodeOptions,
  optionsProblem,
  parseCount,
  toggleOptionField,
} from "./checkOptions";

describe("check options (f13)", () => {
  it("defaults to a correctness check of every field, 20 items", () => {
    expect(DEFAULT_CHECK_OPTIONS).toEqual({
      mode: "correctness",
      fields: ["roman", "english", "notes", "example_urdu", "example_english"],
      count: 20,
      only_unchecked: false,
    });
    expect(optionsProblem(DEFAULT_CHECK_OPTIONS)).toBeNull();
  });

  it("refuses no fields and a count outside 1-50", () => {
    expect(optionsProblem({ ...DEFAULT_CHECK_OPTIONS, fields: [] })).toMatch(/field/);
    for (const count of [0, 51, 2.5, Number.NaN]) {
      expect(optionsProblem({ ...DEFAULT_CHECK_OPTIONS, count })).toMatch(/1 to 50/);
    }
    expect(optionsProblem({ ...DEFAULT_CHECK_OPTIONS, count: 50 })).toBeNull();
  });

  it("reads only plain whole numbers as a count", () => {
    expect(parseCount(" 35 ")).toBe(35);
    for (const text of ["", "3.5", "-1", "1e2", "ten"]) expect(parseCount(text)).toBeNaN();
  });

  it("toggles a field and keeps the fields in their usual order", () => {
    const one = { ...DEFAULT_CHECK_OPTIONS, fields: ["example_urdu" as const] };
    expect(toggleOptionField(one, "roman").fields).toEqual(["roman", "example_urdu"]);
    expect(toggleOptionField(one, "example_urdu").fields).toEqual([]);
  });

  it("decodes stored options, and falls back to the defaults on anything invalid", () => {
    const stored = { mode: "both", fields: ["notes"], count: 35, only_unchecked: true };
    expect(decodeOptions(JSON.stringify(stored))).toEqual(stored);
    for (const raw of [
      null,
      "not json",
      "[]",
      JSON.stringify({ ...stored, mode: "speed" }),
      JSON.stringify({ ...stored, fields: ["urdu"] }),
      JSON.stringify({ ...stored, fields: ["notes", "notes"] }),
      JSON.stringify({ ...stored, count: 80 }),
      JSON.stringify({ ...stored, only_unchecked: "yes" }),
    ]) {
      expect(decodeOptions(raw)).toEqual(DEFAULT_CHECK_OPTIONS);
    }
  });
});
