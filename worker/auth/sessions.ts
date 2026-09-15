// Per-device sessions (FR-B1, FR-B2). Deleting a row revokes that device.

import { ulid } from "../../shared/ulid";

// last_seen_at is refreshed at most this often, so ordinary requests don't write to D1.
export const LAST_SEEN_INTERVAL_MS = 60 * 60 * 1000;

const MAX_LABEL_LENGTH = 200;

export type SessionRow = { id: string; last_seen_at: string };

export async function createSession(
  db: D1Database,
  tokenHash: string,
  now: Date,
  label: string | null,
): Promise<string> {
  const id = ulid();
  const at = now.toISOString();
  await db
    .prepare(
      "INSERT INTO sessions (id, token_hash, created_at, last_seen_at, label) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(id, tokenHash, at, at, label?.slice(0, MAX_LABEL_LENGTH) ?? null)
    .run();
  return id;
}

export async function findSession(db: D1Database, tokenHash: string): Promise<SessionRow | null> {
  return db
    .prepare("SELECT id, last_seen_at FROM sessions WHERE token_hash = ?")
    .bind(tokenHash)
    .first<SessionRow>();
}

export async function touchSession(db: D1Database, session: SessionRow, now: Date): Promise<void> {
  if (now.getTime() - Date.parse(session.last_seen_at) < LAST_SEEN_INTERVAL_MS) return;
  await db
    .prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?")
    .bind(now.toISOString(), session.id)
    .run();
}

export async function deleteSession(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
}
