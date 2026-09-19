// Creates a GPT-Live WebRTC session (FR-B5). The browser sends its offer SDP; OpenAI answers with
// its own, and the browser connects to OpenAI directly. OPENAI_API_KEY stays in the Worker.

import {
  BACKEND_INSTRUCTIONS,
  BACKEND_MODEL,
  COACH_INSTRUCTIONS,
  LIVE_MODEL,
  TOOLS,
  VOICE,
} from "./prompt";

export const LIVE_SESSIONS_URL = "https://api.openai.com/v1/live/sessions";

export type LiveSession = { sessionId: string; sdp: string };
export type LiveResult =
  | { ok: true; session: LiveSession }
  // OpenAI's status only: its error bodies can quote a masked key, so they are logged, not returned.
  | { ok: false; status: number };

export function liveSessionBody(sdp: string) {
  return {
    session: {
      model: LIVE_MODEL,
      instructions: COACH_INSTRUCTIONS,
      audio: { output: { voice: VOICE } },
      delegation: {
        type: "responses",
        responses: {
          model: BACKEND_MODEL,
          instructions: BACKEND_INSTRUCTIONS,
          tools: TOOLS,
          tool_choice: "auto",
        },
      },
    },
    transport: { type: "webrtc", sdp },
  };
}

export async function createLiveSession(apiKey: string, sdp: string): Promise<LiveResult> {
  const res = await fetch(LIVE_SESSIONS_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(liveSessionBody(sdp)),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("live session create failed", res.status, text.slice(0, 2000));
    return { ok: false, status: res.status };
  }
  let data: { session?: { id?: unknown }; transport?: { sdp?: unknown } };
  try {
    data = JSON.parse(text);
  } catch {
    console.error("live session create returned non-JSON", text.slice(0, 500));
    return { ok: false, status: res.status };
  }
  const sessionId = data.session?.id;
  const answer = data.transport?.sdp;
  if (typeof sessionId !== "string" || typeof answer !== "string") {
    console.error("live session create response lacks session id or sdp");
    return { ok: false, status: res.status };
  }
  return { ok: true, session: { sessionId, sdp: answer } };
}
