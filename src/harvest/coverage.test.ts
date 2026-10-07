import { describe, expect, it } from "vitest";
import type { CoverageResponse } from "../../shared/api";
import { TOPIC_SECTIONS, TOPICS } from "../../shared/topics";
import { coverageGrid } from "./coverage";

const EMPTY: CoverageResponse = { counts: {}, totals: {}, unclassified: 0, total: 0 };

describe("coverageGrid", () => {
  it("lays out every section and topic in order, with targets and zero counts", () => {
    const grid = coverageGrid(EMPTY);
    expect(grid.sections.map((s) => s.id)).toEqual(TOPIC_SECTIONS.map((s) => s.id));
    expect(grid.sections.flatMap((s) => s.rows.map((r) => r.slug))).toEqual(
      TOPICS.map((t) => t.slug),
    );
    const food = grid.sections[3]?.rows.find((r) => r.slug === "food");
    expect(food?.cells).toEqual([
      { level: "A1", have: 0, quota: 35, open: true },
      { level: "A2", have: 0, quota: 35, open: true },
      { level: "B1", have: 0, quota: 30, open: true },
    ]);
    expect(grid.totals).toEqual([
      { level: "A1", have: 0, quota: 685 },
      { level: "A2", have: 0, quota: 955 },
      { level: "B1", have: 0, quota: 935 },
    ]);
  });

  it("counts have against target, caps section totals at each target, and keeps B2+", () => {
    const grid = coverageGrid({
      counts: { food: { A1: 40, A2: 3, B2: 2, C1: 1 }, idioms: { A2: 1 } },
      totals: { food: 46, idioms: 1 },
      unclassified: 7,
      total: 54,
    });
    const daily = grid.sections.find((s) => s.id === "daily");
    const food = daily?.rows.find((r) => r.slug === "food");
    expect(food?.cells[0]).toEqual({ level: "A1", have: 40, quota: 35, open: false });
    expect(food?.beyond).toBe(3);
    expect(food?.total).toBe(46);
    // Over-target words don't fill other topics' gaps: totals count at most each target.
    expect(daily?.totals[0]).toEqual({ level: "A1", have: 35, quota: 163 });
    expect(grid.totals[0]).toEqual({ level: "A1", have: 35, quota: 685 });
    const idioms = grid.sections[1]?.rows.find((r) => r.slug === "idioms");
    expect(idioms?.cells[0]).toEqual({ level: "A1", have: 0, quota: 0, open: false });
    expect(grid.unclassified).toBe(7);
  });
});
