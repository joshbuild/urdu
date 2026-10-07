// f18 (FR-L): classify existing words. Issuing records up to 100 unclassified items (topic or level
// null), oldest first, as a `classify_issued` handoff holding their ids and the topic and level
// each had then. The thin reply, `rows: [[n, urdu, topic, level, tags?]]`, is previewed and then
// applied: each ticked row writes topic, level and tags only if the item still has the topic and
// level it had at issue, so an edit in between is never clobbered. The schedule is never touched.

import type {
  ClassifyBatchResponse,
  ClassifyPlan,
  ClassifyRequest,
  ClassifyResponse,
  ClassifyResult,
} from "../../shared/api";
import { urduKey } from "../../shared/normalize";
import { type CefrLevel, cefrLevel, topicSlug } from "../../shared/topics";
import { ulid } from "../../shared/ulid";
import { ID_CONFLICT } from "./handoff";
import { lenientClassification } from "./vocab-input";

const UNCLASSIFIED = "(topic IS NULL OR cefr IS NULL)";

type Issued = { vocab_id: string; topic: string | null; cefr: CefrLevel | null };
type BatchPayload = { items: Issued[] };

export async function issueClassifyBatch(
  db: D1Database,
  count: number,
  now: Date,
): Promise<ClassifyBatchResponse> {
  const [rows, total] = await db.batch([
    db
      .prepare(
        `SELECT id, urdu, english, topic, cefr FROM vocab WHERE ${UNCLASSIFIED}
         ORDER BY added_at ASC, id ASC LIMIT ?`,
      )
      .bind(count),
    db.prepare(`SELECT count(*) AS n FROM vocab WHERE ${UNCLASSIFIED}`),
  ]);
  const found = (rows?.results ?? []) as {
    id: string;
    urdu: string;
    english: string | null;
    topic: string | null;
    cefr: CefrLevel | null;
  }[];
  const unclassified = (total?.results[0] as { n: number } | undefined)?.n ?? 0;
  if (found.length === 0) return { handoff_id: null, items: [], unclassified };

  const handoff_id = ulid(now.getTime());
  const payload: BatchPayload = {
    items: found.map((r) => ({ vocab_id: r.id, topic: r.topic, cefr: r.cefr })),
  };
  await db
    .prepare(
      "INSERT INTO handoffs (id, imported_at, payload, status, outcome) VALUES (?, ?, ?, 'classify_issued', NULL)",
    )
    .bind(handoff_id, now.toISOString(), JSON.stringify(payload))
    .run();
  return {
    handoff_id,
    items: found.map((r, i) => ({ n: i + 1, vocab_id: r.id, urdu: r.urdu, english: r.english })),
    unclassified,
  };
}

export const NOT_ISSUED = "not_issued";

type Batch =
  | { status: "classify_issued"; items: Issued[] }
  | { status: "classified"; items: Issued[]; results: ClassifyResult[] };

async function readBatch(
  db: D1Database,
  id: string,
): Promise<Batch | typeof ID_CONFLICT | typeof NOT_ISSUED> {
  const row = await db
    .prepare("SELECT status, payload, outcome FROM handoffs WHERE id = ?")
    .bind(id)
    .first<{ status: string; payload: string; outcome: string | null }>();
  if (!row) return NOT_ISSUED;
  if (row.status !== "classify_issued" && row.status !== "classified") return ID_CONFLICT;
  const { items } = JSON.parse(row.payload) as BatchPayload;
  return row.status === "classified"
    ? { status: "classified", items, results: JSON.parse(row.outcome ?? "[]") }
    : { status: "classify_issued", items };
}

const rejected = (n: number | null, urdu: string, reason: string): ClassifyPlan => ({
  n,
  urdu,
  outcome: "rejected",
  reason,
});

type Stored = { urdu: string; topic: string | null; cefr: CefrLevel | null };

// One row of the reply, [n, urdu, topic, level] or [n, urdu, topic, level, tags], against the
// batch. `answered` collects every n a row named, so the item is not also reported missing;
// `planned` the n with a good row, so only a second good row for an item is refused.
function planRow(
  row: unknown,
  index: number,
  items: readonly Issued[],
  stored: ReadonlyMap<string, Stored>,
  answered: Set<number>,
  planned: Set<number>,
): ClassifyPlan {
  const shape = `row ${index + 1} must be [n, urdu, topic, level, tags]`;
  if (!Array.isArray(row) || row.length < 4 || row.length > 5) return rejected(null, "", shape);
  const [n, urdu, topic, level, tags] = row as unknown[];
  if (!Number.isInteger(n) || typeof urdu !== "string") {
    return rejected(null, typeof urdu === "string" ? urdu : "", shape);
  }
  const num = n as number;
  const issued = items[num - 1];
  if (!issued) return rejected(num, urdu, `there is no item ${num} in this batch`);
  answered.add(num);
  if (planned.has(num)) return rejected(num, urdu, `item ${num} appears twice`);
  const item = stored.get(issued.vocab_id);
  if (!item) return rejected(num, urdu, "this item has been deleted");
  if (urduKey(urdu) !== urduKey(item.urdu)) {
    return rejected(num, urdu, `the Urdu does not match item ${num}, ${item.urdu}`);
  }
  const slug = topicSlug(topic);
  if (slug === null) return rejected(num, urdu, `${JSON.stringify(topic)} is not a known topic`);
  const cefr = cefrLevel(level);
  if (cefr === null) return rejected(num, urdu, `${JSON.stringify(level)} is not a CEFR level`);
  const lenient = lenientClassification({ topic: slug, tags: tags ?? [] });
  planned.add(num);
  return {
    n: num,
    vocab_id: issued.vocab_id,
    urdu: item.urdu,
    outcome: "classify",
    topic: slug,
    cefr,
    tags: lenient.value.tags ?? [],
    ...(lenient.dropped.length > 0 ? { dropped: lenient.dropped } : {}),
  };
}

