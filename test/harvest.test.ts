// f17 (FR-K): sources, harvests, the Harvest overview, and pasting new vocab into a harvest.
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  ExportResponse,
  HandoffResponse,
  Harvest,
  HarvestDetail,
  HarvestOverview,
  Source,
  SourceConflictResponse,
  SourceDetail,
  VocabItem,
} from "../shared/api";
import { todayIn } from "../shared/dates";
import { type Api, clearTables, unlockedApi } from "./client";

const KITAB = "\u{06A9}\u{062A}\u{0627}\u{0628}"; // کتاب
const PANI = "\u{067E}\u{0627}\u{0646}\u{06CC}"; // پانی
const GHAR = "\u{06AF}\u{06BE}\u{0631}"; // گھر

let api: Api;

beforeEach(async () => {
  await clearTables();
  api = await unlockedApi();
  // Today's top-up has run, so reads here release nothing.
  await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('intake_topup', ?)")
    .bind(`${todayIn(env.HOME_TZ)}:claimed`)
    .run();
});

async function json<T>(res: Response, status = 200): Promise<T> {
  expect(res.status).toBe(status);
  return res.json();
}

const source = (body: Record<string, unknown>) =>
  api("POST", "/api/sources", body).then((r) => json<Source>(r, 201));
const harvest = (sourceId: string, body: Record<string, unknown> = {}) =>
  api("POST", `/api/sources/${sourceId}/harvests`, body).then((r) => json<Harvest>(r, 201));

const paste = (harvestId: string, urdus: string[], id = "h-1", start = false) =>
  api("POST", `/api/harvests/${harvestId}/handoffs${start ? "?start=1" : ""}`, {
    handoff_id: id,
    session_at: "2026-10-01T10:00:00Z",
    proposals: urdus.map((urdu) => ({ urdu, english: "x" })),
  });

async function item(id: string): Promise<VocabItem> {
  return json(await api("GET", `/api/vocab/${id}`));
}

describe("sources", () => {
  it("creates with trimmed fields, edits, and clears url and notes", async () => {
    const s = await source({ name: "  Story one ", url: " https://x.test/a ", notes: " n " });
    expect(s).toMatchObject({ name: "Story one", url: "https://x.test/a", notes: "n" });
    expect(s.id).toHaveLength(26);

    const edited = await json<Source>(
      await api("PATCH", `/api/sources/${s.id}`, { name: "Story 1", url: "", notes: null }),
    );
    expect(edited).toMatchObject({ name: "Story 1", url: null, notes: null });
    expect(edited.created_at).toBe(s.created_at);
  });

  it("allows several sources without a URL", async () => {
    await source({ name: "ChatGPT chat" });
    await source({ name: "Another chat", url: null });
  });

  it("409s a URL another source has, on create and on edit, with that source's id", async () => {
    const a = await source({ name: "A", url: "https://x.test/a" });
    const dup = await json<SourceConflictResponse>(
      await api("POST", "/api/sources", { name: "B", url: " https://x.test/a" }),
      409,
    );
    expect(dup).toEqual({ error: "duplicate_source", existing_id: a.id });

    const b = await source({ name: "B", url: "https://x.test/b" });
    const clash = await json<SourceConflictResponse>(
      await api("PATCH", `/api/sources/${b.id}`, { url: "https://x.test/a" }),
      409,
    );
    expect(clash.existing_id).toBe(a.id);
    // Saving a source with its own URL is not a clash.
    await json(await api("PATCH", `/api/sources/${a.id}`, { url: "https://x.test/a" }));
  });

  it.each([
    {},
    { name: "" },
    { name: "   " },
    { name: "x".repeat(201) },
    { name: "A", url: "ftp://x.test" },
    { name: "A", url: "not a url" },
    // Parses as a URL, but would make a second source for the same page.
    { name: "A", url: "http:x.test/a" },
    { name: "A", notes: "n".repeat(2001) },
    { name: "A", url: `https://x.test/${"a".repeat(2000)}` },
    { name: "A", colour: "red" },
    { name: 3 },
  ])("rejects %j with 400", async (body) => {
    expect((await api("POST", "/api/sources", body)).status).toBe(400);
  });

  it.each([{ colour: "red" }, { name: "" }, { url: "ftp://x.test" }, { notes: 3 }])(
    "rejects PATCH %j with 400",
    async (body) => {
      const s = await source({ name: "A" });
      expect((await api("PATCH", `/api/sources/${s.id}`, body)).status).toBe(400);
    },
  );

  it("404s an unknown source", async () => {
    const unknown = "01JZZZZZZZZZZZZZZZZZZZZZZZ";
    expect((await api("GET", `/api/sources/${unknown}`)).status).toBe(404);
    expect((await api("PATCH", `/api/sources/${unknown}`, { name: "x" })).status).toBe(404);
    expect((await api("DELETE", `/api/sources/${unknown}`)).status).toBe(404);
    expect((await api("POST", `/api/sources/${unknown}/harvests`, {})).status).toBe(404);
  });

  it("delete removes its harvests and unlinks their items, which stay in the vault", async () => {
    const s = await source({ name: "A", url: "https://x.test/a" });
    const h = await harvest(s.id, { filter: "CEFR A2+" });
    const pasted = await json<HandoffResponse>(await paste(h.id, [KITAB, PANI]));
    const ids = pasted.results.map((r) => (r.outcome === "created" ? r.id : ""));
    const before = await item(ids[0] as string);

    const detail = await json<SourceDetail>(await api("GET", `/api/sources/${s.id}`));
    expect(detail.words).toBe(2);

    expect((await api("DELETE", `/api/sources/${s.id}`)).status).toBe(204);
    expect((await api("GET", `/api/sources/${s.id}`)).status).toBe(404);
    expect((await api("GET", `/api/harvests/${h.id}`)).status).toBe(404);
    const after = await item(ids[0] as string);
    expect(after).toEqual({ ...before, harvest_id: null });
    expect((await item(ids[1] as string)).released_at).toBeNull();
  });
});

