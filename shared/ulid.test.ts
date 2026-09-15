import { describe, expect, it } from "vitest";
import { monotonicUlid, ulid } from "./ulid";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const zeros = () => Array(16).fill(0);

describe("ulid", () => {
  it("is 26 Crockford base32 characters", () => {
    for (let i = 0; i < 100; i++) expect(ulid()).toMatch(ULID_PATTERN);
  });

  it("encodes the timestamp as the first 10 characters (spec example)", () => {
    expect(monotonicUlid()(1469918176385).slice(0, 10)).toBe("01ARYZ6S41");
    expect(monotonicUlid(zeros)(0)).toBe("0".repeat(26));
  });

  it("sorts by creation order across and within milliseconds", () => {
    const next = monotonicUlid();
    const ids: string[] = [];
    for (let t = 1_700_000_000_000; t < 1_700_000_000_005; t++) {
      for (let i = 0; i < 200; i++) ids.push(next(t));
    }
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
  });

  it("increments the random part within a millisecond", () => {
    const next = monotonicUlid(() => [...zeros().slice(0, 15), 31]);
    expect(next(1).slice(10)).toBe("000000000000000Z");
    expect(next(1).slice(10)).toBe("0000000000000010");
  });

  it("stays monotonic when the clock goes backwards", () => {
    const next = monotonicUlid();
    const a = next(2_000);
    const b = next(1_000);
    expect(b > a).toBe(true);
    expect(b.slice(0, 10)).toBe(a.slice(0, 10));
  });

  it("throws when the random part overflows", () => {
    const next = monotonicUlid(() => Array(16).fill(31));
    next(5);
    expect(() => next(5)).toThrow(RangeError);
  });

  it("rejects times outside the 48-bit range", () => {
    expect(() => monotonicUlid()(-1)).toThrow(RangeError);
    expect(() => monotonicUlid()(2 ** 48)).toThrow(RangeError);
  });
});
