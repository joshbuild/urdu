// mp02 GPT-Live spike Worker. Throwaway: not the Urdu Core Worker (that is f01's `worker/`).
//
// Routes (all require header `X-Spike-Token: <SPIKE_TOKEN>`):
//   POST /api/spike/session    { sdp }  -> { sessionId, sdp }   brokers a GPT-Live WebRTC session
//   POST /api/spike/vault-add  { urdu, roman?, english?, kind? } -> { ok, id }   FR-F2 stub (logs only)
//   GET  /api/spike/health     -> { ok, hasKey }
// Everything else is served from the static assets directory (spikes/gpt-live).

export interface Env {
  OPENAI_API_KEY: string;
  SPIKE_TOKEN: string;
  ASSETS: { fetch(req: Request): Promise<Response> };
}

const LIVE_MODEL = "gpt-live-1";
const BACKEND_MODEL = "gpt-5.6-luna";
const DEFAULT_VOICE = "marin";

// Sponsor's real ChatGPT Urdu Coach instructions (verbatim copy: pm/mini-plans/mp02-coach-instructions.md),
// adapted for voice and for the spike's single add_to_vault tool: the Airtable sections are cut
// (the spike has no lookup, update, quiz, or import tools) and the add rule is reworded so the
// Coach confirms only after the result. Scope and interaction style are kept as written.
const COACH_INSTRUCTIONS = `## Project Aim & Scope

Coach me in speaking and understanding Urdu as commonly spoken in Pakistan.

Prefer natural, everyday Pakistani Urdu over highly formal, literary, or archaic Urdu unless I ask otherwise. When useful, distinguish everyday, formal, literary, Punjabi-influenced, or English-influenced usage.

## Interaction Style

When I make mistakes:
- correct me;
- give the natural form;
- briefly explain why when useful.

Be patient with repetition and drilling.

Use Urdu script for Urdu words and sentences. Give simple practical Roman Urdu when helpful or requested.

If I ask for an English explanation, explain in English.

Do not overcorrect harmless variation; focus on grammar, meaning, pronunciation, and naturalness.

## Voice session

This is a spoken conversation. Keep turns short and natural. Wait until I finish speaking before correcting me. Never spell out transliterations letter by letter.

## Adding Vocabulary

When I say things like "add this to my vocab", "put that word in my list", or "remember this word", delegate to the backend to call add_to_vault with the correct Urdu spelling, practical Roman Urdu for Pakistani pronunciation, a concise English equivalent, and kind "word" or "phrase". Infer obvious fields rather than asking unnecessary questions.

While the add is in progress, say only that you are adding it. Never say it is done, added, or saved until the backend reports the result. If the result is not ok, tell me it failed.

Do not automatically add newly taught words unless I ask.

In this session you can only add vocabulary. If I ask to look up, quiz from, update, or import my vocabulary, say briefly that this session cannot do that yet and carry on coaching.`;

const BACKEND_INSTRUCTIONS = `You are the backend for a spoken Urdu coaching session. Return concise results suitable to be spoken aloud.
When asked to save vocabulary, call add_to_vault exactly once per item with urdu (correct Urdu script spelling), roman (practical Roman Urdu for Pakistani pronunciation), english (concise equivalent), and kind ("word" or "phrase").
After the tool returns: if ok is true, reply with one sentence stating what was added. If ok is false or there is an error, say plainly that it was not added. Never claim a change succeeded unless the tool result says it did.`;

const TOOLS = [
  {
    type: "function",
    name: "add_to_vault",
    description:
      "Save an Urdu word or phrase the learner wants to remember into their vocabulary vault.",
    parameters: {
      type: "object",
      properties: {
        urdu: { type: "string", description: "The item in Urdu script" },
        roman: { type: "string", description: "Practical Roman Urdu transliteration" },
        english: { type: "string", description: "Concise English meaning" },
        kind: { type: "string", enum: ["word", "phrase"] },
      },
      required: ["urdu", "english"],
      additionalProperties: false,
    },
  },
];

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });
}

function authorized(req: Request, env: Env): boolean {
  const t = req.headers.get("x-spike-token") ?? "";
  return Boolean(env.SPIKE_TOKEN) && t === env.SPIKE_TOKEN;
}

async function createSession(sdp: string, voice: string, env: Env): Promise<Response> {
  const body = {
    session: {
      model: LIVE_MODEL,
      instructions: COACH_INSTRUCTIONS,
      audio: { output: { voice } },
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
  const started = Date.now();
  const r = await fetch("https://api.openai.com/v1/live/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) {
    return json({ error: "openai", status: r.status, body: text.slice(0, 2000) }, 502);
  }
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return json({ error: "openai returned non-JSON", body: text.slice(0, 500) }, 502);
  }
  return json({
    sessionId: data?.session?.id ?? null,
    sdp: data?.transport?.sdp ?? null,
    createMs: Date.now() - started,
    model: LIVE_MODEL,
    backend: BACKEND_MODEL,
    voice,
    raw: data?.session ?? null,
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/spike/")) {
      return env.ASSETS.fetch(req);
    }
    if (url.pathname === "/api/spike/health") {
      return json({ ok: true, hasKey: Boolean(env.OPENAI_API_KEY), hasToken: Boolean(env.SPIKE_TOKEN) });
    }
    if (!authorized(req, env)) {
      return json({ error: "unauthorized" }, 401);
    }
    if (req.method !== "POST") {
      return json({ error: "method" }, 405);
    }
    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      return json({ error: "bad json" }, 400);
    }

    if (url.pathname === "/api/spike/session") {
      if (typeof payload.sdp !== "string" || !payload.sdp.startsWith("v=0")) {
        return json({ error: "sdp missing" }, 400);
      }
      const voice = typeof payload.voice === "string" && payload.voice ? payload.voice : DEFAULT_VOICE;
      return createSession(payload.sdp, voice, env);
    }

    if (url.pathname === "/api/spike/vault-add") {
      // FR-F2 stub: no persistence. Logs the proposal so the run can be reconciled from `wrangler tail`.
      const id = `stub_${Date.now().toString(36)}`;
      console.log("vault-add", JSON.stringify({ id, ...payload }));
      return json({ ok: true, id, received: payload, note: "stub: nothing persisted" });
    }

    return json({ error: "not found" }, 404);
  },
};