describe("harvests", () => {
  it("creates with a trimmed filter, or none", async () => {
    const s = await source({ name: "A" });
    expect((await harvest(s.id, { filter: " CEFR A2+ " })).filter).toBe("CEFR A2+");
    expect((await harvest(s.id, { filter: "" })).filter).toBeNull();
    expect((await harvest(s.id)).filter).toBeNull();
    for (const bad of [{ filter: "x".repeat(101) }, { filter: 2 }, { level: "A2" }]) {
      expect((await api("POST", `/api/sources/${s.id}/harvests`, bad)).status).toBe(400);
    }
  });

  it("deletes only while empty", async () => {
    const s = await source({ name: "A" });
    const empty = await harvest(s.id);
    const full = await harvest(s.id);
    await json(await paste(full.id, [KITAB]));
    expect((await api("DELETE", `/api/harvests/${full.id}`)).status).toBe(409);
    expect((await api("DELETE", `/api/harvests/${empty.id}`)).status).toBe(204);
    expect((await api("DELETE", `/api/harvests/${empty.id}`)).status).toBe(404);
  });

  it("detail and source detail count total, queued and started, newest harvest first", async () => {
    const s = await source({ name: "A", url: "https://x.test/a" });
    const first = await harvest(s.id, { filter: "A1" });
    const second = await harvest(s.id, { filter: "A2" });
    const pasted = await json<HandoffResponse>(await paste(first.id, [KITAB, PANI, GHAR]));
    const [a, b] = pasted.results.map((r) => (r.outcome === "created" ? r.id : ""));
    await json(await api("POST", `/api/vocab/${a}/release`));
    await json(await api("POST", `/api/vocab/${b}/release`));
    await json(
      await api("POST", `/api/vocab/${a}/reviews`, { grade: "correct", direction: "ur_en" }),
      201,
    );

    const detail = await json<HarvestDetail>(await api("GET", `/api/harvests/${first.id}`));
    expect(detail.source.id).toBe(s.id);
    expect(detail.harvest).toMatchObject({ id: first.id, total: 3, queued: 1, started: 1 });

    const sd = await json<SourceDetail>(await api("GET", `/api/sources/${s.id}`));
    expect(sd.harvests.map((h) => h.id)).toEqual([second.id, first.id]);
    expect(sd.harvests[1]).toMatchObject({ total: 3, queued: 1, started: 1 });
    expect(sd.harvests[0]).toMatchObject({ total: 0, queued: 0, started: 0 });
  });
});

