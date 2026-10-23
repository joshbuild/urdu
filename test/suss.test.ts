// mp07 suss cards: flag and clear, the suss list, and the suss check batch that clears flags.
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  CheckBatchResponse,
  CorrectionsResponse,
  VocabItem,
  VocabListResponse,
} from "../shared/api";
import { type Api, clearTables, unlockedApi } from "./client";

const KITAB = "\u{06A9}\u{062A}\u{0627}\u{0628}"; // کتاب
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

async function create(urdu: string, english = "x"): Promise<VocabItem> {
  return json(await api("POST", "/api/vocab", { urdu, english, source: "manual" }), 201);
}

const flag = async (id: string, note: unknown) =>
  json<VocabItem>(await api("PUT", `/api/vocab/${id}/suss`, { note }));

const sussList = async () =>
  (await json<VocabListResponse>(await api("GET", "/api/vocab?suss=true"))).items;

describe("PUT and DELETE /api/vocab/:id/suss", () => {
  it("flags with a trimmed comment, keeps the first flag time, and clears", async () => {
    const item = await create(KITAB);
    const flagged = await flag(item.id, "  meaning seems off ");
    expect(flagged.suss_note).toBe("meaning seems off");
    expect(flagged.suss_at).not.toBeNull();

    const again = await flag(item.id, "");
    expect(again.suss_at).toBe(flagged.suss_at);
    expect(again.suss_note).toBeNull();

    const cleared = await json<VocabItem>(await api("DELETE", `/api/vocab/${item.id}/suss`));
    expect(cleared.suss_at).toBeNull();
    expect(cleared.suss_note).toBeNull();
  });

  it("is not an edit: updated_at and the schedule stay, and a grade still lands", async () => {
    const item = await create(KITAB);
    const flagged = await flag(item.id, "check the roman");
    expect(flagged.updated_at).toBe(item.updated_at);
    expect(flagged.due_at).toBe(item.due_at);
    expect(flagged.ladder_step).toBe(item.ladder_step);
    const res = await api("POST", `/api/vocab/${item.id}/reviews`, {
      grade: "correct",
      direction: "ur_en",
    });
    expect(res.status).toBe(201);
  });

  it("refuses a bad body and an unknown id", async () => {
    const item = await create(KITAB);
    expect((await api("PUT", `/api/vocab/${item.id}/suss`, { note: 3 })).status).toBe(400);
    expect((await api("PUT", `/api/vocab/${item.id}/suss`, { other: "x" })).status).toBe(400);
    expect((await api("PUT", `/api/vocab/${item.id}/suss`, { note: "x".repeat(501) })).status).toBe(
      400,
    );
    const missing = "01JZZZZZZZZZZZZZZZZZZZZZZZ";
    expect((await api("PUT", `/api/vocab/${missing}/suss`, { note: null })).status).toBe(404);
    expect((await api("DELETE", `/api/vocab/${missing}/suss`)).status).toBe(404);
  });

  it("lists only suss items, oldest flag first", async () => {
    const a = await create(KITAB);
    const b = await create(PANI);
    await create(GHAR);
    await flag(b.id, null);
    await flag(a.id, "second");
    expect((await sussList()).map((i) => i.id)).toEqual([b.id, a.id]);
  });
});

describe("suss check batch", () => {
  it("lists the suss cards in mode both over every field, ignoring the other options", async () => {
    const a = await create(KITAB);
    await create(PANI);
    await flag(a.id, "meaning?");
    const batch = await json<CheckBatchResponse>(
      await api("POST", "/api/handoffs/check-batch", {
        suss: true,
        mode: "completeness",
        fields: ["roman"],
        only_unchecked: true,
      }),
    );
    expect(batch.items.map((i) => i.id)).toEqual([a.id]);
    expect(batch.candidates).toBe(1);
    const row = await env.DB.prepare("SELECT payload FROM handoffs WHERE id = ?")
      .bind(batch.handoff_id)
      .first<{ payload: string }>();
    const payload = JSON.parse(row?.payload ?? "{}");
    expect(payload.mode).toBe("both");
    expect(payload.fields).toHaveLength(6);
    expect(typeof payload.suss_before).toBe("string");
  });

  it("returns no batch when nothing is suss", async () => {
    await create(KITAB);
    const batch = await json<CheckBatchResponse>(
      await api("POST", "/api/handoffs/check-batch", { suss: true }),
    );
    expect(batch.handoff_id).toBeNull();
  });

  it("applying clears the flags it carried, writes the ticked fix and keeps a later flag", async () => {
    const a = await create(KITAB, "copy");
    const b = await create(PANI, "water");
    await flag(a.id, "not copy, book");
    await flag(b.id, "fine?");
    const batch = await json<CheckBatchResponse>(
      await api("POST", "/api/handoffs/check-batch", { suss: true }),
    );
    const c = await create(GHAR);
    await flag(c.id, "flagged after the copy");

    const corrections = [
      { vocab_id: a.id, urdu: KITAB, english: "book", reason: "it means book", comment: "x" },
      { vocab_id: b.id, urdu: PANI, reason: "water is right" },
    ];
    const preview = await json<CorrectionsResponse>(
      await api("POST", "/api/handoffs/corrections?preview=1", {
        handoff_id: batch.handoff_id,
        corrections,
      }),
    );
    expect(preview.preview).toBe(true);
    const applied = await json<CorrectionsResponse>(
      await api("POST", "/api/handoffs/corrections", {
        handoff_id: batch.handoff_id,
        corrections,
        accept: [{ vocab_id: a.id, fields: { english: "copy" }, reset: false }],
      }),
    );
    expect(applied.preview).toBe(false);

    const list = await sussList();
    expect(list.map((i) => i.id)).toEqual([c.id]);
    const fixed = await json<VocabItem>(await api("GET", `/api/vocab/${a.id}`));
    expect(fixed.english).toBe("book");
    expect(fixed.suss_note).toBeNull();
  });
});
