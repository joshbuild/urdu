// f18 (FR-L): which coverage cells the next ChatGPT batch asks for. Pure, so the Worker picks and
// the tests pin it. A cell is one topic at one quota level; it is open while it holds fewer items
// than its quota. Levels fill in order (A1 across every topic before A2), so the vault grows from a
// broad core outwards.

import { type CefrLevel, QUOTA_LEVELS, type QuotaLevel, TOPICS, topicBySlug } from "./topics";

// GET /api/coverage's counts: counts[topic][level].
export type CoverageCounts = Record<string, Partial<Record<CefrLevel, number>>>;

// The Next batch size: how many words one batch asks for in all (settings.next_batch_size). The
// most is the 50-proposal paste cap; 25 keeps a reply within what ChatGPT does well.
export const DEFAULT_NEXT_BATCH_SIZE = 25;
export const MIN_NEXT_BATCH_SIZE = 1;
export const MAX_NEXT_BATCH_SIZE = 50;

export function isNextBatchSize(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) >= MIN_NEXT_BATCH_SIZE &&
    (value as number) <= MAX_NEXT_BATCH_SIZE
  );
}

export type BatchCell = {
  topic: string;
  level: QuotaLevel;
  have: number;
  quota: number;
  // min(quota - have, what is left of the batch size)
  ask: number;
};

function cell(counts: CoverageCounts, slug: string, level: QuotaLevel): BatchCell | null {
  const topic = topicBySlug(slug);
  if (!topic) return null;
  const quota = topic.quota[level];
  const have = counts[slug]?.[level] ?? 0;
  if (have >= quota) return null;
  return { topic: slug, level, have, quota, ask: quota - have };
}

// Open cells at a level, emptiest first (lowest have/quota), ties in topic order.
function openCells(counts: CoverageCounts, level: QuotaLevel): BatchCell[] {
  return TOPICS.map((t) => cell(counts, t.slug, level))
    .filter((c): c is BatchCell => c !== null)
    .map((c, order) => ({ c, order }))
    .sort((a, b) => a.c.have / a.c.quota - b.c.have / b.c.quota || a.order - b.order)
    .map(({ c }) => c);
}

// Cells until `size` words are asked for: from the lowest level with any open cell, emptiest first,
// then on into the next level. Filling the whole size means a batch never shrinks to the last few
// words of a level, and a cell ChatGPT cannot fill (it offers only words the vault already has)
// cannot stall the batches behind it. A tapped open cell comes first, then the walk from its level.
// A tapped cell that is full, has quota 0 or is unknown gives nothing, as does a full vault.
export function nextCells(
  counts: CoverageCounts,
  size: number,
  tapped?: { topic: string; level: QuotaLevel },
): BatchCell[] {
  const picked: BatchCell[] = [];
  let left = size;
  const take = (c: BatchCell) => {
    const ask = Math.min(c.ask, left);
    picked.push({ ...c, ask });
    left -= ask;
  };
  let levels: readonly QuotaLevel[] = QUOTA_LEVELS;
  if (tapped) {
    const first = cell(counts, tapped.topic, tapped.level);
    if (!first) return [];
    take(first);
    levels = QUOTA_LEVELS.slice(QUOTA_LEVELS.indexOf(tapped.level));
  }
  for (const level of levels) {
    for (const c of openCells(counts, level)) {
      if (left <= 0) return picked;
      if (c.topic === tapped?.topic && c.level === tapped.level) continue;
      take(c);
    }
  }
  return picked;
}

// A batch's cells in a few words, for its harvest's filter and the copy notice: the first three,
// then how many more. With counts, each cell carries its ask ("20 A1 pronouns").
export function describeCells(cells: readonly BatchCell[], counts = false): string {
  const named = cells
    .slice(0, 3)
    .map((c) => `${counts ? `${c.ask} ` : ""}${c.level} ${c.topic}`)
    .join(" + ");
  return cells.length > 3 ? `${named} + ${cells.length - 3} more` : named;
}
