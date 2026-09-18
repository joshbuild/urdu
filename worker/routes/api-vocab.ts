// Vocab, due and status routes (FR-A5..A8). Mounted behind requireSession in worker/index.ts.

import { type Context, Hono } from "hono";
import {
  type DueResponse,
  type DuplicateResponse,
  type InvalidRequestResponse,
  type StatusResponse,
  type TagsResponse,
  VOCAB_SORTS,
  type VocabListResponse,
  type VocabSort,
} from "../../shared/api";
import { todayIn } from "../../shared/dates";
import {
  createVocab,
  deleteVocab,
  dueVocab,
  getVocab,
  listTags,
  listVocab,
  updateVocab,
  vocabCounts,
  type WriteResult,
} from "../domain/vocab";
import { type InputError, parseCreate, parseUpdate } from "../domain/vocab-input";
import type { AppEnv } from "../env";

export const DEFAULT_LIST_LIMIT = 50;
export const DEFAULT_DUE_LIMIT = 20;
export const MAX_LIMIT = 200;

type Ctx = Context<AppEnv>;

export const today = (c: Ctx) => todayIn(c.env.HOME_TZ, new Date());

export function invalid(c: Ctx, error: InputError) {
  const body: InvalidRequestResponse = { error: "invalid_request", ...error };
  return c.json(body, 400);
}

function writeFailure(c: Ctx, result: Exclude<WriteResult, { ok: true }>) {
  switch (result.error) {
    case "duplicate": {
      const body: DuplicateResponse = { error: "duplicate", existing_id: result.existingId };
      return c.json(body, 409);
    }
    case "empty_key":
      return invalid(c, {
        field: "urdu",
        message: "must contain Urdu letters, not only punctuation",
      });
    case "not_found":
      return c.json({ error: "not_found" }, 404);
  }
}

export async function readJson(c: Ctx): Promise<unknown> {
  return c.req.json<unknown>().catch(() => undefined);
}

function intParam(
  c: Ctx,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number | InputError {
  const raw = c.req.query(name);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!/^\d+$/.test(raw) || n < min || n > max) {
    return { field: name, message: `must be an integer from ${min} to ${max}` };
  }
  return n;
}

function boolParam(c: Ctx, name: string): boolean | InputError {
  const raw = c.req.query(name);
  if (raw === undefined || raw === "false" || raw === "0") return false;
  if (raw === "true" || raw === "1") return true;
  return { field: name, message: "must be true or false" };
}

function tagParam(c: Ctx): string | undefined {
  const tag = c.req.query("tag")?.trim();
  return tag === "" ? undefined : tag;
}

const isError = (v: unknown): v is InputError => typeof v === "object" && v !== null;

export const vocabRoutes = new Hono<AppEnv>();

vocabRoutes.get("/api/status", async (c) => {
  const day = today(c);
  const counts = await vocabCounts(c.env.DB, day);
  const body: StatusResponse = { ...counts, today: day };
  return c.json(body);
});

vocabRoutes.get("/api/tags", async (c) => {
  const body: TagsResponse = { tags: await listTags(c.env.DB) };
  return c.json(body);
});

vocabRoutes.post("/api/vocab", async (c) => {
  const body = await readJson(c);
  if (body === undefined) return invalid(c, { message: "body must be valid JSON" });
  const parsed = parseCreate(body);
  if (!parsed.ok) return invalid(c, parsed.error);
  const result = await createVocab(c.env.DB, parsed.value, new Date());
  return result.ok ? c.json(result.item, 201) : writeFailure(c, result);
});

vocabRoutes.get("/api/vocab", async (c) => {
  const limit = intParam(c, "limit", DEFAULT_LIST_LIMIT, 1, MAX_LIMIT);
  if (isError(limit)) return invalid(c, limit);
  const offset = intParam(c, "offset", 0, 0, Number.MAX_SAFE_INTEGER);
  if (isError(offset)) return invalid(c, offset);
  const due = boolParam(c, "due");
  if (isError(due)) return invalid(c, due);
  const sort = c.req.query("sort") ?? "added";
  if (!(VOCAB_SORTS as readonly string[]).includes(sort)) {
    return invalid(c, { field: "sort", message: `must be one of ${VOCAB_SORTS.join(", ")}` });
  }

  const result = await listVocab(
    c.env.DB,
    { q: c.req.query("q"), tag: tagParam(c), due, sort: sort as VocabSort, limit, offset },
    today(c),
  );
  const body: VocabListResponse = result;
  return c.json(body);
});

// Registered before /api/vocab/:id so "due" is not read as an id.
vocabRoutes.get("/api/vocab/due", async (c) => {
  const limit = intParam(c, "limit", DEFAULT_DUE_LIMIT, 1, MAX_LIMIT);
  if (isError(limit)) return invalid(c, limit);
  const day = today(c);
  const body: DueResponse = {
    items: await dueVocab(c.env.DB, day, limit, tagParam(c)),
    today: day,
  };
  return c.json(body);
});

vocabRoutes.get("/api/vocab/:id", async (c) => {
  const item = await getVocab(c.env.DB, c.req.param("id"));
  return item ? c.json(item) : c.json({ error: "not_found" }, 404);
});

vocabRoutes.patch("/api/vocab/:id", async (c) => {
  const body = await readJson(c);
  if (body === undefined) return invalid(c, { message: "body must be valid JSON" });
  const parsed = parseUpdate(body);
  if (!parsed.ok) return invalid(c, parsed.error);
  const result = await updateVocab(c.env.DB, c.req.param("id"), parsed.value, new Date());
  return result.ok ? c.json(result.item) : writeFailure(c, result);
});

vocabRoutes.delete("/api/vocab/:id", async (c) => {
  const deleted = await deleteVocab(c.env.DB, c.req.param("id"));
  return deleted ? c.json({ ok: true }) : c.json({ error: "not_found" }, 404);
});
