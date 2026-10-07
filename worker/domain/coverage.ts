// f18 (FR-L): how many vault items each topic holds at each CEFR level, against the quotas in
// shared/topics.ts. Read-only. Queued items count, so a batch never asks again for words already
// waiting in the queue; counts use `topic` only, never secondary tags.

import type { CoverageResponse } from "../../shared/api";
import type { CefrLevel } from "../../shared/topics";

export async function coverage(db: D1Database): Promise<CoverageResponse> {
  const [cells, totals] = await db.batch<{
    topic: string | null;
    cefr: CefrLevel | null;
    n: number;
  }>([
    db.prepare(
      "SELECT topic, cefr, count(*) AS n FROM vocab WHERE topic IS NOT NULL GROUP BY topic, cefr",
    ),
    db.prepare(
      `SELECT count(*) AS total, coalesce(sum(topic IS NULL OR cefr IS NULL), 0) AS unclassified
       FROM vocab`,
    ),
  ]);
  const body: CoverageResponse = { counts: {}, totals: {}, unclassified: 0, total: 0 };
  for (const { topic, cefr, n } of cells?.results ?? []) {
    if (topic === null) continue;
    body.counts[topic] ??= {};
    if (cefr !== null) body.counts[topic][cefr] = n;
    body.totals[topic] = (body.totals[topic] ?? 0) + n;
  }
  const sums = totals?.results[0] as unknown as { total: number; unclassified: number } | undefined;
  body.total = sums?.total ?? 0;
  body.unclassified = sums?.unclassified ?? 0;
  return body;
}
