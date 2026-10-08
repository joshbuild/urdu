// f18 s02: Next batch. POST /api/batches picks the cells and records the request; the reply comes
// back through POST /api/batches/handoffs into a harvest of the built-in Topics source.
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  BatchIssueResponse,
  BatchPasteResponse,
  CheckBatchResponse,
  HandoffResponse,
  VocabItem,
} from "../shared/api";
import { type Api, clearTables, unlockedApi } from "./client";

const KITAB = "\u{06A9}\u{062A}\u{0627}\u{0628}"; // کتاب
const PANI = "\u{067E}\u{0627}\u{0646}\u{06CC}"; // پانی
const GHAR = "\u{06AF}\u{06BE}\u{0631}"; // گھر
const MAIN = "\u{0645}\u{06CC}\u{06BA}"; // میں
const KYA = "\u{06A9}\u{06CC}\u{0627}"; // کیا

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

const issue = (body: unknown = {}) => api("POST", "/api/batches", body);

const reply = (id: string, proposals: unknown[]) => ({
  handoff_id: id,
  session_at: "2026-10-06T10:00:00Z",
  proposals,
});

async function row(sql: string, ...params: unknown[]) {
  return env.DB.prepare(sql)
    .bind(...params)
    .first<Record<string, unknown>>();
}

describe("POST /api/batches", () => {
  it("fills the Next batch size from the emptiest A1 cells and records the request", async () => {
    const body = await json<BatchIssueResponse>(await issue());
    expect(body.cells).toEqual([
      { topic: "pronouns", level: "A1", have: 0, quota: 20, ask: 20 },
      { topic: "questions", level: "A1", have: 0, quota: 14, ask: 5 },
    ]);
    expect(body.exclusions).toEqual([]);
    const stored = await row("SELECT status, payload FROM handoffs WHERE id = ?", body.handoff_id);
    expect(stored?.status).toBe("batch_issued");
    expect(JSON.parse(stored?.payload as string)).toEqual({ cells: body.cells });
  });

  it("follows the next_batch_size setting", async () => {
    await api("PATCH", "/api/settings", { next_batch_size: 40 });
    const body = await json<BatchIssueResponse>(await issue());
    expect(body.cells.map((c) => [c.topic, c.ask])).toEqual([
      ["pronouns", 20],
      ["questions", 14],
      ["postpositions", 6],
    ]);
    expect(body.cells.reduce((sum, c) => sum + c.ask, 0)).toBe(40);
  });

  it("excludes every word in the vault, whatever its topic, queued ones too", async () => {
    // At A2 or unclassified, so the A1 pick is unchanged.
    await create({ urdu: MAIN, topic: "pronouns", cefr: "A2" });
    await create({ urdu: KYA, topic: "discourse", tags: ["questions"] });
    await create({ urdu: GHAR });
    await env.DB.prepare("UPDATE vocab SET released_at = NULL WHERE urdu = ?").bind(MAIN).run();
    const body = await json<BatchIssueResponse>(await issue());
    expect(body.exclusions).toEqual([MAIN, KYA, GHAR]);
  });

  it("puts a tapped cell first, then fills from its level", async () => {
    const body = await json<BatchIssueResponse>(await issue({ topic: "Food", level: "B1" }));
    expect(body.cells.map((c) => [c.topic, c.level, c.ask])).toEqual([["food", "B1", 25]]);
    await api("PATCH", "/api/settings", { next_batch_size: 50 });
    const more = await json<BatchIssueResponse>(await issue({ topic: "Food", level: "B1" }));
    expect(more.cells.map((c) => [c.topic, c.level, c.ask])).toEqual([
      ["food", "B1", 30],
      ["pronouns", "B1", 8],
      ["questions", "B1", 2],
      ["postpositions", "B1", 10],
    ]);
  });

  it("refuses an unknown topic or a level without quotas, and a cell with nothing to ask", async () => {
    expect((await issue({ topic: "objects", level: "A1" })).status).toBe(400);
    expect((await issue({ topic: "food", level: "B2" })).status).toBe(400);
    expect((await issue({ topic: "food" })).status).toBe(400);
    const full = await issue({ topic: "idioms", level: "A1" }); // quota 0
    expect(full.status).toBe(409);
    expect(await full.json()).toMatchObject({ error: "nothing_to_ask" });
    expect(await row("SELECT count(*) AS n FROM handoffs")).toEqual({ n: 0 });
  });
});

