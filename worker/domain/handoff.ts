// Clipboard handoffs (f06, FR-F2/F4/F7). The chat proposes; this code decides. Each handoff_id is
// recorded once in `handoffs`, and a repeat returns the stored outcome without writing.

import {
  FILLABLE_FIELDS,
  type FillableField,
  type HandoffRequest,
  type HandoffResponse,
  type HandoffStatus,
  type ProposalResult,
  type RevisionResult,
  type RevisionsRequest,
  type RevisionsResponse,
  type VocabItem,
} from "../../shared/api";
import { urduKey } from "../../shared/normalize";
import { createVocab, toItem, type VocabRow } from "./vocab";

// A handoff_id already used by the other kind of paste is a conflict, not a repeat.
export const ID_CONFLICT = "id_conflict";

export async function storedOutcome<T>(
  db: D1Database,
  id: string,
  status: HandoffStatus,
): Promise<T | typeof ID_CONFLICT | null> {
  const row = await db
    .prepare("SELECT status, outcome FROM handoffs WHERE id = ?")
    .bind(id)
    .first<{ status: string; outcome: string | null }>();
  if (!row) return null;
  if (row.status !== status) return ID_CONFLICT;
  return JSON.parse(row.outcome ?? "[]") as T;
}

// OR IGNORE: if a concurrent paste of the same id got there first, its row stands.
export function recordHandoff(
  db: D1Database,
  id: string,
  payload: unknown,
  status: HandoffStatus,
  outcome: unknown,
  now: Date,
): D1PreparedStatement {
  return db
    .prepare(
      "INSERT OR IGNORE INTO handoffs (id, imported_at, payload, status, outcome) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(id, now.toISOString(), JSON.stringify(payload), status, JSON.stringify(outcome));
}

// FR-F2: each proposal is created on the active ladder's first rung with source coach, or
// reported as a duplicate. A proposal duplicating an earlier one in the same payload meets the
// item that one just created.
export async function importHandoff(
  db: D1Database,
  request: HandoffRequest,
  now: Date,
  activeLadderId: number,
): Promise<HandoffResponse | typeof ID_CONFLICT> {
  const stored = await storedOutcome<ProposalResult[]>(db, request.handoff_id, "applied");
  if (stored === ID_CONFLICT) return stored;
  if (stored) return { handoff_id: request.handoff_id, repeat: true, results: stored };

  const results: ProposalResult[] = [];
  for (const [index, proposal] of request.proposals.entries()) {
    const urdu = proposal.urdu;
    const result = await createVocab(db, { ...proposal, source: "coach" }, now, activeLadderId);
    if (result.ok) {
      results.push({ index, urdu, outcome: "created", id: result.item.id });
    } else if (result.error === "duplicate") {
      results.push({ index, urdu, outcome: "duplicate", existing_id: result.existingId });
    } else {
      results.push({
        index,
        urdu,
        outcome: "rejected",
        reason: "must contain Urdu letters, not only punctuation",
      });
    }
  }
  await recordHandoff(db, request.handoff_id, request, "applied", results, now).run();
  return { handoff_id: request.handoff_id, repeat: false, results };
}

function planRevision(
  revision: RevisionsRequest["revisions"][number],
  item: VocabItem | undefined,
): RevisionResult {
  const { vocab_id, urdu } = revision;
  if (!item) return { vocab_id, urdu, outcome: "rejected", reason: "no item has this id" };
  // Compared by key, so a reply that drops or adds tashkeel still matches its item.
  if (urduKey(urdu) !== item.urdu_key) {
    return {
      vocab_id,
      urdu,
      outcome: "rejected",
      reason: `urdu does not match the stored item (${item.urdu})`,
    };
  }
  const fills: Partial<Record<FillableField, string>> = {};
  const kept: FillableField[] = [];
  for (const field of FILLABLE_FIELDS) {
    const value = revision[field];
    if (value == null) continue;
    if (item[field] === null) fills[field] = value;
    else kept.push(field);
  }
  return Object.keys(fills).length > 0
    ? { vocab_id, urdu, outcome: "fill", fills, kept }
    : { vocab_id, urdu, outcome: "nothing", kept };
}

// FR-F7: fills empty fields only. The schedule and review history are untouched. A preview
// computes the same results and writes nothing, not even the handoff row.
export async function reviseVocab(
  db: D1Database,
  request: RevisionsRequest,
  now: Date,
  preview: boolean,
): Promise<RevisionsResponse | typeof ID_CONFLICT> {
  const { handoff_id } = request;
  const stored = await storedOutcome<RevisionResult[]>(db, handoff_id, "revised");
  if (stored === ID_CONFLICT) return stored;
  if (stored) return { handoff_id, preview, repeat: true, results: stored };

  const ids = request.revisions.map((r) => r.vocab_id);
  const { results: rows } = await db
    .prepare(`SELECT * FROM vocab WHERE id IN (${ids.map(() => "?").join(", ")})`)
    .bind(...ids)
    .all<VocabRow>();
  const byId = new Map(rows.map((row) => [row.id, toItem(row)]));
  const results = request.revisions.map((r) => planRevision(r, byId.get(r.vocab_id)));
  if (preview) return { handoff_id, preview, repeat: false, results };

  const at = now.toISOString();
  // COALESCE keeps any text written since the plan was made: empty-only holds even in a race.
  const updates = results.flatMap((r) => {
    if (r.outcome !== "fill") return [];
    const fields = Object.keys(r.fills) as FillableField[];
    const sets = fields.map((f) => `${f} = COALESCE(${f}, ?)`).join(", ");
    return [
      db
        .prepare(`UPDATE vocab SET ${sets}, updated_at = ? WHERE id = ?`)
        .bind(...fields.map((f) => r.fills[f]), at, r.vocab_id),
    ];
  });
  await db.batch([...updates, recordHandoff(db, handoff_id, request, "revised", results, now)]);
  return { handoff_id, preview, repeat: false, results };
}

const MISSING = FILLABLE_FIELDS.map((f) => `${f} IS NULL`).join(" OR ");

// Items lacking any fillable field. Those missing Roman or English come first: they matter most
// for review.
export async function incompleteVocab(
  db: D1Database,
  limit: number,
): Promise<{ items: VocabItem[]; total: number }> {
  const [rows, count] = await db.batch([
    db
      .prepare(
        `SELECT * FROM vocab WHERE ${MISSING}
         ORDER BY (roman IS NULL OR english IS NULL) DESC, added_at ASC, id ASC LIMIT ?`,
      )
      .bind(limit),
    db.prepare(`SELECT count(*) AS n FROM vocab WHERE ${MISSING}`),
  ]);
  const items = (rows?.results ?? []) as VocabRow[];
  const total = (count?.results[0] as { n: number } | undefined)?.n ?? 0;
  return { items: items.map(toItem), total };
}
