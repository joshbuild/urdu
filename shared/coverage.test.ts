import { describe, expect, it } from "vitest";
import { BATCH_CELL_MAX, type CoverageCounts, nextCells } from "./coverage";
import { type QUOTA_LEVELS, TOPICS } from "./topics";

// Every cell at `level` filled to its quota.
function full(level: (typeof QUOTA_LEVELS)[number], counts: CoverageCounts = {}): CoverageCounts {
  for (const t of TOPICS) counts[t.slug] = { ...counts[t.slug], [level]: t.quota[level] };
  return counts;
}

describe("nextCells", () => {
  it("asks for the first two topics at A1 in an empty vault, 25 each or what remains", () => {
    expect(nextCells({})).toEqual([
      { topic: "pronouns", level: "A1", have: 0, quota: 20, ask: 20 },
      { topic: "questions", level: "A1", have: 0, quota: 14, ask: 14 },
    ]);
    const food = TOPICS.find((t) => t.slug === "food");
    expect(food?.quota.A1).toBeGreaterThan(BATCH_CELL_MAX);
  });

  it("picks the lowest fill ratio, ties in topic order", () => {
    const counts = full("A1");
    counts.food = { A1: 0 }; // 0 of 35
    counts.body = { A1: 10 }; // 10 of 20 = 0.5
    counts.home = { A1: 10 }; // 10 of 20 = 0.5, after body in topic order
    expect(nextCells(counts).map((c) => [c.topic, c.ask])).toEqual([
      ["food", 25],
      ["body", 10],
    ]);
  });

  it("finishes a level before the next, and gives a one-cell batch when one cell is left", () => {
    const counts = full("A1");
    counts.numbers = { A1: 49 };
    expect(nextCells(counts)).toEqual([
      { topic: "numbers", level: "A1", have: 49, quota: 50, ask: 1 },
    ]);
    counts.numbers = { A1: 50 };
    expect(nextCells(counts).map((c) => c.level)).toEqual(["A2", "A2"]);
  });

  it("never picks a quota-0 cell, and counts over quota as full", () => {
    const counts = full("A1", full("A2"));
    counts.idioms = { A1: 0, A2: 12 }; // idioms A1 has quota 0; A2 over quota
    const picked = nextCells(counts);
    expect(picked.map((c) => c.level)).toEqual(["B1", "B1"]);
    expect(picked.some((c) => c.topic === "idioms" && c.level === "A1")).toBe(false);
  });

  it("returns nothing when every cell is full", () => {
    expect(nextCells(full("A1", full("A2", full("B1"))))).toEqual([]);
  });

  it("pairs a tapped cell with the next pick at its own level", () => {
    const picked = nextCells({}, { topic: "food", level: "B1" });
    expect(picked).toEqual([
      { topic: "food", level: "B1", have: 0, quota: 30, ask: 25 },
      { topic: "pronouns", level: "B1", have: 0, quota: 8, ask: 8 },
    ]);
  });

  it("asks for a tapped cell alone when nothing else at its level is open", () => {
    const counts = full("A2");
    counts.food = { A2: 30 };
    expect(nextCells(counts, { topic: "food", level: "A2" })).toEqual([
      { topic: "food", level: "A2", have: 30, quota: 35, ask: 5 },
    ]);
  });

  it("refuses a tapped cell that is full, has quota 0, or is unknown", () => {
    expect(nextCells(full("A1"), { topic: "food", level: "A1" })).toEqual([]);
    expect(nextCells({}, { topic: "idioms", level: "A1" })).toEqual([]);
    expect(nextCells({}, { topic: "objects", level: "A1" })).toEqual([]);
  });
});
