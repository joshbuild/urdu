import { describe, expect, it } from "vitest";
import { addDays, isIsoDate, legacyInstant, legacyNextReviewOn, todayIn } from "./dates";

const HOME_TZ = "America/Vancouver";

describe("todayIn", () => {
  it.each([
    // Spring forward 2026-03-08: midnight is still PST (UTC-8); the next midnight is PDT (UTC-7).
    ["2026-03-08T07:59:59Z", "2026-03-07"],
    ["2026-03-08T08:00:00Z", "2026-03-08"],
    ["2026-03-09T06:59:59Z", "2026-03-08"],
    ["2026-03-09T07:00:00Z", "2026-03-09"],
    // Fall back 2026-11-01: midnight is still PDT (UTC-7); the next midnight is PST (UTC-8).
    ["2026-11-01T06:59:59Z", "2026-10-31"],
    ["2026-11-01T07:00:00Z", "2026-11-01"],
    ["2026-11-02T07:59:59Z", "2026-11-01"],
    ["2026-11-02T08:00:00Z", "2026-11-02"],
    // UTC date already ahead of the local date.
    ["2026-06-15T00:00:00Z", "2026-06-14"],
    ["2027-01-01T07:59:59Z", "2026-12-31"],
  ])("%s is %s in Vancouver", (instant, date) => {
    expect(todayIn(HOME_TZ, new Date(instant))).toBe(date);
  });

  it("uses the timezone it is given", () => {
    expect(todayIn("UTC", new Date("2026-06-15T00:00:00Z"))).toBe("2026-06-15");
    expect(todayIn("Asia/Karachi", new Date("2026-06-14T19:00:00Z"))).toBe("2026-06-15");
  });
});

describe("addDays", () => {
  it.each([
    ["2026-09-14", 0, "2026-09-14"],
    ["2026-01-31", 1, "2026-02-01"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2026-02-28", 1, "2026-03-01"],
    ["2028-02-28", 1, "2028-02-29"],
    ["2028-02-29", 1, "2028-03-01"],
    ["2026-03-01", -1, "2026-02-28"],
    ["2026-03-07", 1, "2026-03-08"],
    ["2026-10-31", 1, "2026-11-01"],
    ["2026-09-14", 3125, "2035-04-05"],
  ])("%s + %i = %s", (date, days, result) => {
    expect(addDays(date, days)).toBe(result);
  });

  it("rejects malformed dates and fractional days", () => {
    expect(() => addDays("2026-02-30", 1)).toThrow(RangeError);
    expect(() => addDays("2026-9-14", 1)).toThrow(RangeError);
    expect(() => addDays("2026-09-14T00:00:00Z", 1)).toThrow(RangeError);
    expect(() => addDays("2026-09-14", 1.5)).toThrow(RangeError);
  });
});

describe("isIsoDate", () => {
  it("accepts real calendar dates only", () => {
    expect(isIsoDate("2028-02-29")).toBe(true);
    for (const bad of ["2026-02-29", "2026-13-01", "2026-00-10", "26-09-14", "", null, 20260914]) {
      expect(isIsoDate(bad)).toBe(false);
    }
  });
});

describe("legacyNextReviewOn", () => {
  it("is null (due now) when never reviewed", () => {
    for (const m of [0, 3, 6] as const) expect(legacyNextReviewOn(null, m)).toBeNull();
  });

  it.each([
    [0, "2026-09-14"],
    [1, "2026-09-15"],
    [2, "2026-09-19"],
    [3, "2026-10-09"],
    [4, "2027-01-17"],
    [5, "2028-05-31"],
    [6, "2035-04-05"],
  ] as const)("legacy level %i reviewed 2026-09-14 is next due %s", (mastery, date) => {
    expect(legacyNextReviewOn("2026-09-14", mastery)).toBe(date);
  });
});

describe("legacyInstant", () => {
  it("puts a legacy date at 08:00 UTC, the start of the Vancouver day", () => {
    expect(legacyInstant("2026-09-14")).toBe("2026-09-14T08:00:00.000Z");
    expect(todayIn(HOME_TZ, new Date(legacyInstant("2026-01-14")))).toBe("2026-01-14");
    expect(todayIn(HOME_TZ, new Date(legacyInstant("2026-07-14")))).toBe("2026-07-14");
    expect(() => legacyInstant("2026-02-30")).toThrow(RangeError);
  });
});
