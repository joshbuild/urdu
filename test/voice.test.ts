import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AddToVaultResult,
  GetVocabResult,
  InvalidRequestResponse,
  RecordReviewResult,
  ReviewEvent,
  VocabItem,
  VoiceSessionResponse,
} from "../shared/api";
import { scheduleReview } from "../shared/ladders";
import { LIVE_SESSIONS_URL } from "../worker/coach/live";
import { TOOLS, VOICE } from "../worker/coach/prompt";
import { type Api, clearTables, unlockedApi } from "./client";
import { TEST_OPENAI_KEY } from "./constants";

const KITAB = "\u{06A9}\u{062A}\u{0627}\u{0628}"; // کتاب
const KITAB_WITH_KASRA = "\u{06A9}\u{0650}\u{062A}\u{0627}\u{0628}"; // کِتاب
const PANI = "\u{067E}\u{0627}\u{0646}\u{06CC}"; // پانی
const GHAR = "\u{06AF}\u{06BE}\u{0631}"; // گھر

const OFFER = "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\n";
const ANSWER = "v=0\r\no=- 3 4 IN IP4 127.0.0.1\r\ns=-\r\n";

let api: Api;

beforeEach(async () => {
  await clearTables();
  api = await unlockedApi();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function json<T>(res: Response, status = 200): Promise<T> {
  expect(res.status).toBe(status);
  return res.json();
}

async function create(body: Record<string, unknown>): Promise<VocabItem> {
  return json(await api("POST", "/api/vocab", body), 201);
}

async function getItem(id: string): Promise<VocabItem> {
  return json(await api("GET", `/api/vocab/${id}`));
}

async function events(vocabId: string): Promise<ReviewEvent[]> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM review_events WHERE vocab_id = ? ORDER BY id",
  )
    .bind(vocabId)
    .all<ReviewEvent>();
  return results;
}

let callCounter = 0;
const tool = (name: string, args: unknown, callId = `call-${++callCounter}`, session = "sess-1") =>
  api("POST", `/api/voice/tools/${name}`, {
    session_id: session,
    call_id: callId,
    arguments: args,
  });

// Stubs only the OpenAI call; anything else would be a test bug.
function stubOpenAI(response: () => Response) {
  const original = globalThis.fetch;
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === LIVE_SESSIONS_URL) return response();
    return original(input, init);
  });
}

