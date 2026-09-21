// Settings routes (f09 ladder, f07 s04 voice spend caps). Mounted behind requireSession in
// worker/index.ts. PATCH is partial: only the fields present are written.

import { Hono } from "hono";
import type { SettingsResponse } from "../../shared/api";
import { isSelectableLadderId, LADDERS } from "../../shared/ladders";
import { isCapUsd, MAX_CAP_USD, MIN_CAP_USD } from "../../shared/voice-cost";
import { activeLadderId, setActiveLadderId } from "../domain/settings";
import { setVoiceCap, voiceCaps } from "../domain/voice-spend";
import type { AppEnv } from "../env";
import { invalid, readJson } from "./api-vocab";

export const settingsRoutes = new Hono<AppEnv>();

async function currentSettings(db: D1Database): Promise<SettingsResponse> {
  const [active_ladder_id, caps] = await Promise.all([activeLadderId(db), voiceCaps(db)]);
  return {
    active_ladder_id,
    voice_soft_cap_usd: caps.soft_cap_usd,
    voice_hard_cap_usd: caps.hard_cap_usd,
  };
}

const CAP_FIELDS = ["voice_soft_cap_usd", "voice_hard_cap_usd"] as const;
const FIELDS = ["active_ladder_id", ...CAP_FIELDS] as const;

settingsRoutes.get("/api/settings", async (c) => c.json(await currentSettings(c.env.DB)));

settingsRoutes.patch("/api/settings", async (c) => {
  const body = await readJson(c);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return invalid(c, { message: "body must be a JSON object" });
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!(FIELDS as readonly string[]).includes(key))
      return invalid(c, { field: key, message: "is not a recognised field" });
  }

  if ("active_ladder_id" in record) {
    if (!isSelectableLadderId(record.active_ladder_id)) {
      const ids = LADDERS.filter((l) => l.selectable).map((l) => l.id);
      return invalid(c, { field: "active_ladder_id", message: `must be one of ${ids.join(", ")}` });
    }
  }
  for (const field of CAP_FIELDS) {
    if (field in record && !isCapUsd(record[field])) {
      return invalid(c, {
        field,
        message: `must be a dollar amount from ${MIN_CAP_USD} to ${MAX_CAP_USD}`,
      });
    }
  }
  // A hard cap under the soft cap would warn only after the session was already refused.
  const caps = await voiceCaps(c.env.DB);
  const soft = (record.voice_soft_cap_usd as number | undefined) ?? caps.soft_cap_usd;
  const hard = (record.voice_hard_cap_usd as number | undefined) ?? caps.hard_cap_usd;
  if (soft > hard) {
    return invalid(c, {
      field: "voice_soft_cap_usd",
      message: "must not be above the hard cap",
    });
  }

  // Switching ladders rewrites no due time; items move to the new ladder at their next review.
  if ("active_ladder_id" in record)
    await setActiveLadderId(c.env.DB, record.active_ladder_id as number);
  if ("voice_soft_cap_usd" in record) await setVoiceCap(c.env.DB, "soft", soft);
  if ("voice_hard_cap_usd" in record) await setVoiceCap(c.env.DB, "hard", hard);

  return c.json(await currentSettings(c.env.DB));
});
