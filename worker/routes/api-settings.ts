// Settings routes (f09). Mounted behind requireSession in worker/index.ts.

import { Hono } from "hono";
import type { SettingsResponse } from "../../shared/api";
import { isSelectableLadderId, LADDERS } from "../../shared/ladders";
import { activeLadderId, setActiveLadderId } from "../domain/settings";
import type { AppEnv } from "../env";
import { invalid, readJson } from "./api-vocab";

export const settingsRoutes = new Hono<AppEnv>();

settingsRoutes.get("/api/settings", async (c) => {
  const body: SettingsResponse = { active_ladder_id: await activeLadderId(c.env.DB) };
  return c.json(body);
});

settingsRoutes.patch("/api/settings", async (c) => {
  const body = await readJson(c);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return invalid(c, { message: "body must be a JSON object" });
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== "active_ladder_id")
      return invalid(c, { field: key, message: "is not a recognised field" });
  }
  if (!isSelectableLadderId(record.active_ladder_id)) {
    const ids = LADDERS.filter((l) => l.selectable).map((l) => l.id);
    return invalid(c, { field: "active_ladder_id", message: `must be one of ${ids.join(", ")}` });
  }
  // Switching rewrites no due time; items move to the new ladder at their next review.
  await setActiveLadderId(c.env.DB, record.active_ladder_id);
  const response: SettingsResponse = { active_ladder_id: record.active_ladder_id };
  return c.json(response);
});
