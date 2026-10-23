import { describe, expect, it } from "vitest";
import {
  checkRequest,
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
      scope: "rotation",
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
    // mp08: Topic & level sorts last.
    expect(toggleOptionField(toggleOptionField(one, "topic"), "roman").fields).toEqual([
      "roman",
      "example_urdu",
      "topic",
    ]);
  });

  it("decodes stored options, and falls back to the defaults on anything invalid", () => {
    const stored = {
      mode: "both",
      fields: ["notes", "topic"],
      count: 35,
      only_unchecked: true,
      scope: "newest",
    };
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

describe("which words (mp08)", () => {
  const added = { ...DEFAULT_CHECK_OPTIONS, scope: "added" as const };

  it("needs both dates for Added between, in order", () => {
    expect(optionsProblem(added)).toMatch(/both dates/);
    expect(optionsProblem({ ...added, from: "2026-10-22" })).toMatch(/both dates/);
    expect(optionsProblem({ ...added, from: "2026-10-23", to: "2026-10-22" })).toMatch(/after/);
    expect(optionsProblem({ ...added, from: "2026-10-22", to: "2026-10-22" })).toBeNull();
    // Dates kept from an earlier Added between don't matter to another scope.
    expect(optionsProblem({ ...DEFAULT_CHECK_OPTIONS, from: "2026-10-23", to: "x" })).toBeNull();
  });

  it("sends the dates only with Added between, and the topic with any scope", () => {
    const dates = { from: "2026-10-20", to: "2026-10-22" };
    expect(checkRequest({ ...DEFAULT_CHECK_OPTIONS, ...dates, topic: "conjugation" })).toEqual({
      ...DEFAULT_CHECK_OPTIONS,
      topic: "conjugation",
    });
    expect(checkRequest({ ...added, ...dates })).toEqual({ ...added, ...dates });
  });

  it("decodes a value stored before Which words as the rotation, keeping the rest", () => {
    const old = { mode: "both", fields: ["notes"], count: 35, only_unchecked: true };
    expect(decodeOptions(JSON.stringify(old))).toEqual({ ...old, scope: "rotation" });
  });

  it("keeps good dates and topic, and drops bad ones to the rotation over every topic", () => {
    const base = { ...DEFAULT_CHECK_OPTIONS };
    const good = { ...base, scope: "added", from: "2026-10-20", to: "2026-10-22", topic: "food" };
    expect(decodeOptions(JSON.stringify(good))).toEqual(good);
    for (const bad of [
      { ...good, scope: "oldest" },
      { ...good, from: "2026-10-23" },
      { ...good, to: "yesterday" },
    ]) {
      const { from: _f, to: _t, ...rest } = good;
      const decoded = decodeOptions(JSON.stringify(bad));
      expect(decoded.scope).toBe("rotation");
      expect(decoded.topic).toBe("food");
      if (bad.scope !== "oldest") expect(decoded).toEqual({ ...rest, scope: "rotation" });
    }
    expect(decodeOptions(JSON.stringify({ ...base, topic: "nonsense" }))).toEqual(base);
  });
});
