import { describe, expect, it } from "vitest";
import {
  backendCost,
  capOrDefault,
  DEFAULT_HARD_CAP_USD,
  formatUsd,
  isCapUsd,
  MAX_CAP_USD,
  sessionCost,
  voiceCost,
} from "./voice-cost";

describe("voiceCost", () => {
  it("charges the create charge even for a session with no audio", () => {
    expect(voiceCost(0)).toBeCloseTo(15 * (0.05 / 60), 6);
  });

  it("bills 45 s plus the 15 s create charge as one minute", () => {
    expect(voiceCost(45)).toBeCloseTo(0.05, 6);
  });

  it("matches the mp02 five-minute run at about 25 cents", () => {
    expect(voiceCost(303)).toBeCloseTo(0.265, 3);
  });

  it("treats negative seconds as none rather than a refund", () => {
    expect(voiceCost(-500)).toBe(voiceCost(0));
  });
});

describe("backendCost", () => {
  it("prices luna tokens per million", () => {
    expect(backendCost(1_000_000, 0)).toBeCloseTo(0.2, 6);
    expect(backendCost(0, 1_000_000)).toBeCloseTo(1.2, 6);
  });

  it("keeps a real delegation under a cent", () => {
    // mp02 run 2: 2342 input + 90 output tokens, reported as about $0.0006.
    expect(backendCost(2342, 90)).toBeCloseTo(0.0006, 4);
  });
});

describe("sessionCost", () => {
  it("is the voice cost plus the backend cost", () => {
    const usage = { seconds: 45, backend_input_tokens: 1_000_000, backend_output_tokens: 0 };
    expect(sessionCost(usage)).toBeCloseTo(0.25, 6);
  });
});

describe("caps", () => {
  it("accepts amounts within the bounds, including zero", () => {
    expect(isCapUsd(0)).toBe(true);
    expect(isCapUsd(1)).toBe(true);
    expect(isCapUsd(MAX_CAP_USD)).toBe(true);
  });

  it("rejects anything unbounded, negative or not a number", () => {
    expect(isCapUsd(-0.5)).toBe(false);
    expect(isCapUsd(MAX_CAP_USD + 0.01)).toBe(false);
    expect(isCapUsd(Number.NaN)).toBe(false);
    expect(isCapUsd("1")).toBe(false);
    expect(isCapUsd(null)).toBe(false);
  });

  it("falls back to the default rather than leaving spending uncapped", () => {
    expect(capOrDefault("0.75", DEFAULT_HARD_CAP_USD)).toBe(0.75);
    expect(capOrDefault("0", DEFAULT_HARD_CAP_USD)).toBe(0);
    expect(capOrDefault("nonsense", DEFAULT_HARD_CAP_USD)).toBe(DEFAULT_HARD_CAP_USD);
    expect(capOrDefault(null, DEFAULT_HARD_CAP_USD)).toBe(DEFAULT_HARD_CAP_USD);
    expect(capOrDefault("999", DEFAULT_HARD_CAP_USD)).toBe(DEFAULT_HARD_CAP_USD);
  });
});

describe("formatUsd", () => {
  it("always shows two decimals", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(0.5)).toBe("$0.50");
    expect(formatUsd(0.12345)).toBe("$0.12");
  });
});
