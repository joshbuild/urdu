// Clipboard handoffs (f06, FR-F2/F4). The chat proposes; this code decides. Each handoff_id is
// recorded once in `handoffs`, and a repeat returns the stored outcome without writing.

import type {
  HandoffProposal,
  HandoffRequest,
  HandoffResponse,
  HandoffStatus,
  ProposalResult,
} from "../../shared/api";
import { type CreateOptions, createVocab } from "./vocab";

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

// FR-F2: each proposal is created on the active ladder's entry rung with source coach, or
// reported as a duplicate. A proposal duplicating an earlier one in the same payload meets the
// item that one just created. f17: a paste into a harvest links what it creates and queues it
// unless started now; a duplicate keeps whatever harvest it already has.
export async function importHandoff(
  db: D1Database,
  request: HandoffRequest,
  now: Date,
  activeLadderId: number,
  options: CreateOptions = {},
): Promise<HandoffResponse | typeof ID_CONFLICT> {
  const stored = await storedOutcome<ProposalResult[]>(db, request.handoff_id, "applied");
  if (stored === ID_CONFLICT) return stored;
  if (stored) return { handoff_id: request.handoff_id, repeat: true, results: stored };

  const results = await createProposals(db, request.proposals, now, activeLadderId, options);
  await recordHandoff(db, request.handoff_id, request, "applied", results, now).run();
  return { handoff_id: request.handoff_id, repeat: false, results };
}

// Each proposal created, or reported as a duplicate or rejected; shared with the f18 batch paste.
export async function createProposals(
  db: D1Database,
  proposals: readonly HandoffProposal[],
  now: Date,
  activeLadderId: number,
  options: CreateOptions = {},
): Promise<ProposalResult[]> {
  const results: ProposalResult[] = [];
  for (const [index, proposal] of proposals.entries()) {
    const { dropped, ...fields } = proposal;
    const urdu = fields.urdu;
    const result = await createVocab(
      db,
      { ...fields, source: "coach" },
      now,
      activeLadderId,
      options,
    );
    if (result.ok) {
      results.push({
        index,
        urdu,
        outcome: "created",
        id: result.item.id,
        ...(dropped ? { dropped } : {}),
      });
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
  return results;
}
