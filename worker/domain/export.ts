// Full-vault JSON export (PRD §6 Portability). Sessions are auth state, not vault data, and
// are left out. Read-only, so it never changes updated_at or review dates (FR-A8).

import type { ExportResponse, Handoff, ReviewEvent, Tag } from "../../shared/api";
import { LADDERS } from "../../shared/ladders";
import { activeLadderId } from "./settings";
import { toItem, type VocabRow } from "./vocab";

type HandoffRow = Omit<Handoff, "payload" | "outcome"> & {
  payload: string;
  outcome: string | null;
};

export async function exportVault(db: D1Database, now: Date): Promise<ExportResponse> {
  const [vocab, events, tags, handoffs] = await db.batch([
    db.prepare("SELECT * FROM vocab ORDER BY added_at ASC, id ASC"),
    db.prepare("SELECT * FROM review_events ORDER BY reviewed_at ASC, id ASC"),
    db.prepare("SELECT * FROM tags ORDER BY name ASC"),
    db.prepare("SELECT * FROM handoffs ORDER BY imported_at ASC, id ASC"),
  ]);
  return {
    exported_at: now.toISOString(),
    ladders: LADDERS,
    active_ladder_id: await activeLadderId(db),
    vocab: ((vocab?.results ?? []) as VocabRow[]).map(toItem),
    review_events: (events?.results ?? []) as ReviewEvent[],
    tags: (tags?.results ?? []) as Tag[],
    handoffs: ((handoffs?.results ?? []) as HandoffRow[]).map((row) => ({
      ...row,
      payload: JSON.parse(row.payload) as unknown,
      outcome: row.outcome === null ? null : (JSON.parse(row.outcome) as unknown),
    })),
  };
}
