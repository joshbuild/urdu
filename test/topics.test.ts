// f18 s01: topic and level on vocab — strict on direct writes, lenient on pastes — the coverage
// counts, the list and due filters, and the export.
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  CoverageResponse,
  DueResponse,
  ExportResponse,
  HandoffResponse,
  InvalidRequestResponse,
  VocabItem,
  VocabListResponse,
} from "../shared/api";
import { type Api, clearTables, unlockedApi } from "./client";

const KITAB = "\u{06A9}\u{062A}\u{0627}\u{0628}"; // کتاب
const PANI = "\u{067E}\u{0627}\u{0646}\u{06CC}"; // پانی
const GHAR = "\u{06AF}\u{06BE}\u{0631}"; // گھر
const ROTI = "\u{0631}\u{0648}\u{0679}\u{06CC}"; // روٹی

let api: Api;

beforeEach(async () => {
  await clearTables();
  api = await unlockedApi();
});

async function json<T>(res: Response, status = 200): Promise<T> {
  expect(res.status).toBe(status);
  return res.json();
}

async function create(body: Record<string, unknown>): Promise<VocabItem> {
  return json(await api("POST", "/api/vocab", body), 201);
}

async function invalid(res: Response): Promise<InvalidRequestResponse> {
  return json<InvalidRequestResponse>(res, 400);
}

describe("direct writes are strict", () => {
  it("store a known topic, a level and secondary tags, folding case", async () => {
    const item = await create({ urdu: ROTI, topic: " Food ", cefr: "a1", tags: ["HOME"] });
    expect(item).toMatchObject({ topic: "food", cefr: "A1", tags: ["home"] });
    const plain = await create({ urdu: PANI });
    expect(plain).toMatchObject({ topic: null, cefr: null, tags: [] });
  });

  it("refuse an unknown topic, level or tag, a third tag, or a tag equal to the topic", async () => {
    expect(
      (await invalid(await api("POST", "/api/vocab", { urdu: ROTI, topic: "objects" }))).field,
    ).toBe("topic");
    expect(
      (await invalid(await api("POST", "/api/vocab", { urdu: ROTI, cefr: "A2+" }))).field,
    ).toBe("cefr");
    expect(
      (await invalid(await api("POST", "/api/vocab", { urdu: ROTI, tags: ["verbs"] }))).field,
    ).toBe("tags");
    expect(
      (
        await invalid(
          await api("POST", "/api/vocab", { urdu: ROTI, tags: ["food", "home", "body"] }),
        )
      ).field,
    ).toBe("tags");
    expect(
      (
        await invalid(
          await api("POST", "/api/vocab", { urdu: ROTI, topic: "food", tags: ["food"] }),
        )
      ).field,
    ).toBe("tags");
  });

  it("clear topic and level with null, and drop a tag that the new topic now equals", async () => {
    const item = await create({ urdu: ROTI, topic: "home", cefr: "A1", tags: ["food"] });
    const moved = await json<VocabItem>(
      await api("PATCH", `/api/vocab/${item.id}`, { topic: "food" }),
    );
    expect(moved).toMatchObject({ topic: "food", tags: [] });
    const cleared = await json<VocabItem>(
      await api("PATCH", `/api/vocab/${item.id}`, { topic: null, cefr: null }),
    );
    expect(cleared).toMatchObject({ topic: null, cefr: null });
  });

  it("refuse a tag equal to the item's stored topic", async () => {
    const item = await create({ urdu: ROTI, topic: "food" });
    const res = await api("PATCH", `/api/vocab/${item.id}`, { tags: ["food"] });
    expect((await invalid(res)).field).toBe("tags");
  });

  it("keep legacy free tags until the tags are written again", async () => {
    const item = await create({ urdu: ROTI });
    await env.DB.prepare(`UPDATE vocab SET tags = '["objects"]' WHERE id = ?`).bind(item.id).run();
    const edited = await json<VocabItem>(
      await api("PATCH", `/api/vocab/${item.id}`, { english: "bread" }),
    );
    expect(edited.tags).toEqual(["objects"]);
    const retagged = await json<VocabItem>(
      await api("PATCH", `/api/vocab/${item.id}`, { tags: ["home"] }),
    );
    expect(retagged.tags).toEqual(["home"]);
  });
});

