import { describe, expect, it } from "vitest";
import {
  type CoverageCounts,
  DEFAULT_NEXT_BATCH_SIZE,
  describeCells,
  isNextBatchSize,
  nextCells,
} from "./coverage";
import { type QUOTA_LEVELS, TOPICS } from "./topics";

// Every cell at `level` filled to its quota.
function full(level: (typeof QUOTA_LEVELS)[number], counts: CoverageCounts = {}): CoverageCounts {
  for (const t of TOPICS) counts[t.slug] = { ...counts[t.slug], [level]: t.quota[level] };
  return counts;
}

const SIZE = DEFAULT_NEXT_BATCH_SIZE;
const total = (cells: { ask: number }[]) => cells.reduce((sum, c) => sum + c.ask, 0);

describe("nextCells", () => {
  it("fills the batch size from the first A1 topics in an empty vault", () => {
    expect(nextCells({}, SIZE)).toEqual([
      { topic: "pronouns", level: "A1", have: 0, quota: 20, ask: 20 },
      { topic: "questions", level: "A1", have: 0, quota: 14, ask: 5 },
    ]);
    expect(nextCells({}, 50).map((c) => [c.topic, c.ask])).toEqual([
      ["pronouns", 20],
      ["questions", 14],
      ["postpositions", 15],
      ["connectors", 1],
    ]);
  });

  it("asks one big cell for no more than the batch size", () => {
    const counts = full("A1");
    counts.food = { A1: 0 };
    const food = TOPICS.find((t) => t.slug === "food");
    expect(food?.quota.A1).toBeGreaterThan(SIZE);
    expect(nextCells(counts, SIZE)).toEqual([
      { topic: "food", level: "A1", have: 0, quota: food?.quota.A1, ask: SIZE },
    ]);
  });

  it("picks the lowest fill ratio, ties in topic order", () => {
    const counts = full("A1");
    counts.food = { A1: 20 }; // 20 of 35
    counts.body = { A1: 10 }; // 10 of 20 = 0.5
    counts.home = { A1: 10 }; // 10 of 20 = 0.5, after body in topic order
    expect(nextCells(counts, 30).map((c) => [c.topic, c.ask])).toEqual([
      ["body", 10],
      ["home", 10],
      ["food", 10],
    ]);
  });

  it("goes on into the next level when the last cells of a level leave room", () => {
    const counts = full("A1");
    counts.numbers = { A1: 49 };
    counts.body = { A1: 19 };
    const picked = nextCells(counts, SIZE);
    expect(picked.slice(0, 2)).toEqual([
      { topic: "body", level: "A1", have: 19, quota: 20, ask: 1 },
      { topic: "numbers", level: "A1", have: 49, quota: 50, ask: 1 },
    ]);
    expect(picked.slice(2).every((c) => c.level === "A2")).toBe(true);
    expect(total(picked)).toBe(SIZE);
  });

  it("never picks a quota-0 cell, and counts over quota as full", () => {
    const counts = full("A1", full("A2"));
    counts.idioms = { A1: 0, A2: 12 }; // idioms A1 has quota 0; A2 over quota
    const picked = nextCells(counts, SIZE);
    expect(new Set(picked.map((c) => c.level))).toEqual(new Set(["B1"]));
    expect(picked.some((c) => c.topic === "idioms" && c.level === "A1")).toBe(false);
  });

  it("returns what is left when the vault is nearly full, and nothing when it is full", () => {
    const counts = full("A1", full("A2", full("B1")));
    expect(nextCells(counts, SIZE)).toEqual([]);
    counts.food = { ...counts.food, B1: 28 };
    expect(nextCells(counts, SIZE)).toEqual([
      { topic: "food", level: "B1", have: 28, quota: 30, ask: 2 },
    ]);
  });

  it("puts a tapped cell first, then fills from its level up", () => {
    expect(nextCells({}, SIZE, { topic: "food", level: "B1" })).toEqual([
      { topic: "food", level: "B1", have: 0, quota: 30, ask: 25 },
    ]);
    const counts = full("B1");
    counts.food = { A2: 30, B1: 25 };
    const picked = nextCells(counts, SIZE, { topic: "food", level: "A2" });
    expect(picked[0]).toEqual({ topic: "food", level: "A2", have: 30, quota: 35, ask: 5 });
    expect(picked.slice(1).every((c) => c.level === "A2" && c.topic !== "food")).toBe(true);
    expect(total(picked)).toBe(SIZE);
  });

  it("refuses a tapped cell that is full, has quota 0, or is unknown", () => {
    expect(nextCells(full("A1"), SIZE, { topic: "food", level: "A1" })).toEqual([]);
    expect(nextCells({}, SIZE, { topic: "idioms", level: "A1" })).toEqual([]);
    expect(nextCells({}, SIZE, { topic: "objects", level: "A1" })).toEqual([]);
  });
});

describe("describeCells", () => {
  const cells = nextCells({}, 50);
  it("names up to three cells, then counts the rest", () => {
    expect(describeCells(cells.slice(0, 2))).toBe("A1 pronouns + A1 questions");
    expect(describeCells(cells, true)).toBe(
      "20 A1 pronouns + 14 A1 questions + 15 A1 postpositions + 1 more",
    );
  });
});

describe("isNextBatchSize", () => {
  it("takes whole numbers from 1 to 50", () => {
    expect([1, 25, 50].every(isNextBatchSize)).toBe(true);
    expect([0, 51, 2.5, "10", null].some(isNextBatchSize)).toBe(false);
  });
});
