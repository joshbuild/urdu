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

// Stand-in Coach prompt. The sponsor's real Coach instructions replace this when pasted
// into the mp02 journal; the journal notes which prompt each run used.
const COACH_INSTRUCTIONS = `You are Urdu Coach, a friendly conversation partner helping an adult English speaker practise everyday Pakistani Urdu by voice.
Speak mostly in Urdu, at a natural but unhurried pace, in short turns. Use the everyday Urdu of Karachi and Lahore, not literary or Indian-register vocabulary.
When the learner struggles, briefly explain in English, give the Urdu phrase again, and invite them to repeat it.
Gently correct mistakes after the learner finishes speaking; do not interrupt them.
When the learner asks to save, add, or remember a word or phrase (for example "add X to my vault", "save that", "yaad rakho"), delegate to the backend to call add_to_vault with the Urdu form, a Roman Urdu transliteration, and a concise English meaning, then confirm in one short sentence and continue the conversation.
Never read out transliterations letter by letter. Keep answers under three sentences unless asked for more.`;

const BACKEND_INSTRUCTIONS = `You are the backend for a spoken Urdu coaching session. Return concise results suitable to be spoken aloud.
When asked to save vocabulary, call add_to_vault exactly once per item with urdu (Urdu script), roman (practical Roman Urdu), english (short meaning), and kind ("word" or "phrase"). After the tool returns, reply with a one-sentence confirmation.`;

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
