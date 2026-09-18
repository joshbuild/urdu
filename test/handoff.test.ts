import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  HandoffResponse,
  IncompleteResponse,
  InvalidRequestResponse,
  RevisionsResponse,
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
          { urdu: KITAB, roman: "kitaab", english: "book", tags: ["chat"] },
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
      tags: ["chat"],
      source: "coach",
      ladder_id: 3,
      ladder_step: 0,
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
    ["bad tags", handoff([{ urdu: PANI, tags: "chat" }]), "proposals[0].tags"],
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

describe("POST /api/handoffs/revisions", () => {
  const revise = (body: unknown, preview = false) =>
    api("POST", `/api/handoffs/revisions${preview ? "?preview=1" : ""}`, body);

  it("previews fills for empty fields only and writes nothing", async () => {
    const item = await create({ urdu: KITAB, english: "book" });
    const body = await json<RevisionsResponse>(
      await revise(
        {
          handoff_id: "r-1",
          revisions: [{ vocab_id: item.id, urdu: KITAB, roman: "kitaab", english: "a book" }],
        },
        true,
      ),
    );
    expect(body).toMatchObject({ preview: true, repeat: false });
    expect(body.results[0]).toEqual({
      vocab_id: item.id,
      urdu: KITAB,
      outcome: "fill",
      fills: { roman: "kitaab" },
      kept: ["english"],
    });
    expect((await getItem(item.id)).roman).toBeNull();
    expect(await count("handoffs")).toBe(0);
  });

  it("fills empty fields, leaves text and the schedule alone, and records the handoff", async () => {
    const item = await create({ urdu: KITAB, english: "book" });
    await env.DB.prepare(
      "UPDATE vocab SET ladder_step = 2, last_reviewed_at = ?, due_at = ? WHERE id = ?",
    )
      .bind("2026-09-01T00:00:00.000Z", "2026-09-20T00:00:00.000Z", item.id)
      .run();
    const before = await getItem(item.id);

    const body = await json<RevisionsResponse>(
      await revise({
        handoff_id: "r-1",
        revisions: [
          {
            vocab_id: item.id,
            urdu: KITAB_WITH_KASRA,
            roman: "kitaab",
            english: "a book",
            example_urdu: `  ${KITAB}  `,
            notes: null,
          },
        ],
      }),
    );
    expect(body.results[0]?.outcome).toBe("fill");

    const after = await getItem(item.id);
    expect(after).toMatchObject({
      roman: "kitaab",
      english: "book",
      example_urdu: KITAB,
      notes: null,
    });
    for (const key of [
      "ladder_id",
      "ladder_step",
      "interval_seconds",
      "last_reviewed_at",
      "due_at",
    ] as const) {
      expect(after[key]).toEqual(before[key]);
    }
    expect(await count("review_events")).toBe(0);
    expect(await handoffStatus("r-1")).toBe("revised");
  });

  it("rejects an unknown id and an urdu mismatch, reporting both", async () => {
    const item = await create({ urdu: KITAB });
    const other = await create({ urdu: PANI });
    const body = await json<RevisionsResponse>(
      await revise({
        handoff_id: "r-1",
        revisions: [
          { vocab_id: "01J00000000000000000000000", urdu: GHAR, roman: "ghar" },
          { vocab_id: item.id, urdu: PANI, roman: "paani" },
          { vocab_id: other.id, urdu: PANI },
        ],
      }),
    );
    expect(body.results.map((r) => r.outcome)).toEqual(["rejected", "rejected", "nothing"]);
    expect((await getItem(item.id)).roman).toBeNull();
  });

  it("treats a repeated handoff_id as a no-op", async () => {
    const item = await create({ urdu: KITAB });
    const request = {
      handoff_id: "r-1",
      revisions: [{ vocab_id: item.id, urdu: KITAB, roman: "kitaab" }],
    };
    const first = await json<RevisionsResponse>(await revise(request));
    await api("PATCH", `/api/vocab/${item.id}`, { roman: null });
    const again = await json<RevisionsResponse>(await revise(request));
    expect(again.repeat).toBe(true);
    expect(again.results).toEqual(first.results);
    expect((await getItem(item.id)).roman).toBeNull();
  });

  it("refuses a handoff_id already used by the other kind of paste", async () => {
    await api("POST", "/api/handoffs", handoff([{ urdu: PANI }], "same"));
    const res = await revise({ handoff_id: "same", revisions: [{ vocab_id: "x", urdu: PANI }] });
    expect(res.status).toBe(409);
  });

  it.each([
    ["no revisions", { handoff_id: "r", revisions: [] }, "revisions"],
    ["missing vocab_id", { handoff_id: "r", revisions: [{ urdu: PANI }] }, "revisions[0].vocab_id"],
    ["missing urdu", { handoff_id: "r", revisions: [{ vocab_id: "a" }] }, "revisions[0].urdu"],
    [
      "unknown field",
      { handoff_id: "r", revisions: [{ vocab_id: "a", urdu: PANI, tags: [] }] },
      "revisions[0].tags",
    ],
    [
      "repeated vocab_id",
      {
        handoff_id: "r",
        revisions: [
          { vocab_id: "a", urdu: PANI },
          { vocab_id: "a", urdu: PANI },
        ],
      },
      "revisions[1].vocab_id",
    ],
    [
      "more than 20",
      {
        handoff_id: "r",
        revisions: Array.from({ length: 21 }, (_, i) => ({ vocab_id: `v${i}`, urdu: PANI })),
      },
      "revisions",
    ],
  ])("rejects %s", async (_name, body, field) => {
    const res = await json<InvalidRequestResponse>(await revise(body), 400);
    expect(res.field).toBe(field);
  });
});

describe("GET /api/vocab/incomplete", () => {
  it("lists items missing any fillable field, missing Roman or English first", async () => {
    const complete = await create({
      urdu: GHAR,
      roman: "ghar",
      english: "house",
      notes: "n",
      example_urdu: "e",
      example_english: "e",
    });
    const noExamples = await create({ urdu: KITAB, roman: "kitaab", english: "book" });
    const noEnglish = await create({ urdu: PANI, roman: "paani" });

    const body = await json<IncompleteResponse>(await api("GET", "/api/vocab/incomplete"));
    expect(body.total).toBe(2);
    expect(body.items.map((i) => i.id)).toEqual([noEnglish.id, noExamples.id]);
    expect(body.items.map((i) => i.id)).not.toContain(complete.id);
  });
});
