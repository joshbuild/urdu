// Sources and harvests (f17, FR-K). A source is a story or page; its URL, when set, is its
// identity. A harvest is one pass over a source at a filter, and links the items its pastes
// created. Deletes are explicit here in one batch, so they don't depend on the FK pragma; unlinking
// an item is not an edit, so its updated_at stays put.

import type {
  Harvest,
  HarvestDetail,
  HarvestOverview,
  HarvestSummary,
  Source,
  SourceDetail,
  SourceRequest,
  SourceSummary,
} from "../../shared/api";
import { ulid } from "../../shared/ulid";
import { intakeCounts } from "./intake";

export type SourceWrite =
  | { ok: true; source: Source }
  | { ok: false; error: "duplicate_source"; existingId: string }
  | { ok: false; error: "not_found" };

async function sourceIdByUrl(db: D1Database, url: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT id FROM sources WHERE url = ?")
    .bind(url)
    .first<{ id: string }>();
  return row?.id ?? null;
}

export async function getSource(db: D1Database, id: string): Promise<Source | null> {
  return db.prepare("SELECT * FROM sources WHERE id = ?").bind(id).first<Source>();
}

// A concurrent write can take the URL between the check and the write; the unique index catches
// it, and we report the same conflict.
async function urlRace(db: D1Database, url: string | null, err: unknown): Promise<SourceWrite> {
  if (!(err instanceof Error && err.message.includes("UNIQUE constraint failed: sources.url")))
    throw err;
  const existingId = url === null ? null : await sourceIdByUrl(db, url);
  if (!existingId) throw err;
  return { ok: false, error: "duplicate_source", existingId };
}

