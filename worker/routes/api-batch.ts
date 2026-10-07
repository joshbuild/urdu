// Next batch routes (f18, FR-L): issue a batch request, and paste its ChatGPT reply into a new
// harvest of the Topics source. Mounted behind requireSession in worker/index.ts.

import { Hono } from "hono";
import type { ConflictResponse } from "../../shared/api";
import { QUOTA_LEVELS, type QuotaLevel, topicSlug } from "../../shared/topics";
import { issueBatch, pasteBatch } from "../domain/batch";
import { parseHandoff } from "../domain/handoff-input";
import { activeLadderId } from "../domain/settings";
import { isRecord } from "../domain/vocab-input";
import type { AppEnv } from "../env";
import { invalid, readJson } from "./api-vocab";

export const batchRoutes = new Hono<AppEnv>();

// Body {} for Next batch, or {topic, level} for a tapped cell.
batchRoutes.post("/api/batches", async (c) => {
  const body = await readJson(c);
  if (!isRecord(body)) return invalid(c, { message: "body must be a JSON object" });
  const extra = Object.keys(body).find((key) => key !== "topic" && key !== "level");
  if (extra) return invalid(c, { field: extra, message: "is not a recognised field" });
  let tapped: { topic: string; level: QuotaLevel } | undefined;
  if ("topic" in body || "level" in body) {
    const topic = topicSlug(body.topic);
    if (topic === null) return invalid(c, { field: "topic", message: "is not a known topic" });
    const level = typeof body.level === "string" ? body.level.trim().toUpperCase() : "";
    if (!(QUOTA_LEVELS as readonly string[]).includes(level)) {
      return invalid(c, { field: "level", message: `must be one of ${QUOTA_LEVELS.join(", ")}` });
    }
    tapped = { topic, level: level as QuotaLevel };
  }
  const batch = await issueBatch(c.env.DB, tapped, new Date());
  if (!batch) {
    return c.json(
      { error: "nothing_to_ask", message: "every cell asked for is already at its target" },
      409,
    );
  }
  return c.json(batch);
});

// The FR-F4 reply; its handoff_id names the batch. Queued unless ?start=1, as f17.
batchRoutes.post("/api/batches/handoffs", async (c) => {
  const body = await readJson(c);
  if (body === undefined) return invalid(c, { message: "body must be valid JSON" });
  const parsed = parseHandoff(body);
  if (!parsed.ok) return invalid(c, parsed.error);
  const result = await pasteBatch(
    c.env.DB,
    parsed.value,
    new Date(),
    await activeLadderId(c.env.DB),
    c.req.query("start") !== "1",
  );
  if (result === "not_found") {
    return c.json(
      { error: "not_found", message: "this reply's handoff_id is not a Next batch request" },
      404,
    );
  }
  if (result === "busy") {
    const conflict: ConflictResponse = {
      error: "conflict",
      message: "this batch is being pasted already; try again in a moment",
    };
    return c.json(conflict, 409);
  }
  return c.json(result);
});
