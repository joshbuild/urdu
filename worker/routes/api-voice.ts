// Voice Coach routes (f07, FR-B5, FR-F1..F3). Mounted behind requireSession: the Coach's tool calls
// arrive on the browser's data channel, and the browser relays them here with the session cookie
// (DECISIONS 260918h). OPENAI_API_KEY never leaves the Worker.
//
// Tool-level outcomes (duplicate, unmatched, stale) are 200s: the browser hands every result back
// to the model as-is. A 400 means the call itself was malformed; its message goes back too.

import type { Context } from "hono";
import { Hono } from "hono";
import type {
  ConflictResponse,
  VoiceCapReachedResponse,
  VoiceSessionResponse,
  VoiceSpendResponse,
  VoiceUsageResponse,
} from "../../shared/api";
import { MAX_VOICE_ID_LENGTH } from "../../shared/api";
import { createLiveSession } from "../coach/live";
import { ID_CONFLICT } from "../domain/handoff";
import { activeLadderId } from "../domain/settings";
import { voiceAddToVault, voiceGetVocab, voiceRecordReview } from "../domain/voice";
import {
  parseAddToVault,
  parseEnvelope,
  parseGetVocab,
  parseRecordReview,
} from "../domain/voice-input";
import {
  recordVoiceUsage,
  sessionSpend,
  spendOn,
  startVoiceSession,
  voiceCaps,
} from "../domain/voice-spend";
import type { AppEnv } from "../env";
import { invalid, readJson, today } from "./api-vocab";

// An SDP offer is a few KB; this only bounds what is forwarded.
export const MAX_SDP_LENGTH = 50_000;

const conflict: ConflictResponse = {
  error: "conflict",
  message: "this call_id was already used for a different tool",
};

export const voiceRoutes = new Hono<AppEnv>();

// Today's spend in the home timezone, with the caps it is measured against.
async function currentSpend(c: Context<AppEnv>): Promise<VoiceSpendResponse> {
  const day = today(c);
  const [today_usd, caps] = await Promise.all([spendOn(c.env.DB, day), voiceCaps(c.env.DB)]);
  return { day, today_usd, ...caps };
}

voiceRoutes.post("/api/voice/session", async (c) => {
  const body = await readJson(c);
  const sdp = (body as { sdp?: unknown } | undefined)?.sdp;
  if (typeof sdp !== "string" || !sdp.startsWith("v=0") || sdp.length > MAX_SDP_LENGTH) {
    return invalid(c, { field: "sdp", message: "must be a WebRTC offer SDP" });
  }
  if (!c.env.OPENAI_API_KEY) return c.json({ error: "voice_unconfigured" }, 503);

  // FR-G hard cap: refuse before spending anything. The soft cap only warns, so it is reported,
  // not enforced, here.
  const spend = await currentSpend(c);
  if (spend.today_usd >= spend.hard_cap_usd) {
    const body: VoiceCapReachedResponse = { error: "cap_reached", ...spend };
    return c.json(body, 429);
  }

  const result = await createLiveSession(c.env.OPENAI_API_KEY, sdp);
  if (!result.ok) return c.json({ error: "upstream", status: result.status }, 502);
  // The row exists from creation, so an unreported session still costs its create charge.
  await startVoiceSession(c.env.DB, result.session.sessionId, spend.day, new Date());
  const response: VoiceSessionResponse = { ...result.session, ...spend };
  return c.json(response);
});

voiceRoutes.get("/api/voice/spend", async (c) => c.json(await currentSpend(c)));

// The browser reports what the data channel told it (FR-I1). Cumulative, so a repeat or an
// out-of-order report never raises the total beyond the largest figure seen.
voiceRoutes.post("/api/voice/usage", async (c) => {
  const body = await readJson(c);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return invalid(c, { message: "body must be a JSON object" });
  }
  const record = body as Record<string, unknown>;
  const id = record.session_id;
  if (typeof id !== "string" || !id || id.length > MAX_VOICE_ID_LENGTH) {
    return invalid(c, { field: "session_id", message: "must be the live session id" });
  }
  const counts: Record<string, number> = {};
  for (const field of ["seconds", "backend_input_tokens", "backend_output_tokens"] as const) {
    const value = record[field] ?? 0;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return invalid(c, { field, message: "must be a count of zero or more" });
    }
    counts[field] = Math.round(value);
  }
  const usage = {
    seconds: counts.seconds ?? 0,
    backend_input_tokens: counts.backend_input_tokens ?? 0,
    backend_output_tokens: counts.backend_output_tokens ?? 0,
  };
  // An id this Worker never brokered is ignored rather than inserted: spend is ours to record.
  const known = await recordVoiceUsage(c.env.DB, id, usage, record.ended === true, new Date());
  if (!known) return c.json({ error: "not_found" }, 404);
  const response: VoiceUsageResponse = {
    session_usd: await sessionSpend(c.env.DB, id),
    ...(await currentSpend(c)),
  };
  return c.json(response);
});

voiceRoutes.post("/api/voice/tools/:name", async (c) => {
  const body = await readJson(c);
  if (body === undefined) return invalid(c, { message: "body must be valid JSON" });
  const call = parseEnvelope(body);
  if (!call.ok) return invalid(c, call.error);
  const now = new Date();

  switch (c.req.param("name")) {
    case "get_vocab": {
      const args = parseGetVocab(call.value.args);
      if (!args.ok) return invalid(c, args.error);
      return c.json(await voiceGetVocab(c.env.DB, args.value, now));
    }
    case "add_to_vault": {
      const items = parseAddToVault(call.value.args);
      if (!items.ok) return invalid(c, items.error);
      const ladder = await activeLadderId(c.env.DB);
      const result = await voiceAddToVault(c.env.DB, call.value, items.value, now, ladder);
      return result === ID_CONFLICT ? c.json(conflict, 409) : c.json(result);
    }
    case "record_review": {
      const args = parseRecordReview(call.value.args);
      if (!args.ok) return invalid(c, args.error);
      const ladder = await activeLadderId(c.env.DB);
      const result = await voiceRecordReview(c.env.DB, call.value, args.value, now, ladder);
      return result === ID_CONFLICT ? c.json(conflict, 409) : c.json(result);
    }
    default:
      return c.json({ error: "not_found" }, 404);
  }
});
