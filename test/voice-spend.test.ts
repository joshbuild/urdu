// f07 s04: voice spend recording, the daily caps and the broker's refusal (FR-G, FR-I1).

import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  InvalidRequestResponse,
  SettingsResponse,
  VoiceCapReachedResponse,
  VoiceSessionResponse,
  VoiceSpendResponse,
  VoiceUsageResponse,
} from "../shared/api";
import { todayIn } from "../shared/dates";
import { sessionCost, voiceCost } from "../shared/voice-cost";
import { LIVE_SESSIONS_URL } from "../worker/coach/live";
import { type Api, clearTables, unlockedApi } from "./client";

const OFFER = "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\n";
const ANSWER = "v=0\r\no=- 3 4 IN IP4 127.0.0.1\r\ns=-\r\n";

let api: Api;
let today: string;
let sessionCounter = 0;

beforeEach(async () => {
  await clearTables();
  api = await unlockedApi();
  today = todayIn(env.HOME_TZ);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function json<T>(res: Response, status = 200): Promise<T> {
  expect(res.status).toBe(status);
  return res.json();
}

function stubOpenAI(id = `sess_${++sessionCounter}`) {
  const original = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === LIVE_SESSIONS_URL)
      return Response.json({ session: { id }, transport: { sdp: ANSWER } });
    return original(input, init);
  });
  return id;
}

// A brokered session, as the Voice screen would open one.
async function startSession(): Promise<string> {
  const id = stubOpenAI();
  const body = await json<VoiceSessionResponse>(
    await api("POST", "/api/voice/session", { sdp: OFFER }),
  );
  expect(body.sessionId).toBe(id);
  vi.restoreAllMocks();
  return id;
}

const spend = async () => json<VoiceSpendResponse>(await api("GET", "/api/voice/spend"));

describe("GET /api/voice/spend", () => {
  it("starts the day at nothing, with the default caps", async () => {
    const body = await json<VoiceSpendResponse>(await api("GET", "/api/voice/spend"));
    expect(body).toEqual({ day: today, today_usd: 0, soft_cap_usd: 0.5, hard_cap_usd: 1 });
  });

  it("counts a brokered session's create charge before any usage is reported", async () => {
    await startSession();
    const body = await json<VoiceSpendResponse>(await api("GET", "/api/voice/spend"));
    expect(body.today_usd).toBeCloseTo(voiceCost(0), 6);
  });
});

describe("POST /api/voice/usage", () => {
  it("records seconds and backend tokens, and reports the session and the day", async () => {
    const id = await startSession();
    const body = await json<VoiceUsageResponse>(
      await api("POST", "/api/voice/usage", {
        session_id: id,
        seconds: 303,
        backend_input_tokens: 12_617,
        backend_output_tokens: 623,
        ended: true,
      }),
    );
    const expected = sessionCost({
      seconds: 303,
      backend_input_tokens: 12_617,
      backend_output_tokens: 623,
    });
    expect(body.session_usd).toBeCloseTo(expected, 6);
    expect(body.today_usd).toBeCloseTo(expected, 6);
    expect(body.day).toBe(today);

    const row = await env.DB.prepare("SELECT ended_at FROM voice_sessions WHERE id = ?")
      .bind(id)
      .first<{ ended_at: string | null }>();
    expect(row?.ended_at).toBeTruthy();
  });

  it("is cumulative, so a repeat or a late low report never lowers the total", async () => {
    const id = await startSession();
    await api("POST", "/api/voice/usage", { session_id: id, seconds: 300 });
    const again = await json<VoiceUsageResponse>(
      await api("POST", "/api/voice/usage", { session_id: id, seconds: 120 }),
    );
    expect(again.session_usd).toBeCloseTo(voiceCost(300), 6);
  });

  it("ignores a session this Worker never brokered", async () => {
    const res = await api("POST", "/api/voice/usage", {
      session_id: "sess_invented",
      seconds: 600,
    });
    expect(res.status).toBe(404);
    expect((await spend()).today_usd).toBe(0);
  });

  it("rejects a missing id and a negative count", async () => {
    const id = await startSession();
    const noId = await json<InvalidRequestResponse>(
      await api("POST", "/api/voice/usage", { seconds: 1 }),
      400,
    );
    expect(noId.field).toBe("session_id");
    const negative = await json<InvalidRequestResponse>(
      await api("POST", "/api/voice/usage", { session_id: id, seconds: -60 }),
      400,
    );
    expect(negative.field).toBe("seconds");
  });

  it("adds each session's create charge separately", async () => {
    const first = await startSession();
    const second = await startSession();
    await api("POST", "/api/voice/usage", { session_id: first, seconds: 60 });
    await api("POST", "/api/voice/usage", { session_id: second, seconds: 60 });
    expect((await spend()).today_usd).toBeCloseTo(voiceCost(60) * 2, 6);
  });

  it("leaves yesterday's sessions out of today's total", async () => {
    const id = await startSession();
    await api("POST", "/api/voice/usage", { session_id: id, seconds: 600 });
    await env.DB.prepare("UPDATE voice_sessions SET day = '2000-01-01' WHERE id = ?")
      .bind(id)
      .run();
    expect((await spend()).today_usd).toBe(0);
  });
});