describe("POST /api/voice/session", () => {
  it("needs a session", async () => {
    const res = await exports.default.fetch("http://urdu.test/api/voice/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sdp: OFFER }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects a body without an offer SDP", async () => {
    const body = await json<InvalidRequestResponse>(
      await api("POST", "/api/voice/session", { sdp: "hello" }),
      400,
    );
    expect(body.field).toBe("sdp");
  });

  it("sends the server-held Coach config with the key and returns the answer", async () => {
    const spy = stubOpenAI(() =>
      Response.json({ session: { id: "sess_abc" }, transport: { type: "webrtc", sdp: ANSWER } }),
    );
    const body = await json<VoiceSessionResponse>(
      await api("POST", "/api/voice/session", { sdp: OFFER }),
    );
    expect(body).toMatchObject({ sessionId: "sess_abc", sdp: ANSWER });

    const [, init] = spy.mock.calls.find(([input]) => String(input) === LIVE_SESSIONS_URL) ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${TEST_OPENAI_KEY}`);
    const sent = JSON.parse(String(init?.body));
    expect(sent.transport).toEqual({ type: "webrtc", sdp: OFFER });
    expect(sent.session.model).toBe("gpt-live-1");
    expect(sent.session.audio.output.voice).toBe(VOICE);
    expect(sent.session.instructions).toContain("Tracked reviews");
    expect(sent.session.delegation.responses.tools.map((t: { name: string }) => t.name)).toEqual(
      TOOLS.map((t) => t.name),
    );
  });

  it("answers 502 with OpenAI's status only, never its body", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubOpenAI(
      () =>
        new Response(
          JSON.stringify({ error: { message: "Incorrect API key provided: sk-te***" } }),
          {
            status: 401,
          },
        ),
    );
    const res = await api("POST", "/api/voice/session", { sdp: OFFER });
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "upstream", status: 401 });
    expect(text).not.toContain("sk-");
  });

  it("answers 502 when OpenAI's reply lacks the answer SDP", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubOpenAI(() => Response.json({ session: { id: "sess_abc" } }));
    expect((await api("POST", "/api/voice/session", { sdp: OFFER })).status).toBe(502);
  });
});

describe("tool envelope", () => {
  it("rejects a missing call_id and an unknown tool", async () => {
    const res = await api("POST", "/api/voice/tools/get_vocab", {
      session_id: "s",
      arguments: {},
    });
    expect((await json<InvalidRequestResponse>(res, 400)).field).toBe("call_id");
    expect((await tool("delete_everything", {})).status).toBe(404);
  });

  it("needs a session", async () => {
    const res = await exports.default.fetch("http://urdu.test/api/voice/tools/get_vocab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "s", call_id: "c", arguments: {} }),
    });
    expect(res.status).toBe(401);
  });
});

describe("get_vocab", () => {
  it("returns due items by default, with the mastery band and the due total", async () => {
    const a = await create({ urdu: KITAB, roman: "kitaab", english: "book" });
    const b = await create({ urdu: PANI, english: "water" });
    // Reviewed correct: no longer due.
    await json(
      await api("POST", `/api/vocab/${b.id}/reviews`, { grade: "correct", direction: "ur_en" }),
      201,
    );

    const body = await json<GetVocabResult>(await tool("get_vocab", {}));
    expect(body.total).toBe(1);
    expect(body.items).toEqual([
      { id: a.id, urdu: KITAB, roman: "kitaab", english: "book", mastery: "New", due_at: null },
    ]);
  });

  it("returns all items, filtered by tag and limited", async () => {
    await create({ urdu: KITAB, tags: ["home"] });
    await create({ urdu: PANI, tags: ["home"] });
    await create({ urdu: GHAR });
    const tagged = await json<GetVocabResult>(
      await tool("get_vocab", { scope: "all", tag: "home", limit: 1 }),
    );
    expect(tagged.total).toBe(2);
    expect(tagged.items).toHaveLength(1);
  });

  it("rejects a bad limit and unknown fields", async () => {
    expect(
      (await json<InvalidRequestResponse>(await tool("get_vocab", { limit: 51 }), 400)).field,
    ).toBe("limit");
    expect(
      (await json<InvalidRequestResponse>(await tool("get_vocab", { mastery: 3 }), 400)).field,
    ).toBe("mastery");
  });
});

describe("add_to_vault", () => {
  it("creates coach items and reports duplicates with the existing meaning", async () => {
    const existing = await create({ urdu: KITAB, english: "book" });
    const body = await json<AddToVaultResult>(
      await tool("add_to_vault", {
        items: [
          { urdu: KITAB_WITH_KASRA, english: "a book" },
          { urdu: PANI, roman: "paani", english: "water", kind: "word" },
          { urdu: "؟" },
        ],
      }),
    );
    expect(body.results[0]).toEqual({
      urdu: KITAB_WITH_KASRA,
      outcome: "duplicate",
      existing_id: existing.id,
      existing_english: "book",
    });
    const created = body.results[1];
    expect(created?.outcome).toBe("created");
    const item = await getItem((created as { id: string }).id);
    expect(item).toMatchObject({ urdu: PANI, roman: "paani", source: "coach", due_at: null });
    expect(body.results[2]).toMatchObject({ outcome: "rejected" });
  });

  it("returns the first result for a repeated call_id and writes nothing more", async () => {
    const args = { items: [{ urdu: PANI, english: "water" }] };
    const first = await json<AddToVaultResult>(await tool("add_to_vault", args, "c-add"));
    const again = await json<AddToVaultResult>(await tool("add_to_vault", args, "c-add"));
    expect(again).toEqual(first);
    expect(first.results[0]?.outcome).toBe("created");
    const n = await env.DB.prepare("SELECT count(*) AS n FROM vocab").first<{ n: number }>();
    expect(n?.n).toBe(1);
  });

  it("scopes call ids to the voice session", async () => {
    const args = { items: [{ urdu: PANI }] };
    await json(await tool("add_to_vault", args, "c-1", "sess-a"));
    const other = await json<AddToVaultResult>(await tool("add_to_vault", args, "c-1", "sess-b"));
    expect(other.results[0]?.outcome).toBe("duplicate");
  });

  it("rejects a call_id reused by another tool", async () => {
    const item = await create({ urdu: KITAB });
    await json(await tool("add_to_vault", { items: [{ urdu: PANI }] }, "c-x"));
    const res = await tool(
      "record_review",
      { vocab_id: item.id, grade: "correct", prompt_support: "none" },
      "c-x",
    );
    expect(res.status).toBe(409);
  });

  it("rejects an item with an unknown field, naming its path", async () => {
    const res = await tool("add_to_vault", { items: [{ urdu: PANI, mastery: 3 }] });
    expect((await json<InvalidRequestResponse>(res, 400)).field).toBe("items[0].mastery");
  });
});

describe("record_review", () => {
  it("applies an oral review by id through the shared schedule and logs a coach event", async () => {
    const item = await create({ urdu: KITAB });
    const before = await getItem(item.id);
    const body = await json<RecordReviewResult>(
      await tool("record_review", { vocab_id: item.id, grade: "correct", prompt_support: "none" }),
    );
    const after = await getItem(item.id);
    const expected = scheduleReview(before, "correct", "oral", 3, after.last_reviewed_at as string);
    expect(after).toMatchObject({
      ladder_step: expected.ladder_step,
      interval_seconds: expected.interval_seconds,
      due_at: expected.due_at,
    });
    expect(body).toMatchObject({
      outcome: "recorded",
      vocab_id: item.id,
      counted: true,
      applied_delta: 1,
      due_at: expected.due_at,
    });
    const [event] = await events(item.id);
    expect(event).toMatchObject({
      direction: "oral",
      source: "coach",
      handoff_id: "sess-1",
      prompt_support: "none",
      applied_delta: 1,
    });
  });

  it("resolves by normalized Urdu when there is no id", async () => {
    const item = await create({ urdu: KITAB });
    const body = await json<RecordReviewResult>(
      await tool("record_review", {
        urdu: KITAB_WITH_KASRA,
        grade: "wrong",
        prompt_support: "none",
      }),
    );
    expect(body).toMatchObject({ outcome: "recorded", vocab_id: item.id });
  });

  it("reports unmatched items and an id that disagrees with the Urdu, writing nothing", async () => {
    const item = await create({ urdu: KITAB });
    const missing = await json<RecordReviewResult>(
      await tool("record_review", { urdu: GHAR, grade: "correct", prompt_support: "none" }),
    );
    expect(missing.outcome).toBe("unmatched");
    const noId = await json<RecordReviewResult>(
      await tool("record_review", { vocab_id: "01NOPE", grade: "correct", prompt_support: "none" }),
    );
    expect(noId.outcome).toBe("unmatched");
    const mismatch = await json<RecordReviewResult>(
      await tool("record_review", {
        vocab_id: item.id,
        urdu: PANI,
        grade: "correct",
        prompt_support: "none",
      }),
    );
    expect(mismatch).toMatchObject({ outcome: "unmatched" });
    expect(await events(item.id)).toHaveLength(0);
  });

  it("logs a hinted answer with delta 0 and leaves the schedule exactly as it was", async () => {
    const item = await create({ urdu: KITAB });
    await json(
      await tool("record_review", { vocab_id: item.id, grade: "correct", prompt_support: "none" }),
    );
    const before = await getItem(item.id);

    const body = await json<RecordReviewResult>(
      await tool("record_review", {
        vocab_id: item.id,
        grade: "confident",
        prompt_support: "hint",
      }),
    );
    expect(body).toMatchObject({ outcome: "recorded", counted: false, applied_delta: 0 });
    expect(await getItem(item.id)).toEqual(before);
    const hinted = (await events(item.id))[1];
    expect(hinted).toMatchObject({
      grade: "confident",
      prompt_support: "hint",
      applied_delta: 0,
      step_before: before.ladder_step,
      step_after: before.ladder_step,
      due_before: before.due_at,
      due_after: before.due_at,
    });
  });

  it("applies a repeated call_id once", async () => {
    const item = await create({ urdu: KITAB });
    const args = { vocab_id: item.id, grade: "correct", prompt_support: "none" };
    const first = await json<RecordReviewResult>(await tool("record_review", args, "c-r"));
    const again = await json<RecordReviewResult>(await tool("record_review", args, "c-r"));
    expect(again).toEqual(first);
    expect(await events(item.id)).toHaveLength(1);
  });

  it("requires an item reference, a grade and prompt support", async () => {
    const field = async (args: unknown) =>
      (await json<InvalidRequestResponse>(await tool("record_review", args), 400)).field;
    expect(await field({ grade: "correct", prompt_support: "none" })).toBe("vocab_id");
    expect(await field({ urdu: KITAB, grade: "great", prompt_support: "none" })).toBe("grade");
    expect(await field({ urdu: KITAB, grade: "correct" })).toBe("prompt_support");
  });
});
