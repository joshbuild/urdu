import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  CheckBatchResponse,
  HandoffResponse,
  InvalidRequestResponse,
  VocabItem,
} from "../shared/api";
import { type Api, clearTables, unlockedApi } from "./client";

const KITAB = "\u{06A9}\u{062A}\u{0627}\u{0628}"; // کتاب
const KITAB_WITH_KASRA = "\u{06A9}\u{0650}\u{062A}\u{0627}\u{0628}"; // کِتاب
const PANI = "\u{067E}\u{0627}\u{0646}\u{06CC}"; // پانی
const GHAR = "\u{06AF}\u{06BE}\u{0631}"; // گھر

let api: Api;

beforeEach(async () => {
  await clearTables();
  api = await unlockedApi();
});

async function json<T>(res: Response, status = 200): Promise<T> {
  expect(res.status).toBe(status);
  return res.json();
}

const handoff = (proposals: unknown, id = "h-1") => ({
  handoff_id: id,
  session_at: "2026-09-18T10:00:00Z",
  proposals,
});

async function create(body: Record<string, unknown>): Promise<VocabItem> {
  return json(await api("POST", "/api/vocab", body), 201);
}

async function getItem(id: string): Promise<VocabItem> {
  return json(await api("GET", `/api/vocab/${id}`));
}

async function count(table: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>();
  return row?.n ?? -1;
}

async function handoffStatus(id: string): Promise<string | undefined> {
  const row = await env.DB.prepare("SELECT status FROM handoffs WHERE id = ?")
    .bind(id)
    .first<{ status: string }>();
  return row?.status;
}

describe("POST /api/handoffs", () => {
  it("creates each proposal as a new coach item, due now, and records the handoff", async () => {
    const body = await json<HandoffResponse>(
      await api(
        "POST",
        "/api/handoffs",
        handoff([
          { urdu: KITAB, roman: "kitaab", english: "book", tags: ["social"] },
          { urdu: PANI, english: "water", notes: null },
        ]),
      ),
    );
    expect(body.repeat).toBe(false);
    expect(body.results.map((r) => r.outcome)).toEqual(["created", "created"]);

    const first = body.results[0];
    if (first?.outcome !== "created") throw new Error("expected created");
    expect(await getItem(first.id)).toMatchObject({
      urdu: KITAB,
      roman: "kitaab",
      english: "book",
      tags: ["social"],
      source: "coach",
      ladder_id: 8,
      ladder_step: 2,
      due_at: null,
    });
    expect(await handoffStatus("h-1")).toBe("applied");
  });

  it("reports duplicates against the vault and within the payload", async () => {
    const existing = await create({ urdu: KITAB });
    const body = await json<HandoffResponse>(
      await api(
        "POST",
        "/api/handoffs",
        handoff([{ urdu: KITAB_WITH_KASRA }, { urdu: GHAR }, { urdu: `  ${GHAR} ` }]),
      ),
    );
    const [a, b, c] = body.results;
    expect(a).toMatchObject({ outcome: "duplicate", existing_id: existing.id });
    if (b?.outcome !== "created") throw new Error("expected created");
    expect(c).toMatchObject({ outcome: "duplicate", existing_id: b.id });
    expect(await count("vocab")).toBe(2);
  });

  it("rejects a proposal with no Urdu letters without failing the rest", async () => {
    const body = await json<HandoffResponse>(
      await api("POST", "/api/handoffs", handoff([{ urdu: "!!" }, { urdu: PANI }])),
    );
    expect(body.results.map((r) => r.outcome)).toEqual(["rejected", "created"]);
  });

  it("treats a repeated handoff_id as a no-op returning the first outcome", async () => {
    const first = await json<HandoffResponse>(
      await api("POST", "/api/handoffs", handoff([{ urdu: PANI }])),
    );
    const again = await json<HandoffResponse>(
      await api("POST", "/api/handoffs", handoff([{ urdu: PANI }, { urdu: GHAR }])),
    );
    expect(again.repeat).toBe(true);
    expect(again.results).toEqual(first.results);
    expect(await count("vocab")).toBe(1);
    expect(await count("handoffs")).toBe(1);
  });

  it.each([
    ["not an object", [], undefined],
    [
      "missing handoff_id",
      { session_at: "2026-09-18T10:00:00Z", proposals: [{ urdu: PANI }] },
      "handoff_id",
    ],
    [
      "bad session_at",
      { handoff_id: "x", session_at: "yesterday", proposals: [{ urdu: PANI }] },
      "session_at",
    ],
    ["no proposals", handoff([]), "proposals"],
    ["proposals not an array", handoff(KITAB), "proposals"],
    ["unknown top-level field", { ...handoff([{ urdu: PANI }]), extra: 1 }, "extra"],
    ["results, not accepted yet", { ...handoff([{ urdu: PANI }]), results: [] }, "results"],
    ["missing urdu", handoff([{ english: "water" }]), "proposals[0].urdu"],
    [
      "unknown proposal field",
      handoff([{ urdu: PANI }, { urdu: GHAR, mastery: 3 }]),
      "proposals[1].mastery",
    ],
    ["wrong field type", handoff([{ urdu: PANI, english: 5 }]), "proposals[0].english"],
  ])("rejects %s whole, writing nothing", async (_name, body, field) => {
    const res = await json<InvalidRequestResponse>(await api("POST", "/api/handoffs", body), 400);
    expect(res.field).toBe(field);
    expect(res.message).toBeTruthy();
    expect(await count("vocab")).toBe(0);
    expect(await count("handoffs")).toBe(0);
  });

  it("requires a session", async () => {
    const res = await exports.default.fetch("http://urdu.test/api/handoffs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(handoff([{ urdu: PANI }])),
    });
    expect(res.status).toBe(401);
  });
});

describe("handoff_id conflicts", () => {
  it("refuses a check batch's handoff_id pasted as new vocab", async () => {
    await create({ urdu: KITAB, english: "book" });
    const batch = await json<CheckBatchResponse>(
      await api("POST", "/api/handoffs/check-batch", {}),
    );
    const res = await api(
      "POST",
      "/api/handoffs",
      handoff([{ urdu: PANI }], batch.handoff_id ?? ""),
    );
    expect(res.status).toBe(409);
  });
});