export async function createSource(
  db: D1Database,
  input: SourceRequest,
  now: Date,
): Promise<SourceWrite> {
  const url = input.url ?? null;
  if (url !== null) {
    const existingId = await sourceIdByUrl(db, url);
    if (existingId) return { ok: false, error: "duplicate_source", existingId };
  }
  const at = now.toISOString();
  const source: Source = {
    id: ulid(now.getTime()),
    name: input.name,
    url,
    notes: input.notes ?? null,
    created_at: at,
    updated_at: at,
  };
  try {
    await db
      .prepare(
        "INSERT INTO sources (id, name, url, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(source.id, source.name, source.url, source.notes, at, at)
      .run();
  } catch (err) {
    return urlRace(db, url, err);
  }
  return { ok: true, source };
}

export async function updateSource(
  db: D1Database,
  id: string,
  changes: Partial<SourceRequest>,
  now: Date,
): Promise<SourceWrite> {
  const current = await getSource(db, id);
  if (!current) return { ok: false, error: "not_found" };
  const next: Source = { ...current, ...changes, updated_at: now.toISOString() };
  if (next.url !== null && next.url !== current.url) {
    const existingId = await sourceIdByUrl(db, next.url);
    if (existingId && existingId !== id) {
      return { ok: false, error: "duplicate_source", existingId };
    }
  }
  try {
    await db
      .prepare("UPDATE sources SET name = ?, url = ?, notes = ?, updated_at = ? WHERE id = ?")
      .bind(next.name, next.url, next.notes, next.updated_at, id)
      .run();
  } catch (err) {
    return urlRace(db, next.url, err);
  }
  return { ok: true, source: next };
}

// Deletes the source and its harvests; their items stay in the vault, unlinked.
export async function deleteSource(db: D1Database, id: string): Promise<boolean> {
  const [, , deleted] = await db.batch([
    db
      .prepare(
        "UPDATE vocab SET harvest_id = NULL WHERE harvest_id IN (SELECT id FROM harvests WHERE source_id = ?)",
      )
      .bind(id),
    db.prepare("DELETE FROM harvests WHERE source_id = ?").bind(id),
    db.prepare("DELETE FROM sources WHERE id = ?").bind(id),
  ]);
  return (deleted?.meta.changes ?? 0) > 0;
}

export async function createHarvest(
  db: D1Database,
  sourceId: string,
  filter: string | null,
  now: Date,
): Promise<Harvest | null> {
  const harvest: Harvest = {
    id: ulid(now.getTime()),
    source_id: sourceId,
    filter,
    created_at: now.toISOString(),
  };
  const inserted = await db
    .prepare(
      `INSERT INTO harvests (id, source_id, filter, created_at)
       SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM sources WHERE id = ?)`,
    )
    .bind(harvest.id, sourceId, filter, harvest.created_at, sourceId)
    .run();
  return inserted.meta.changes > 0 ? harvest : null;
}

export async function getHarvest(db: D1Database, id: string): Promise<Harvest | null> {
  return db.prepare("SELECT * FROM harvests WHERE id = ?").bind(id).first<Harvest>();
}

// A harvest can be deleted only while no item links to it.
export async function deleteHarvest(
  db: D1Database,
  id: string,
): Promise<"deleted" | "not_found" | "not_empty"> {
  const result = await db
    .prepare(
      "DELETE FROM harvests WHERE id = ?1 AND NOT EXISTS (SELECT 1 FROM vocab WHERE harvest_id = ?1)",
    )
    .bind(id)
    .run();
  if (result.meta.changes > 0) return "deleted";
  return (await getHarvest(db, id)) ? "not_empty" : "not_found";
}

const HARVEST_COUNTS = `
  (SELECT count(*) FROM vocab WHERE harvest_id = h.id) AS total,
  (SELECT count(*) FROM vocab WHERE harvest_id = h.id AND released_at IS NULL) AS queued,
  (SELECT count(*) FROM vocab WHERE harvest_id = h.id AND last_reviewed_at IS NOT NULL) AS started`;

export async function harvestDetail(db: D1Database, id: string): Promise<HarvestDetail | null> {
  const harvest = await db
    .prepare(`SELECT h.*, ${HARVEST_COUNTS} FROM harvests h WHERE h.id = ?`)
    .bind(id)
    .first<HarvestSummary>();
  if (!harvest) return null;
  const source = await getSource(db, harvest.source_id);
  return source ? { harvest, source } : null;
}

export async function sourceDetail(db: D1Database, id: string): Promise<SourceDetail | null> {
  const source = await getSource(db, id);
  if (!source) return null;
  const { results } = await db
    .prepare(
      `SELECT h.*, ${HARVEST_COUNTS} FROM harvests h WHERE h.source_id = ?
       ORDER BY h.created_at DESC, h.id DESC`,
    )
    .bind(id)
    .all<HarvestSummary>();
  const words = results.reduce((sum, h) => sum + h.total, 0);
  return { source, harvests: results, words };
}

type OverviewRow = Source & {
  harvest_count: number;
  latest_at: string | null;
  latest_filter: string | null;
};

// To-harvest sources (no harvests) first, newest first; then harvested sources by latest harvest,
// newest first.
export async function harvestOverview(db: D1Database): Promise<HarvestOverview> {
  const latest = `SELECT %s FROM harvests h WHERE h.source_id = s.id
    ORDER BY h.created_at DESC, h.id DESC LIMIT 1`;
  const [{ results }, intake] = await Promise.all([
    db
      .prepare(
        `SELECT s.*,
           (SELECT count(*) FROM harvests h WHERE h.source_id = s.id) AS harvest_count,
           (${latest.replace("%s", "h.created_at")}) AS latest_at,
           (${latest.replace("%s", "h.filter")}) AS latest_filter
         FROM sources s
         ORDER BY latest_at IS NOT NULL, latest_at DESC, s.created_at DESC, s.id DESC`,
      )
      .all<OverviewRow>(),
    intakeCounts(db),
  ]);
  const sources: SourceSummary[] = results.map(
    ({ harvest_count, latest_at, latest_filter, ...source }) => ({
      ...source,
      status: harvest_count > 0 ? "harvested" : "to_harvest",
      harvest_count,
      latest: latest_at === null ? null : { filter: latest_filter, created_at: latest_at },
    }),
  );
  return { intake, sources };
}
