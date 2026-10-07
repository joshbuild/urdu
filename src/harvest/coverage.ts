// f18 (FR-L): the Harvest tab's coverage grid, laid out from GET /api/coverage and the quotas in
// shared/topics.ts. Pure, so the node project tests it.

import type { CoverageResponse } from "../../shared/api";
import {
  QUOTA_LEVELS,
  type QuotaLevel,
  TOPIC_SECTIONS,
  TOPICS,
  type TopicSectionId,
} from "../../shared/topics";

// open: below target, so tapping it asks for a batch of it.
export type GridCell = { level: QuotaLevel; have: number; quota: number; open: boolean };
export type LevelTotal = { level: QuotaLevel; have: number; quota: number };
export type GridRow = {
  slug: string;
  label: string;
  cells: GridCell[];
  // B2 and above, which have no target yet.
  beyond: number;
  total: number;
};
export type GridSection = {
  id: TopicSectionId;
  label: string;
  rows: GridRow[];
  totals: LevelTotal[];
};
export type CoverageGrid = {
  sections: GridSection[];
  totals: LevelTotal[];
  unclassified: number;
};

// have counts at most each cell's target, so a full cell's extra words don't hide another's gap.
function sum(rows: readonly GridRow[]): LevelTotal[] {
  return QUOTA_LEVELS.map((level, i) => {
    let have = 0;
    let quota = 0;
    for (const row of rows) {
      const cell = row.cells[i] as GridCell;
      have += Math.min(cell.have, cell.quota);
      quota += cell.quota;
    }
    return { level, have, quota };
  });
}

export function coverageGrid(coverage: CoverageResponse): CoverageGrid {
  const sections = TOPIC_SECTIONS.map((section) => {
    const rows = TOPICS.filter((t) => t.section === section.id).map((t) => {
      const counts = coverage.counts[t.slug] ?? {};
      const cells = QUOTA_LEVELS.map((level) => {
        const have = counts[level] ?? 0;
        const quota = t.quota[level];
        return { level, have, quota, open: have < quota };
      });
      const beyond = (counts.B2 ?? 0) + (counts.C1 ?? 0) + (counts.C2 ?? 0);
      return { slug: t.slug, label: t.label, cells, beyond, total: coverage.totals[t.slug] ?? 0 };
    });
    return { id: section.id, label: section.label, rows, totals: sum(rows) };
  });
  return {
    sections,
    totals: sum(sections.flatMap((s) => s.rows)),
    unclassified: coverage.unclassified,
  };
}
