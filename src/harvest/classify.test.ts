import { describe, expect, it } from "vitest";
import type { ClassifyResponse } from "../../shared/api";
import { classifySummary, initiallyTicked } from "./classify";

const classify = (n: number) => ({
  n,
  vocab_id: `v${n}`,
  urdu: `u${n}`,
  topic: "food",
  cefr: "A1" as const,
  tags: [],
});

const RESULTS: ClassifyResponse["results"] = [
  { ...classify(1), outcome: "classify" },
  { n: 2, urdu: "x", outcome: "rejected", reason: "bad" },
  { ...classify(3), outcome: "classify" },
  { n: 4, vocab_id: "v4", urdu: "u4", outcome: "missing" },
];

describe("initiallyTicked", () => {
  it("ticks every row that can be applied, and nothing else", () => {
    expect([...initiallyTicked(RESULTS)]).toEqual([1, 3]);
  });
});

describe("classifySummary", () => {
  it("counts a preview as rows ready, rejected and left out", () => {
    expect(classifySummary(RESULTS)).toBe("2 ready · 1 rejected · 1 left out");
  });

  it("counts an apply by outcome, leaving out zeros", () => {
    expect(
      classifySummary([
        { ...classify(1), outcome: "classified" },
        { ...classify(2), outcome: "classified" },
        { ...classify(3), outcome: "stale" },
        { ...classify(4), outcome: "declined" },
      ]),
    ).toBe("2 classified · 1 kept (edited since) · 1 unticked");
  });
});