describe("the hard cap", () => {
  it("refuses a new session once today's spend has reached it", async () => {
    const id = await startSession();
    // Twenty minutes is $1.00, which is the default hard cap.
    await api("POST", "/api/voice/usage", { session_id: id, seconds: 1200, ended: true });

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const body = await json<VoiceCapReachedResponse>(
      await api("POST", "/api/voice/session", { sdp: OFFER }),
      429,
    );
    expect(body.error).toBe("cap_reached");
    expect(body.hard_cap_usd).toBe(1);
    expect(body.today_usd).toBeGreaterThanOrEqual(1);
    // Nothing was spent to find out: OpenAI was never called.
    expect(fetchSpy.mock.calls.some(([input]) => String(input) === LIVE_SESSIONS_URL)).toBe(false);
  });

  it("lets a session start again once the cap is raised", async () => {
    const id = await startSession();
    await api("POST", "/api/voice/usage", { session_id: id, seconds: 1200, ended: true });
    expect((await api("POST", "/api/voice/session", { sdp: OFFER })).status).toBe(429);

    await api("PATCH", "/api/settings", { voice_hard_cap_usd: 5 });
    await startSession();
  });

  it("does not refuse for the soft cap alone", async () => {
    const id = await startSession();
    // Ten minutes is $0.50: at the soft cap, well under the hard one.
    await api("POST", "/api/voice/usage", { session_id: id, seconds: 600, ended: true });
    await startSession();
  });
});

describe("cap settings", () => {
  it("reads and writes both caps", async () => {
    const body = await json<SettingsResponse>(
      await api("PATCH", "/api/settings", { voice_soft_cap_usd: 0.25, voice_hard_cap_usd: 2 }),
    );
    expect(body).toMatchObject({ voice_soft_cap_usd: 0.25, voice_hard_cap_usd: 2 });
    expect(await json<SettingsResponse>(await api("GET", "/api/settings"))).toMatchObject({
      voice_soft_cap_usd: 0.25,
      voice_hard_cap_usd: 2,
      active_ladder_id: 3,
    });
  });

  it("leaves the ladder alone when only a cap is sent", async () => {
    await api("PATCH", "/api/settings", { active_ladder_id: 5 });
    await api("PATCH", "/api/settings", { voice_hard_cap_usd: 2 });
    expect((await json<SettingsResponse>(await api("GET", "/api/settings"))).active_ladder_id).toBe(
      5,
    );
  });

  it("rejects an amount outside the bounds", async () => {
    const body = await json<InvalidRequestResponse>(
      await api("PATCH", "/api/settings", { voice_hard_cap_usd: 500 }),
      400,
    );
    expect(body.field).toBe("voice_hard_cap_usd");
  });

  it("refuses a soft cap above the hard cap, which would warn only after the refusal", async () => {
    const body = await json<InvalidRequestResponse>(
      await api("PATCH", "/api/settings", { voice_soft_cap_usd: 3 }),
      400,
    );
    expect(body.field).toBe("voice_soft_cap_usd");
    // Both caps are unchanged.
    expect(await json<SettingsResponse>(await api("GET", "/api/settings"))).toMatchObject({
      voice_soft_cap_usd: 0.5,
      voice_hard_cap_usd: 1,
    });
  });

  it("accepts a zero cap, which stops voice entirely", async () => {
    await json<SettingsResponse>(
      await api("PATCH", "/api/settings", { voice_soft_cap_usd: 0, voice_hard_cap_usd: 0 }),
    );
    expect((await api("POST", "/api/voice/session", { sdp: OFFER })).status).toBe(429);
  });
});
