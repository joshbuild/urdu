// The Dash read (f16, FR-J). Mounted behind requireSession in worker/index.ts.

import { Hono } from "hono";
import { readDash } from "../domain/dash";
import { safeTopUp } from "../domain/intake";
import type { AppEnv } from "../env";

export const dashRoutes = new Hono<AppEnv>();

dashRoutes.get("/api/dash", async (c) => {
  c.header("Cache-Control", "no-store");
  const now = new Date();
  await safeTopUp(c.env.DB, now, c.env.HOME_TZ);
  return c.json(await readDash(c.env.DB, now, c.env.HOME_TZ));
});