describe("POST /api/batches/handoffs", () => {
  it("queues the words in a new harvest of the Topics source, with topic and level", async () => {
    const { handoff_id } = await json<BatchIssueResponse>(await issue());
    const body = await json<BatchPasteResponse>(
      await api(
        "POST",
        "/api/batches/handoffs",
        reply(handoff_id, [
          { urdu: MAIN, english: "I", topic: "pronouns", cefr: "A1" },
          { urdu: KYA, english: "what", topic: "questions", cefr: "A2", tags: ["objects"] },
        ]),
      ),
    );
    expect(body.repeat).toBe(false);
    expect(body.results.map((r) => r.outcome)).toEqual(["created", "created"]);
    expect(body.results[1]).toMatchObject({ dropped: ["tag objects"] });

    const harvest = await row("SELECT * FROM harvests WHERE id = ?", body.harvest_id);
    expect(harvest?.filter).toBe("A1 pronouns + A1 questions");
    const source = await row("SELECT * FROM sources WHERE id = ?", harvest?.source_id);
    expect(source?.name).toBe("Topics");
    const setting = await row("SELECT value FROM settings WHERE key = 'topics_source_id'");
    expect(setting?.value).toBe(source?.id);

    const items = (
      await env.DB.prepare("SELECT * FROM vocab ORDER BY urdu").all<Record<string, unknown>>()
    ).results;
    for (const item of items) {
      expect(item.harvest_id).toBe(body.harvest_id);
      expect(item.released_at).toBeNull();
    }
    // ChatGPT's own level wins over the requested one.
    expect(items.find((i) => i.urdu === KYA)).toMatchObject({ topic: "questions", cefr: "A2" });
    const stored = await row("SELECT status FROM handoffs WHERE id = ?", handoff_id);
    expect(stored?.status).toBe("applied");
  });

  it("starts the words at once with ?start=1, and reuses the Topics source", async () => {
    const first = await json<BatchIssueResponse>(await issue());
    await json(
      await api("POST", "/api/batches/handoffs", reply(first.handoff_id, [{ urdu: KITAB }])),
    );
    const second = await json<BatchIssueResponse>(await issue());
    const body = await json<BatchPasteResponse>(
      await api(
        "POST",
        "/api/batches/handoffs?start=1",
        reply(second.handoff_id, [{ urdu: PANI }]),
      ),
    );
    const item = await row("SELECT released_at FROM vocab WHERE urdu = ?", PANI);
    expect(item?.released_at).not.toBeNull();
    expect(await row("SELECT count(*) AS n FROM sources")).toEqual({ n: 1 });
    expect(body.harvest_id).not.toBeNull();
  });

  it("returns the stored result for a repeat, creating no second harvest", async () => {
    const { handoff_id } = await json<BatchIssueResponse>(await issue());
    const body = reply(handoff_id, [{ urdu: KITAB }]);
    const first = await json<BatchPasteResponse>(await api("POST", "/api/batches/handoffs", body));
    const again = await json<BatchPasteResponse>(await api("POST", "/api/batches/handoffs", body));
    expect(again).toEqual({ ...first, repeat: true });
    expect(await row("SELECT count(*) AS n FROM harvests")).toEqual({ n: 1 });
  });

  it("reports a word already in the vault as a duplicate", async () => {
    await create({ urdu: KITAB });
    const { handoff_id } = await json<BatchIssueResponse>(await issue());
    const body = await json<BatchPasteResponse>(
      await api("POST", "/api/batches/handoffs", reply(handoff_id, [{ urdu: KITAB }])),
    );
    expect(body.results[0]?.outcome).toBe("duplicate");
  });

  it("recreates the Topics source after it is deleted", async () => {
    const first = await json<BatchIssueResponse>(await issue());
    const a = await json<BatchPasteResponse>(
      await api("POST", "/api/batches/handoffs", reply(first.handoff_id, [{ urdu: KITAB }])),
    );
    const harvest = await row("SELECT source_id FROM harvests WHERE id = ?", a.harvest_id);
    expect((await api("DELETE", `/api/sources/${harvest?.source_id}`)).status).toBe(204);
    const second = await json<BatchIssueResponse>(await issue());
    const b = await json<BatchPasteResponse>(
      await api("POST", "/api/batches/handoffs", reply(second.handoff_id, [{ urdu: PANI }])),
    );
    const source = await row(
      "SELECT s.name FROM harvests h JOIN sources s ON s.id = h.source_id WHERE h.id = ?",
      b.harvest_id,
    );
    expect(source?.name).toBe("Topics");
  });

  it("is 404 for an unknown id or one that is not a batch, writing nothing", async () => {
    expect(
      (await api("POST", "/api/batches/handoffs", reply("nope", [{ urdu: KITAB }]))).status,
    ).toBe(404);
    await json<HandoffResponse>(
      await api("POST", "/api/handoffs", reply("plain", [{ urdu: PANI }])),
    );
    expect(
      (await api("POST", "/api/batches/handoffs", reply("plain", [{ urdu: KITAB }]))).status,
    ).toBe(404);
    await create({ urdu: GHAR, english: "house" });
    const check = await json<CheckBatchResponse>(
      await api("POST", "/api/handoffs/check-batch", {}),
    );
    expect(
      (
        await api(
          "POST",
          "/api/batches/handoffs",
          reply(String(check.handoff_id), [{ urdu: KITAB }]),
        )
      ).status,
    ).toBe(404);
    expect(await row("SELECT count(*) AS n FROM vocab WHERE urdu = ?", KITAB)).toEqual({ n: 0 });
  });

  it("waits while a paste of the batch is under way, and takes over a claim left by a dead one", async () => {
    const { handoff_id } = await json<BatchIssueResponse>(await issue());
    const claim = (at: string) =>
      env.DB.prepare("UPDATE handoffs SET status = 'batch_pasting', imported_at = ? WHERE id = ?")
        .bind(at, handoff_id)
        .run();
    const body = reply(handoff_id, [{ urdu: KITAB }]);
    await claim(new Date().toISOString());
    const busy = await api("POST", "/api/batches/handoffs", body);
    expect(busy.status).toBe(409);
    expect(await row("SELECT count(*) AS n FROM vocab")).toEqual({ n: 0 });

    await claim(new Date(Date.now() - 61_000).toISOString());
    const taken = await json<BatchPasteResponse>(await api("POST", "/api/batches/handoffs", body));
    expect(taken.results[0]?.outcome).toBe("created");
  });

  it("reuses the harvest a dead paste made, leaving no orphan", async () => {
    const { handoff_id } = await json<BatchIssueResponse>(await issue());
    const first = await json<BatchPasteResponse>(
      await api("POST", "/api/batches/handoffs", reply(handoff_id, [{ urdu: KITAB }])),
    );
    // As if that paste died after its harvest and first word: claimed long ago, not applied.
    const payload = JSON.parse(
      (await row("SELECT payload FROM handoffs WHERE id = ?", handoff_id))?.payload as string,
    );
    await env.DB.prepare(
      "UPDATE handoffs SET status = 'batch_pasting', imported_at = ?, payload = ? WHERE id = ?",
    )
      .bind(
        new Date(Date.now() - 120_000).toISOString(),
        JSON.stringify({ cells: payload.cells, harvest_id: payload.harvest_id }),
        handoff_id,
      )
      .run();
    const again = await json<BatchPasteResponse>(
      await api(
        "POST",
        "/api/batches/handoffs",
        reply(handoff_id, [{ urdu: KITAB }, { urdu: PANI }]),
      ),
    );
    expect(again.harvest_id).toBe(first.harvest_id);
    expect(again.results.map((r) => r.outcome)).toEqual(["duplicate", "created"]);
    expect(await row("SELECT count(*) AS n FROM harvests")).toEqual({ n: 1 });
  });

  it("answers an applied batch's id on the plain paste route with the stored result", async () => {
    const { handoff_id } = await json<BatchIssueResponse>(await issue());
    const body = reply(handoff_id, [{ urdu: KITAB }]);
    const first = await json<BatchPasteResponse>(await api("POST", "/api/batches/handoffs", body));
    const plain = await json<HandoffResponse>(await api("POST", "/api/handoffs", body));
    expect(plain).toEqual({ handoff_id, repeat: true, results: first.results });
  });

  it("refuses a batch id pasted as plain new vocab", async () => {
    const { handoff_id } = await json<BatchIssueResponse>(await issue());
    expect((await api("POST", "/api/handoffs", reply(handoff_id, [{ urdu: KITAB }]))).status).toBe(
      409,
    );
  });
});
