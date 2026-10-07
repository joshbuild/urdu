// f18 (FR-L): which coverage cells the next ChatGPT batch asks for. Pure, so the Worker picks and
// the tests pin it. A cell is one topic at one quota level; it is open while it holds fewer items
// than its quota. Levels fill in order (A1 across every topic before A2), so the vault grows from a
// broad core outwards.

import { type CefrLevel, QUOTA_LEVELS, type QuotaLevel, TOPICS, topicBySlug } from "./topics";

// GET /api/coverage's counts: counts[topic][level].
export type CoverageCounts = Record<string, Partial<Record<CefrLevel, number>>>;

// The most one cell asks for in a batch; two cells fit the 50-proposal paste cap exactly.
export const BATCH_CELL_MAX = 25;

export type BatchCell = {
  topic: string;
  level: QuotaLevel;
  have: number;
  quota: number;
  // min(BATCH_CELL_MAX, quota - have)
  ask: number;
};

function cell(counts: CoverageCounts, slug: string, level: QuotaLevel): BatchCell | null {
  const topic = topicBySlug(slug);
  if (!topic) return null;
  const quota = topic.quota[level];
  const have = counts[slug]?.[level] ?? 0;
  if (have >= quota) return null;
  return { topic: slug, level, have, quota, ask: Math.min(BATCH_CELL_MAX, quota - have) };
}

// Open cells at a level, emptiest first (lowest have/quota), ties in topic order.
function openCells(counts: CoverageCounts, level: QuotaLevel): BatchCell[] {
  return TOPICS.map((t) => cell(counts, t.slug, level))
    .filter((c): c is BatchCell => c !== null)
    .map((c, order) => ({ c, order }))
    .sort((a, b) => a.c.have / a.c.quota - b.c.have / b.c.quota || a.order - b.order)
    .map(({ c }) => c);
}

// Up to two cells: the two emptiest at the lowest level with any open cell, or a tapped cell
// paired with the emptiest other cell at its own level. A tapped cell that is full, has quota 0
// or is unknown gives nothing, as does a vault where every cell is full.
export function nextCells(
  counts: CoverageCounts,
  tapped?: { topic: string; level: QuotaLevel },
): BatchCell[] {
  if (tapped) {
    const first = cell(counts, tapped.topic, tapped.level);
    if (!first) return [];
    const partner = openCells(counts, tapped.level).find((c) => c.topic !== tapped.topic);
    return partner ? [first, partner] : [first];
  }
  for (const level of QUOTA_LEVELS) {
    const open = openCells(counts, level);
    if (open.length > 0) return open.slice(0, 2);
  }
  return [];
}