describe("POST /api/harvests/:id/handoffs", () => {
  it("queues created items by default and links them to the harvest", async () => {
    const s = await source({ name: "A" });
    const h = await harvest(s.id);
    const body = await json<HandoffResponse>(await paste(h.id, [KITAB, PANI]));
    expect(body.results.map((r) => r.outcome)).toEqual(["created", "created"]);
    for (const r of body.results) {
      const it = await item(r.outcome === "created" ? r.id : "");
      expect(it).toMatchObject({ harvest_id: h.id, released_at: null, source: "coach" });
    }
    const due = await json<{ items: VocabItem[] }>(await api("GET", "/api/vocab/due"));
    expect(due.items).toHaveLength(0);
  });

  it("start=1 releases them at once", async () => {
    const s = await source({ name: "A" });
    const h = await harvest(s.id);
    const body = await json<HandoffResponse>(await paste(h.id, [KITAB], "h-1", true));
    const created = body.results[0];
    const it = await item(created?.outcome === "created" ? created.id : "");
    expect(it.harvest_id).toBe(h.id);
    expect(it.released_at).toBe(it.added_at);
  });

  it("a duplicate keeps its original harvest; a repeated handoff_id writes nothing", async () => {
    const s = await source({ name: "A" });
    const h1 = await harvest(s.id);
    const h2 = await harvest(s.id);
    const first = await json<HandoffResponse>(await paste(h1.id, [KITAB], "h-1"));
    const id = first.results[0]?.outcome === "created" ? first.results[0].id : "";

    const second = await json<HandoffResponse>(await paste(h2.id, [KITAB, PANI], "h-2"));
    expect(second.results[0]).toMatchObject({ outcome: "duplicate", existing_id: id });
    expect((await item(id)).harvest_id).toBe(h1.id);

    const repeat = await json<HandoffResponse>(await paste(h2.id, [GHAR], "h-2"));
    expect(repeat.repeat).toBe(true);
    expect(repeat.results).toEqual(second.results);
    const n = await env.DB.prepare("SELECT count(*) AS n FROM vocab").first<{ n: number }>();
    expect(n?.n).toBe(2);
  });

  it("404s an unknown harvest and 400s a bad body", async () => {
    expect((await paste("01JZZZZZZZZZZZZZZZZZZZZZZZ", [KITAB])).status).toBe(404);
    const s = await source({ name: "A" });
    const h = await harvest(s.id);
    expect((await api("POST", `/api/harvests/${h.id}/handoffs`, { proposals: [] })).status).toBe(
      400,
    );
  });

  it("the plain /api/handoffs path still releases at once", async () => {
    const body = await json<HandoffResponse>(
      await api("POST", "/api/handoffs", {
        handoff_id: "plain",
        session_at: "2026-10-01T10:00:00Z",
        proposals: [{ urdu: KITAB }],
      }),
    );
    const created = body.results[0];
    const it = await item(created?.outcome === "created" ? created.id : "");
    expect(it).toMatchObject({ harvest_id: null });
    expect(it.released_at).toBe(it.added_at);
  });
});

describe("GET /api/harvest", () => {
  it("lists to-harvest sources newest first, then harvested by latest harvest, with the tank", async () => {
    const old = await source({ name: "old, to harvest" });
    const done1 = await source({ name: "harvested first" });
    const done2 = await source({ name: "harvested second", url: "https://x.test/2" });
    const fresh = await source({ name: "new, to harvest" });
    const at = (iso: string, table: string, id: string) =>
      env.DB.prepare(`UPDATE ${table} SET created_at = ? WHERE id = ?`).bind(iso, id).run();
    await at("2026-09-01T00:00:00.000Z", "sources", old.id);
    await at("2026-09-02T00:00:00.000Z", "sources", done1.id);
    await at("2026-09-03T00:00:00.000Z", "sources", done2.id);
    await at("2026-09-04T00:00:00.000Z", "sources", fresh.id);
    const h1 = await harvest(done1.id, { filter: "A1" });
    const h2 = await harvest(done2.id, { filter: "B1" });
    const h1b = await harvest(done1.id, { filter: "A2+" });
    await at("2026-09-10T00:00:00.000Z", "harvests", h1.id);
    await at("2026-09-11T00:00:00.000Z", "harvests", h2.id);
    await at("2026-09-12T00:00:00.000Z", "harvests", h1b.id);
    await json(await paste(h1b.id, [KITAB, PANI]));

    const body = await json<HarvestOverview>(await api("GET", "/api/harvest"));
    expect(body.intake).toEqual({ queued: 2, new: 0, batch_size: 10 });
    expect(body.sources.map((s) => s.id)).toEqual([fresh.id, old.id, done1.id, done2.id]);
    expect(body.sources[0]).toMatchObject({ status: "to_harvest", harvest_count: 0, latest: null });
    expect(body.sources[2]).toMatchObject({
      status: "harvested",
      harvest_count: 2,
      latest: { filter: "A2+", created_at: "2026-09-12T00:00:00.000Z" },
    });
  });

  it("tops up the new pile first", async () => {
    await env.DB.prepare("DELETE FROM settings WHERE key = 'intake_topup'").run();
    const s = await source({ name: "A" });
    const h = await harvest(s.id);
    await json(await paste(h.id, [KITAB, PANI]));
    const body = await json<HarvestOverview>(await api("GET", "/api/harvest"));
    expect(body.intake).toEqual({ queued: 0, new: 2, batch_size: 10 });
  });
});

describe("export", () => {
  it("includes sources and harvests", async () => {
    const s = await source({ name: "A", url: "https://x.test/a" });
    const h = await harvest(s.id, { filter: "A2" });
    const vault = await json<ExportResponse>(await api("GET", "/api/export"));
    expect(vault.sources).toEqual([s]);
    expect(vault.harvests).toEqual([h]);
  });
});
