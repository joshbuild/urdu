// Vocab, due and status routes (FR-A5..A8). Mounted behind requireSession in worker/index.ts.

import { type Context, Hono } from "hono";
import {
  type CoverageResponse,
  type DueResponse,
  type DuplicateResponse,
  type InvalidRequestResponse,
  type MatchResponse,
  type StatusResponse,
  type TagsResponse,
  type UpcomingResponse,
  VOCAB_SORTS,
  type VocabListResponse,
  type VocabSort,
} from "../../shared/api";
import { todayIn } from "../../shared/dates";
import { addSeconds } from "../../shared/ladders";
import { cefrLevel, topicSlug } from "../../shared/topics";
import { coverage } from "../domain/coverage";
import { intakeCounts, safeTopUp } from "../domain/intake";
import { activeLadderId } from "../domain/settings";
import {
  createVocab,
  deleteVocab,
  dueVocab,
  getVocab,
  listTags,
  listVocab,
  matchVocab,
  upcomingDueTimes,
  updateVocab,
  type VocabFilter,
  vocabCounts,
  type WriteResult,
} from "../domain/vocab";
import { type InputError, parseCreate, parseMatch, parseUpdate } from "../domain/vocab-input";
import type { AppEnv } from "../env";

export const DEFAULT_LIST_LIMIT = 50;
export const DEFAULT_DUE_LIMIT = 20;
export const MAX_LIMIT = 200;
// Review ahead reaches at most a year (mp03 takes it in seconds; f05 took whole days).
export const MAX_AHEAD_SECONDS = 365 * 86_400;

type Ctx = Context<AppEnv>;

// "today" labels the day in the home timezone; due checks compare exact instants.
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
    case "tag_is_topic":
      return invalid(c, { field: "tags", message: "must not repeat the item's topic" });
    case "bad_step":
      return invalid(c, {
        field: "ladder_step",
        message: `must be an integer from 0 to ${result.maxStep} on the active ladder`,
      });
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

const isError = (v: unknown): v is InputError =>
  typeof v === "object" && v !== null && "message" in v;

// f18: ?tag=, ?topic= and ?cefr=; a topic or level that is given must be known.
function filterParams(c: Ctx): VocabFilter | InputError {
  const filter: VocabFilter = { tag: tagParam(c) };
  const topic = c.req.query("topic")?.trim();
  if (topic) {
    const slug = topicSlug(topic);
    if (slug === null) return { field: "topic", message: "is not a known topic" };
    filter.topic = slug;
  }
  const cefr = c.req.query("cefr")?.trim();
  if (cefr) {
    const level = cefrLevel(cefr);
    if (level === null) return { field: "cefr", message: "must be one of A1, A2, B1, B2, C1, C2" };
    filter.cefr = level;
  }
  return filter;
}

export const vocabRoutes = new Hono<AppEnv>();

vocabRoutes.get("/api/status", async (c) => {
  const now = new Date();
  await safeTopUp(c.env.DB, now, c.env.HOME_TZ);
  const counts = await vocabCounts(c.env.DB, now.toISOString());
  const body: StatusResponse = {
    ...counts,
    today: today(c),
    active_ladder_id: await activeLadderId(c.env.DB),
    intake: await intakeCounts(c.env.DB),
  };
  return c.json(body);
});

vocabRoutes.get("/api/coverage", async (c) => {
  const body: CoverageResponse = await coverage(c.env.DB);
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
  const result = await createVocab(
    c.env.DB,
    parsed.value,
    new Date(),
    await activeLadderId(c.env.DB),
  );
  return result.ok ? c.json(result.item, 201) : writeFailure(c, result);
});

// f14 (FR-F10): which words of a pasted list are already in the vault. Writes nothing; POST
// because a 500-word list does not fit a URL.
vocabRoutes.post("/api/vocab/match", async (c) => {
  const body = await readJson(c);
  if (body === undefined) return invalid(c, { message: "body must be valid JSON" });
  const parsed = parseMatch(body);
  if (!parsed.ok) return invalid(c, parsed.error);
  const response: MatchResponse = { results: await matchVocab(c.env.DB, parsed.value.words) };
  return c.json(response);
});

vocabRoutes.get("/api/vocab", async (c) => {
  const limit = intParam(c, "limit", DEFAULT_LIST_LIMIT, 1, MAX_LIMIT);
  if (isError(limit)) return invalid(c, limit);
  const offset = intParam(c, "offset", 0, 0, Number.MAX_SAFE_INTEGER);
  if (isError(offset)) return invalid(c, offset);
  const due = boolParam(c, "due");
  if (isError(due)) return invalid(c, due);
  const queued = boolParam(c, "queued");
  if (isError(queued)) return invalid(c, queued);
  const sort = c.req.query("sort") ?? "added";
  if (!(VOCAB_SORTS as readonly string[]).includes(sort)) {
    return invalid(c, { field: "sort", message: `must be one of ${VOCAB_SORTS.join(", ")}` });
  }
  const filter = filterParams(c);
  if (isError(filter)) return invalid(c, filter);

  const result = await listVocab(
    c.env.DB,
    {
      q: c.req.query("q"),
      ...filter,
      due,
      queued,
      sort: sort as VocabSort,
      limit,
      offset,
    },
    new Date().toISOString(),
  );
  const body: VocabListResponse = result;
  return c.json(body);
});

// Registered before /api/vocab/:id so "due" is not read as an id.
vocabRoutes.get("/api/vocab/due", async (c) => {
  const limit = intParam(c, "limit", DEFAULT_DUE_LIMIT, 1, MAX_LIMIT);
  if (isError(limit)) return invalid(c, limit);
  // Review ahead (f05, by the second since mp03): also take items falling due within that span.
  const ahead = intParam(c, "ahead_seconds", 0, 0, MAX_AHEAD_SECONDS);
  if (isError(ahead)) return invalid(c, ahead);
  const filter = filterParams(c);
  if (isError(filter)) return invalid(c, filter);
  const now = new Date();
  await safeTopUp(c.env.DB, now, c.env.HOME_TZ);
  const cutoff = addSeconds(now.toISOString(), ahead);
  const body: DueResponse = {
    items: await dueVocab(c.env.DB, cutoff, limit, filter),
    today: today(c),
  };
  return c.json(body);
});

// mp03: what each review-ahead stop would add. Registered before /api/vocab/:id.
vocabRoutes.get("/api/vocab/upcoming", async (c) => {
  const now = new Date().toISOString();
  const body: UpcomingResponse = {
    now,
    due_at: await upcomingDueTimes(c.env.DB, now, addSeconds(now, MAX_AHEAD_SECONDS)),
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
  const result = await updateVocab(
    c.env.DB,
    c.req.param("id"),
    parsed.value,
    new Date(),
    await activeLadderId(c.env.DB),
  );
  return result.ok ? c.json(result.item) : writeFailure(c, result);
});

vocabRoutes.delete("/api/vocab/:id", async (c) => {
  const deleted = await deleteVocab(c.env.DB, c.req.param("id"));
  return deleted ? c.json({ ok: true }) : c.json({ error: "not_found" }, 404);
});