// Each row of the reply in reply order, then each batch item the reply left out.
function plan(
  rows: readonly unknown[],
  items: readonly Issued[],
  stored: ReadonlyMap<string, Stored>,
): ClassifyPlan[] {
  const answered = new Set<number>();
  const planned = new Set<number>();
  const plans = rows.map((row, index) => planRow(row, index, items, stored, answered, planned));
  for (const [i, issued] of items.entries()) {
    const item = stored.get(issued.vocab_id);
    if (!answered.has(i + 1) && item) {
      plans.push({ n: i + 1, vocab_id: issued.vocab_id, urdu: item.urdu, outcome: "missing" });
    }
  }
  return plans;
}

const OPEN = "EXISTS (SELECT 1 FROM handoffs WHERE id = ? AND status = 'classify_issued')";

export async function classifyVocab(
  db: D1Database,
  request: ClassifyRequest,
  now: Date,
): Promise<ClassifyResponse | typeof ID_CONFLICT | typeof NOT_ISSUED> {
  const { handoff_id } = request;
  const batch = await readBatch(db, handoff_id);
  if (batch === ID_CONFLICT || batch === NOT_ISSUED) return batch;
  const batch_size = batch.items.length;
  if (batch.status === "classified") {
    return { handoff_id, preview: false, repeat: true, batch_size, results: batch.results };
  }
  // D1 binds at most 100 parameters per query, so the ids go in chunks below that (as f14).
  const ids = batch.items.map((i) => i.vocab_id);
  const rows: (Stored & { id: string })[] = [];
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    const found = await db
      .prepare(
        `SELECT id, urdu, topic, cefr FROM vocab WHERE id IN (${chunk.map(() => "?").join(", ")})`,
      )
      .bind(...chunk)
      .all<Stored & { id: string }>();
    rows.push(...found.results);
  }
  const current = new Map(rows.map((r) => [r.id, r]));
  const plans = plan(request.rows, batch.items, current);
  if (request.accept === undefined) {
    return { handoff_id, preview: true, repeat: false, batch_size, results: plans };
  }

  // Apply: each ticked plan is one guarded UPDATE; the batch is closed in the same D1 batch, so a
  // racing second apply writes nothing.
  const at = now.toISOString();
  const accept = new Set(request.accept);
  const byId = new Map(batch.items.map((i) => [i.vocab_id, i]));
  const writes: { index: number; statement: D1PreparedStatement }[] = [];
  const results: ClassifyResult[] = plans.map((p, index) => {
    if (p.outcome !== "classify") return p;
    if (!accept.has(p.n)) return { ...p, outcome: "declined" };
    const issued = byId.get(p.vocab_id) as Issued;
    // Edited since issue, as read just now: stale without a write. The guard below is the
    // backstop for an edit landing between this read and the write.
    const latest = current.get(p.vocab_id);
    if (latest?.topic !== issued.topic || latest?.cefr !== issued.cefr) {
      return { ...p, outcome: "stale" };
    }
    writes.push({
      index,
      statement: db
        .prepare(
          `UPDATE vocab SET topic = ?, cefr = ?, tags = ?, updated_at = ?
           WHERE id = ? AND topic IS ? AND cefr IS ? AND ${OPEN}`,
        )
        .bind(
          p.topic,
          p.cefr,
          JSON.stringify(p.tags),
          at,
          p.vocab_id,
          issued.topic,
          issued.cefr,
          handoff_id,
        ),
    });
    return { ...p, outcome: "classified" };
  });
  const close = db
    .prepare(
      "UPDATE handoffs SET status = 'classified', outcome = ? WHERE id = ? AND status = 'classify_issued'",
    )
    .bind(JSON.stringify(results), handoff_id);
  const done = await db.batch([...writes.map((w) => w.statement), close]);
  if ((done[writes.length]?.meta.changes ?? 0) === 0) {
    // Another apply got there first; its outcome stands.
    const stored = await readBatch(db, handoff_id);
    if (stored !== ID_CONFLICT && stored !== NOT_ISSUED && stored.status === "classified") {
      return { handoff_id, preview: false, repeat: true, batch_size, results: stored.results };
    }
    return ID_CONFLICT;
  }
  // A guarded write that changed nothing met an item edited since the batch was issued.
  const stale = writes.filter((_, i) => (done[i]?.meta.changes ?? 0) === 0);
  for (const w of stale) {
    results[w.index] = {
      ...(results[w.index] as ClassifyResult),
      outcome: "stale",
    } as ClassifyResult;
  }
  if (stale.length > 0) {
    await db
      .prepare("UPDATE handoffs SET outcome = ? WHERE id = ?")
      .bind(JSON.stringify(results), handoff_id)
      .run();
  }
  return { handoff_id, preview: false, repeat: false, batch_size, results };
}
