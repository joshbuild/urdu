// Intake routes (f17, FR-K): Intake on the Review start screen and Release now on a queued item.
// Mounted behind requireSession in worker/index.ts.

import { Hono } from "hono";
import type { IntakeReleaseResponse } from "../../shared/api";
import { intakeBatchSize, isBatchSize, releaseNext, releaseOne } from "../domain/intake";
import { isRecord } from "../domain/vocab-input";
import type { AppEnv } from "../env";
import { invalid, readJson } from "./api-vocab";

export const intakeRoutes = new Hono<AppEnv>();

// Body {count?}: 1–50, default the batch size. Ignores the day's top-up claim.
intakeRoutes.post("/api/intake/release", async (c) => {
  const body = await readJson(c);
  if (!isRecord(body)) return invalid(c, { message: "body must be a JSON object" });
  for (const key of Object.keys(body)) {
    if (key !== "count") return invalid(c, { field: key, message: "is not a recognised field" });
  }
  if ("count" in body && !isBatchSize(body.count)) {
    return invalid(c, { field: "count", message: "must be a whole number from 1 to 50" });
  }
  const count = (body.count as number | undefined) ?? (await intakeBatchSize(c.env.DB));
  const result: IntakeReleaseResponse = await releaseNext(c.env.DB, count, new Date());
  return c.json(result);
});

intakeRoutes.post("/api/vocab/:id/release", async (c) => {
  const item = await releaseOne(c.env.DB, c.req.param("id"), new Date());
  return item ? c.json(item) : c.json({ error: "not_found" }, 404);
});
