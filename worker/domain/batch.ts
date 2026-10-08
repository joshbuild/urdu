// f18 (FR-L): Next batch. Issuing picks the cells (shared/coverage.ts) and records the request as
// a `batch_issued` handoff under a Worker-minted id, so a reload between copy and paste loses
// nothing: the reply carries the id back. The paste creates a harvest of the built-in Topics
// source only then, so an abandoned copy leaves no empty harvest, and imports into it as f17.

import type {
  BatchIssueResponse,
  BatchPasteResponse,
  HandoffRequest,
  ProposalResult,
} from "../../shared/api";
import { type BatchCell, describeCells, nextCells } from "../../shared/coverage";
import type { QuotaLevel } from "../../shared/topics";
import { ulid } from "../../shared/ulid";
import { coverage } from "./coverage";
import { createProposals } from "./handoff";
import { createHarvest, createSource, getHarvest } from "./harvest";

const TOPICS_SOURCE_KEY = "topics_source_id";

type BatchPayload = { cells: BatchCell[]; harvest_id?: string; request?: HandoffRequest };

// Null when there is nothing to ask: every cell full, or a tapped cell full or with quota 0. The
// exclusions are the whole vault, queued items too: a word already filed under another topic is
// still a duplicate, and one ChatGPT keeps offering would otherwise hold its cell open for good.
export async function issueBatch(
  db: D1Database,
  tapped: { topic: string; level: QuotaLevel } | undefined,
  size: number,
  now: Date,
): Promise<BatchIssueResponse | null> {
  const { counts } = await coverage(db);
  const cells = nextCells(counts, size, tapped);
  if (cells.length === 0) return null;
  const id = ulid(now.getTime());
  const payload: BatchPayload = { cells };
  const [, vault] = await db.batch<{ urdu: string }>([
    db
      .prepare(
        "INSERT INTO handoffs (id, imported_at, payload, status, outcome) VALUES (?, ?, ?, 'batch_issued', NULL)",
      )
      .bind(id, now.toISOString(), JSON.stringify(payload)),
    db.prepare("SELECT urdu FROM vocab ORDER BY added_at ASC, id ASC"),
  ]);
  return { handoff_id: id, cells, exclusions: (vault?.results ?? []).map((r) => r.urdu) };
}

// The Topics source, created on first use and again if it has been deleted.
async function topicsSourceId(db: D1Database, now: Date): Promise<string> {
  const row = await db
    .prepare("SELECT s.id FROM settings st JOIN sources s ON s.id = st.value WHERE st.key = ?")
    .bind(TOPICS_SOURCE_KEY)
    .first<{ id: string }>();
  if (row) return row.id;
  const created = await createSource(
    db,
    { name: "Topics", notes: "Built in: Next batch replies land here, one harvest per batch." },
    now,
  );
  if (!created.ok) throw new Error(`could not create the Topics source: ${created.error}`);
  await db
    .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
    .bind(TOPICS_SOURCE_KEY, created.source.id)
    .run();
  return created.source.id;
}

export type PasteOutcome = BatchPasteResponse | "not_found" | "busy";

async function readBatch(db: D1Database, id: string) {
  const row = await db
    .prepare("SELECT status, payload, outcome FROM handoffs WHERE id = ?")
    .bind(id)
    .first<{ status: string; payload: string; outcome: string | null }>();
  if (!row) return null;
  const payload = JSON.parse(row.payload) as Partial<BatchPayload>;
  return payload.cells ? { status: row.status, payload: payload as BatchPayload, row } : null;
}

function stored(id: string, batch: NonNullable<Awaited<ReturnType<typeof readBatch>>>) {
  return {
    handoff_id: id,
    repeat: true,
    results: JSON.parse(batch.row.outcome ?? "[]") as ProposalResult[],
    harvest_id: batch.payload.harvest_id ?? "",
  } satisfies BatchPasteResponse;
}

// A claim older than this belongs to a paste that died part way (the app closed, the signal went),
// so a new paste may take it over; words the dead one created then report as duplicates.
export const CLAIM_EXPIRY_MS = 60_000;

// The reply to a batch: an unknown id, or one that is not a batch, is not_found. A repeat of an
// applied batch returns its stored outcome. A paste of the same reply already under way is busy.
export async function pasteBatch(
  db: D1Database,
  request: HandoffRequest,
  now: Date,
  activeLadderId: number,
  queued: boolean,
): Promise<PasteOutcome> {
  const id = request.handoff_id;
  const batch = await readBatch(db, id);
  if (!batch) return "not_found";
  if (batch.status === "applied") return stored(id, batch);
  if (batch.status !== "batch_issued" && batch.status !== "batch_pasting") return "busy";

  // Claim the batch, so a double tap imports once. imported_at holds the claim's time.
  const at = now.toISOString();
  const expired = new Date(now.getTime() - CLAIM_EXPIRY_MS).toISOString();
  const claim = await db
    .prepare(
      `UPDATE handoffs SET status = 'batch_pasting', imported_at = ?
       WHERE id = ? AND (status = 'batch_issued' OR (status = 'batch_pasting' AND imported_at < ?))`,
    )
    .bind(at, id, expired)
    .run();
  if (claim.meta.changes === 0) {
    const again = await readBatch(db, id);
    return again?.status === "applied" ? stored(id, again) : "busy";
  }

  try {
    // A paste that died after making its harvest left the id here; reuse that harvest.
    let harvestId = batch.payload.harvest_id;
    if (!harvestId || !(await getHarvest(db, harvestId))) {
      const sourceId = await topicsSourceId(db, now);
      const filter = describeCells(batch.payload.cells);
      const harvest = await createHarvest(db, sourceId, filter, now);
      if (!harvest) throw new Error("the Topics source vanished while pasting");
      harvestId = harvest.id;
      await db
        .prepare("UPDATE handoffs SET payload = ? WHERE id = ?")
        .bind(JSON.stringify({ ...batch.payload, harvest_id: harvestId }), id)
        .run();
    }
    const results = await createProposals(db, request.proposals, now, activeLadderId, {
      harvestId,
      queued,
    });
    const payload: BatchPayload = { ...batch.payload, harvest_id: harvestId, request };
    await db
      .prepare(
        "UPDATE handoffs SET status = 'applied', imported_at = ?, payload = ?, outcome = ? WHERE id = ?",
      )
      .bind(at, JSON.stringify(payload), JSON.stringify(results), id)
      .run();
    return { handoff_id: id, repeat: false, results, harvest_id: harvestId };
  } catch (err) {
    await db
      .prepare(
        "UPDATE handoffs SET status = 'batch_issued' WHERE id = ? AND status = 'batch_pasting'",
      )
      .bind(id)
      .run();
    throw err;
  }
}
