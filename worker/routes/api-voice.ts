// Voice Coach routes (f07, FR-B5, FR-F1..F3). Mounted behind requireSession: the Coach's tool calls
// arrive on the browser's data channel, and the browser relays them here with the session cookie
// (DECISIONS 260918h). OPENAI_API_KEY never leaves the Worker.
//
// Tool-level outcomes (duplicate, unmatched, stale) are 200s: the browser hands every result back
// to the model as-is. A 400 means the call itself was malformed; its message goes back too.

import { Hono } from "hono";
import type { ConflictResponse, VoiceSessionResponse } from "../../shared/api";
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
import type { AppEnv } from "../env";
import { invalid, readJson } from "./api-vocab";

// An SDP offer is a few KB; this only bounds what is forwarded.
export const MAX_SDP_LENGTH = 50_000;

const conflict: ConflictResponse = {
  error: "conflict",
  message: "this call_id was already used for a different tool",
};

export const voiceRoutes = new Hono<AppEnv>();

voiceRoutes.post("/api/voice/session", async (c) => {
  const body = await readJson(c);
  const sdp = (body as { sdp?: unknown } | undefined)?.sdp;
  if (typeof sdp !== "string" || !sdp.startsWith("v=0") || sdp.length > MAX_SDP_LENGTH) {
    return invalid(c, { field: "sdp", message: "must be a WebRTC offer SDP" });
  }
  if (!c.env.OPENAI_API_KEY) return c.json({ error: "voice_unconfigured" }, 503);
  const result = await createLiveSession(c.env.OPENAI_API_KEY, sdp);
  if (!result.ok) return c.json({ error: "upstream", status: result.status }, 502);
  const response: VoiceSessionResponse = result.session;
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