describe("pastes are lenient", () => {
  const paste = (proposals: unknown[]) =>
    api("POST", "/api/handoffs", {
      handoff_id: "h-topics",
      session_at: "2026-10-06T10:00:00Z",
      proposals,
    });

  it("keep what is valid and drop the rest with a note, never rejecting the paste", async () => {
    const body = await json<HandoffResponse>(
      await paste([
        {
          urdu: ROTI,
          topic: "Food",
          cefr: "a1",
          tags: ["home", "objects", "food", "body", "time"],
        },
        { urdu: PANI, topic: "drinks", cefr: "A2+", tags: ["verbs"] },
        { urdu: GHAR },
      ]),
    );
    expect(body.results.map((r) => r.outcome)).toEqual(["created", "created", "created"]);
    const [roti, pani, ghar] = body.results;
    expect(roti).toMatchObject({ dropped: ["tag objects", "tag food", "tag time"] });
    expect(pani).toMatchObject({ dropped: ["topic drinks", "level A2+", "tag verbs"] });
    expect(ghar).not.toHaveProperty("dropped");

    const items = await json<VocabListResponse>(await api("GET", "/api/vocab?sort=added"));
    const byUrdu = new Map(items.items.map((i) => [i.urdu, i]));
    expect(byUrdu.get(ROTI)).toMatchObject({ topic: "food", cefr: "A1", tags: ["home", "body"] });
    expect(byUrdu.get(PANI)).toMatchObject({ topic: null, cefr: null, tags: [] });
  });
});

describe("GET /api/coverage", () => {
  it("counts topic × level, queued included, B2+ kept, and unclassified when either is null", async () => {
    await create({ urdu: ROTI, topic: "food", cefr: "A1", tags: ["home"] });
    await create({ urdu: PANI, topic: "food", cefr: "B2" });
    await create({ urdu: GHAR, topic: "home" });
    await create({ urdu: KITAB, cefr: "A1" });
    await env.DB.prepare("UPDATE vocab SET released_at = NULL WHERE urdu = ?").bind(ROTI).run();

    const body = await json<CoverageResponse>(await api("GET", "/api/coverage"));
    expect(body.counts).toEqual({ food: { A1: 1, B2: 1 }, home: {} });
    expect(body.totals).toEqual({ food: 2, home: 1 });
    expect(body.unclassified).toBe(2);
    expect(body.total).toBe(4);
  });
});

describe("topic and level filters", () => {
  it("narrow the list and the due queue by topic only, not by secondary tag", async () => {
    await create({ urdu: ROTI, topic: "food", cefr: "A1" });
    await create({ urdu: PANI, topic: "food", cefr: "A2" });
    await create({ urdu: GHAR, topic: "home", cefr: "A1", tags: ["food"] });

    const food = await json<VocabListResponse>(await api("GET", "/api/vocab?topic=food"));
    expect(food.items.map((i) => i.urdu).sort()).toEqual([PANI, ROTI].sort());
    const a1 = await json<VocabListResponse>(await api("GET", "/api/vocab?topic=food&cefr=A1"));
    expect(a1.items.map((i) => i.urdu)).toEqual([ROTI]);
    const due = await json<DueResponse>(await api("GET", "/api/vocab/due?topic=home"));
    expect(due.items.map((i) => i.urdu)).toEqual([GHAR]);
    const dueA2 = await json<DueResponse>(await api("GET", "/api/vocab/due?cefr=a2"));
    expect(dueA2.items.map((i) => i.urdu)).toEqual([PANI]);
    const both = await json<VocabListResponse>(await api("GET", "/api/vocab?topic=home&tag=food"));
    expect(both.items.map((i) => i.urdu)).toEqual([GHAR]);
    const neither = await json<VocabListResponse>(
      await api("GET", "/api/vocab?topic=food&tag=food"),
    );
    expect(neither.total).toBe(0);
  });

  it("refuse an unknown topic or level", async () => {
    expect((await invalid(await api("GET", "/api/vocab?topic=objects"))).field).toBe("topic");
    expect((await invalid(await api("GET", "/api/vocab/due?cefr=Z9"))).field).toBe("cefr");
  });
});

describe("export", () => {
  it("carries topic and level", async () => {
    await create({ urdu: ROTI, topic: "food", cefr: "A1" });
    const body = await json<ExportResponse>(await api("GET", "/api/export"));
    expect(body.vocab[0]).toMatchObject({ topic: "food", cefr: "A1" });
  });
});
