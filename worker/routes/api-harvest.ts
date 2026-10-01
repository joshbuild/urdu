// Harvest routes (f17, FR-K): the Harvest tab's overview, sources, harvests, and pasting new vocab
// into a harvest. Mounted behind requireSession in worker/index.ts.

import { type Context, Hono } from "hono";
import type { ConflictResponse, SourceConflictResponse, SourceRequest } from "../../shared/api";
import { ID_CONFLICT, importHandoff } from "../domain/handoff";
import { parseHandoff } from "../domain/handoff-input";
import {
  createHarvest,
  createSource,
  deleteHarvest,
  deleteSource,
  getHarvest,
  harvestDetail,
  harvestOverview,
  type SourceWrite,
  sourceDetail,
  updateSource,
} from "../domain/harvest";
import { parseHarvest, parseSource } from "../domain/harvest-input";
import { safeTopUp } from "../domain/intake";
import { activeLadderId } from "../domain/settings";
import type { AppEnv } from "../env";
import { invalid, readJson } from "./api-vocab";

export const harvestRoutes = new Hono<AppEnv>();

const notFound = (c: Context<AppEnv>) => c.json({ error: "not_found" }, 404);

function sourceFailure(c: Context<AppEnv>, result: Exclude<SourceWrite, { ok: true }>) {
  if (result.error === "not_found") return notFound(c);
  const body: SourceConflictResponse = {
    error: "duplicate_source",
    existing_id: result.existingId,
  };
  return c.json(body, 409);
}

harvestRoutes.get("/api/harvest", async (c) => {
  await safeTopUp(c.env.DB, new Date(), c.env.HOME_TZ);
  return c.json(await harvestOverview(c.env.DB));
});

harvestRoutes.post("/api/sources", async (c) => {
  const parsed = parseSource(await readJson(c), false);
  if (!parsed.ok) return invalid(c, parsed.error);
  const result = await createSource(c.env.DB, parsed.value as SourceRequest, new Date());
  return result.ok ? c.json(result.source, 201) : sourceFailure(c, result);
});

harvestRoutes.get("/api/sources/:id", async (c) => {
  const detail = await sourceDetail(c.env.DB, c.req.param("id"));
  return detail ? c.json(detail) : notFound(c);
});

harvestRoutes.patch("/api/sources/:id", async (c) => {
  const parsed = parseSource(await readJson(c), true);
  if (!parsed.ok) return invalid(c, parsed.error);
  const result = await updateSource(c.env.DB, c.req.param("id"), parsed.value, new Date());
  return result.ok ? c.json(result.source) : sourceFailure(c, result);
});

harvestRoutes.delete("/api/sources/:id", async (c) => {
  return (await deleteSource(c.env.DB, c.req.param("id"))) ? c.body(null, 204) : notFound(c);
});

harvestRoutes.post("/api/sources/:id/harvests", async (c) => {
  const parsed = parseHarvest(await readJson(c));
  if (!parsed.ok) return invalid(c, parsed.error);
  const harvest = await createHarvest(c.env.DB, c.req.param("id"), parsed.value.filter, new Date());
  return harvest ? c.json(harvest, 201) : notFound(c);
});

harvestRoutes.get("/api/harvests/:id", async (c) => {
  const detail = await harvestDetail(c.env.DB, c.req.param("id"));
  return detail ? c.json(detail) : notFound(c);
});

harvestRoutes.delete("/api/harvests/:id", async (c) => {
  const outcome = await deleteHarvest(c.env.DB, c.req.param("id"));
  if (outcome === "not_found") return notFound(c);
  if (outcome === "not_empty") {
    return c.json({ error: "not_empty", message: "a harvest with words can't be deleted" }, 409);
  }
  return c.body(null, 204);
});

// The FR-F4 paste, into a harvest: created items are linked to it and queued, or released at
// once with ?start=1. A repeated handoff_id returns the stored outcome and links nothing.
harvestRoutes.post("/api/harvests/:id/handoffs", async (c) => {
  const body = await readJson(c);
  if (body === undefined) return invalid(c, { message: "body must be valid JSON" });
  const parsed = parseHandoff(body);
  if (!parsed.ok) return invalid(c, parsed.error);
  const harvest = await getHarvest(c.env.DB, c.req.param("id"));
  if (!harvest) return notFound(c);
  const result = await importHandoff(
    c.env.DB,
    parsed.value,
    new Date(),
    await activeLadderId(c.env.DB),
    { harvestId: harvest.id, queued: c.req.query("start") !== "1" },
  );
  if (result === ID_CONFLICT) {
    const conflict: ConflictResponse = {
      error: "conflict",
      message: "this handoff_id was already used for a different kind of paste",
    };
    return c.json(conflict, 409);
  }
  return c.json(result);
});
