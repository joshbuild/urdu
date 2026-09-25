// f11 accuracy check (FR-F9): corrections preview and apply (s02).
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  CheckBatchResponse,
  CorrectionPlan,
  CorrectionResult,
  CorrectionsResponse,
  InvalidRequestResponse,
  VocabItem,
} from "../shared/api";
import { correctStep } from "../shared/ladders";
import { applyCorrections, readItems } from "../worker/domain/check";
import { type Api, clearTables, unlockedApi } from "./client";

const KITAB = "\u{06A9}\u{062A}\u{0627}\u{0628}"; // کتاب
const KITAB_WITH_KASRA = "\u{06A9}\u{0650}\u{062A}\u{0627}\u{0628}"; // کِتاب
const PANI = "\u{067E}\u{0627}\u{0646}\u{06CC}"; // پانی
const GHAR = "\u{06AF}\u{06BE}\u{0631}"; // گھر
const KHANA = "\u{06A9}\u{06BE}\u{0627}\u{0646}\u{0627}"; // کھانا
const KHAANA = "\u{06A9}\u{06BE}\u{0627}\u{0646}\u{06C1}"; // کھانہ

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

async function getItem(id: string): Promise<VocabItem> {
  return json(await api("GET", `/api/vocab/${id}`));
}

async function issue(): Promise<string> {
  const batch = await json<CheckBatchResponse>(await api("POST", "/api/handoffs/check-batch", {}));
  if (!batch.handoff_id) throw new Error("no batch issued");
  return batch.handoff_id;
}

const preview = (body: unknown) => api("POST", "/api/handoffs/corrections?preview=1", body);
const apply = (body: unknown) => api("POST", "/api/handoffs/corrections", body);

async function handoffRow(id: string) {
  return env.DB.prepare("SELECT status, payload, outcome FROM handoffs WHERE id = ?")
    .bind(id)
    .first<{ status: string; payload: string; outcome: string | null }>();
}

async function count(table: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>();
  return row?.n ?? -1;
}

function checked(result: CorrectionPlan | CorrectionResult | undefined) {
  if (result?.outcome !== "checked") throw new Error(`expected checked, got ${result?.outcome}`);
  return result;
}

const SCHEDULE = [
  "ladder_id",
  "ladder_step",
  "interval_seconds",
  "last_reviewed_at",
  "due_at",
] as const;

describe("parsing /api/handoffs/corrections", () => {
  const fix = { vocab_id: "a", urdu: PANI, english: "water", reason: "stiff" };

  it.each([
    [
      "an unknown field",
      false,
      { handoff_id: "h", corrections: [{ ...fix, tags: [] }] },
      "corrections[0].tags",
    ],
    [
      "a missing reason",
      false,
      { handoff_id: "h", corrections: [{ vocab_id: "a", urdu: PANI }] },
      "corrections[0].reason",
    ],
    [
      "an empty reason",
      false,
      { handoff_id: "h", corrections: [{ ...fix, reason: "  " }] },
      "corrections[0].reason",
    ],
    [
      "a repeated vocab_id",
      false,
      { handoff_id: "h", corrections: [fix, fix] },
      "corrections[1].vocab_id",
    ],
    [
      "more than 20",
      false,
      {
        handoff_id: "h",
        corrections: Array.from({ length: 21 }, (_, i) => ({ ...fix, vocab_id: `v${i}` })),
      },
      "corrections",
    ],
    ["accept on a preview", false, { handoff_id: "h", corrections: [], accept: [] }, "accept"],
    ["an apply without accept", true, { handoff_id: "h", corrections: [] }, "accept"],
    [
      "an accept for a vocab_id not pasted",
      true,
      { handoff_id: "h", corrections: [fix], accept: [{ vocab_id: "b", fields: {}, reset: true }] },
      "accept[0].vocab_id",
    ],
    [
      "an accept for a field not proposed",
      true,
      {
        handoff_id: "h",
        corrections: [fix],
        accept: [{ vocab_id: "a", fields: { roman: null }, reset: false }],
      },
      "accept[0].fields.roman",
    ],
    [
      "an accept of nothing",
      true,
      {
        handoff_id: "h",
        corrections: [fix],
        accept: [{ vocab_id: "a", fields: {}, reset: false }],
      },
      "accept[0].fields",
    ],
  ])("rejects %s", async (_name, isApply, body, field) => {
    const res = await json<InvalidRequestResponse>(await (isApply ? apply : preview)(body), 400);
    expect(res.field).toBe(field);
  });

  it("accepts an empty corrections list and reads an empty string as a removal", async () => {
    const item = await create({ urdu: PANI, english: "water", notes: "n" });
    const handoff_id = await issue();
    const empty = await json<CorrectionsResponse>(await preview({ handoff_id, corrections: [] }));
    expect(empty).toEqual({ handoff_id, preview: true, repeat: false, batch_size: 1, results: [] });

    const body = await json<CorrectionsResponse>(
      await preview({
        handoff_id,
        corrections: [{ vocab_id: item.id, urdu: PANI, notes: "", reason: "wrong note" }],
      }),
    );
    expect(body.results[0]).toMatchObject({
      outcome: "correct",
      changes: [{ field: "notes", old: "n", new: null }],
    });
  });
});

describe("POST /api/handoffs/corrections?preview=1", () => {
  it("plans old → new per field and writes nothing", async () => {
    const item = await create({ urdu: KITAB, roman: "kitab", english: "a book" });
    const handoff_id = await issue();
    const body = await json<CorrectionsResponse>(
      await preview({
        handoff_id,
        corrections: [
          {
            vocab_id: item.id,
            urdu: KITAB_WITH_KASRA,
            roman: "kitaab",
            english: "a book",
            example_english: "My book.",
            reason: "long vowel",
          },
        ],
      }),
    );
    expect(body).toEqual({
      handoff_id,
      preview: true,
      repeat: false,
      batch_size: 1,
      results: [
        {
          vocab_id: item.id,
          urdu: KITAB_WITH_KASRA,
          outcome: "correct",
          // english is unchanged, so it is dropped.
          changes: [
            { field: "roman", old: "kitab", new: "kitaab" },
            { field: "example_english", old: null, new: "My book." },
          ],
          reason: "long vowel",
        },
      ],
    });
    expect(await getItem(item.id)).toEqual(item);
    expect((await handoffRow(handoff_id))?.status).toBe("check_issued");
  });

  it("rejects rows outside the batch, deleted since the copy, or with the wrong urdu", async () => {
    const kitab = await create({ urdu: KITAB });
    const pani = await create({ urdu: PANI });
    const ghar = await create({ urdu: GHAR });
    const handoff_id = await issue();
    const later = await create({ urdu: KHANA });
    await api("DELETE", `/api/vocab/${ghar.id}`);

    const body = await json<CorrectionsResponse>(
      await preview({
        handoff_id,
        corrections: [
          { vocab_id: later.id, urdu: KHANA, roman: "khaana", reason: "r" },
          { vocab_id: ghar.id, urdu: GHAR, roman: "ghar", reason: "r" },
          { vocab_id: kitab.id, urdu: PANI, roman: "paani", reason: "r" },
          { vocab_id: pani.id, urdu: PANI, roman: "paani", reason: "r" },
        ],
      }),
    );
    expect(body.results.map((r) => [r.outcome, r.outcome === "rejected" ? r.reason : ""])).toEqual([
      ["rejected", "not in this check batch"],
      ["rejected", "no item has this id"],
      ["rejected", `urdu does not match the stored item (${KITAB})`],
      ["correct", ""],
    ]);
  });

  it("keeps a new spelling as a flag and drops one with the item's own key", async () => {
    const khana = await create({ urdu: KHANA, english: "food" });
    const kitab = await create({ urdu: KITAB, english: "book" });
    const handoff_id = await issue();
    const body = await json<CorrectionsResponse>(
      await preview({
        handoff_id,
        corrections: [
          {
            vocab_id: khana.id,
            urdu: KHANA,
            english: "food",
            urdu_suggestion: KHAANA,
            reason: "r",
          },
          { vocab_id: kitab.id, urdu: KITAB, urdu_suggestion: KITAB_WITH_KASRA, reason: "r" },
        ],
      }),
    );
    expect(body.results).toEqual([
      {
        vocab_id: khana.id,
        urdu: KHANA,
        outcome: "nothing",
        changes: [],
        reason: "r",
        urdu_suggestion: KHAANA,
      },
      { vocab_id: kitab.id, urdu: KITAB, outcome: "nothing", changes: [], reason: "r" },
    ]);
  });

  it("answers an unknown handoff_id with 400 and another kind of handoff with 409", async () => {
    const unknown = await json<InvalidRequestResponse>(
      await preview({ handoff_id: "nope", corrections: [] }),
      400,
    );
    expect(unknown.field).toBe("handoff_id");

    await api("POST", "/api/handoffs", {
      handoff_id: "chat-1",
      session_at: "2026-09-24T10:00:00Z",
      proposals: [{ urdu: PANI }],
    });
    expect((await preview({ handoff_id: "chat-1", corrections: [] })).status).toBe(409);
  });
});

describe("POST /api/handoffs/corrections (apply)", () => {
  it("writes only the ticked fields, stamps the whole batch and records the outcome", async () => {
    const kitab = await create({ urdu: KITAB, roman: "kitab", english: "a book", notes: "old" });
    const pani = await create({ urdu: PANI, english: "water" });
    const left = await create({ urdu: GHAR, english: "house" });
    const handoff_id = await issue();
    const corrections = [
      {
        vocab_id: kitab.id,
        urdu: KITAB,
        roman: "kitaab",
        english: "book",
        notes: null,
        example_urdu: `${KITAB} ${KITAB}`,
        reason: "r",
      },
      { vocab_id: pani.id, urdu: PANI, english: "water (drink)", reason: "r" },
    ];
    const accept = [
      // english is left unticked.
      {
        vocab_id: kitab.id,
        fields: { roman: "kitab", notes: "old", example_urdu: null },
        reset: false,
      },
    ];

    const body = await json<CorrectionsResponse>(await apply({ handoff_id, corrections, accept }));
    expect(body.preview).toBe(false);
    expect(body.repeat).toBe(false);
    expect(body.batch_size).toBe(3);
    expect(checked(body.results[0])).toMatchObject({
      written: [
        { field: "roman", old: "kitab", new: "kitaab" },
        { field: "notes", old: "old", new: null },
        { field: "example_urdu", old: null, new: `${KITAB} ${KITAB}` },
      ],
      kept: [],
      declined: ["english"],
      reset: "not_asked",
    });
    expect(checked(body.results[1])).toMatchObject({ written: [], declined: ["english"] });

    const after = await getItem(kitab.id);
    expect(after).toMatchObject({
      roman: "kitaab",
      english: "a book",
      notes: null,
      example_urdu: `${KITAB} ${KITAB}`,
    });
    for (const key of SCHEDULE) expect(after[key]).toEqual(kitab[key]);
    expect(await count("review_events")).toBe(0);

    // Every batch item is stamped; the stamp alone leaves updated_at as it was.
    for (const item of [kitab, pani, left]) {
      expect((await getItem(item.id)).checked_at).toBe(after.checked_at);
    }
    expect(after.checked_at).not.toBeNull();
    expect((await getItem(pani.id)).updated_at).toBe(pani.updated_at);
    expect((await getItem(left.id)).updated_at).toBe(left.updated_at);

    const row = await handoffRow(handoff_id);
    expect(row?.status).toBe("checked");
    const payload = JSON.parse(row?.payload ?? "");
    expect(payload).toEqual({ vocab_ids: expect.any(Array), corrections, accept });
    // Items added in the same millisecond order by id, which is random within it.
    expect(payload.vocab_ids.sort()).toEqual([kitab.id, pani.id, left.id].sort());
    expect(JSON.parse(row?.outcome ?? "")).toEqual(body.results);
  });

  it("keeps a field edited between the preview and the apply, and reports it", async () => {
    const item = await create({ urdu: PANI, roman: "pani", english: "water" });
    const handoff_id = await issue();
    const corrections = [
      { vocab_id: item.id, urdu: PANI, roman: "paani", english: "water (n.)", reason: "r" },
    ];
    await json(await preview({ handoff_id, corrections }));
    await api("PATCH", `/api/vocab/${item.id}`, { roman: "paanee" });

    const body = await json<CorrectionsResponse>(
      await apply({
        handoff_id,
        corrections,
        accept: [{ vocab_id: item.id, fields: { roman: "pani", english: "water" }, reset: false }],
      }),
    );
    expect(checked(body.results[0])).toMatchObject({
      written: [{ field: "english", old: "water", new: "water (n.)" }],
      kept: ["roman"],
    });
    expect(await getItem(item.id)).toMatchObject({ roman: "paanee", english: "water (n.)" });
  });

  it("resets a ticked item to the first rung from its last review, with no event", async () => {
    const item = await create({ urdu: PANI, english: "water" });
    await json(
      await api("POST", `/api/vocab/${item.id}/reviews`, { grade: "correct", direction: "ur_en" }),
      201,
    );
    await json(
      await api("POST", `/api/vocab/${item.id}/reviews`, { grade: "correct", direction: "ur_en" }),
      201,
    );
    const reviewed = await getItem(item.id);
    expect(reviewed.ladder_step).toBe(2);
    const handoff_id = await issue();

    const body = await json<CorrectionsResponse>(
      await apply({
        handoff_id,
        corrections: [{ vocab_id: item.id, urdu: PANI, reason: "r" }],
        accept: [{ vocab_id: item.id, fields: {}, reset: true }],
      }),
    );
    expect(checked(body.results[0]).reset).toBe("applied");
    const after = await getItem(item.id);
    expect(after).toMatchObject({
      ...correctStep(0, 3, reviewed.last_reviewed_at),
      last_reviewed_at: reviewed.last_reviewed_at,
    });
    expect(await count("review_events")).toBe(2);
  });

  it("skips a reset and keeps a field when the row changed after the read", async () => {
    const item = await create({ urdu: PANI, english: "water" });
    const handoff_id = await issue();
    const stale = await readItems(env.DB, [item.id]);
    // A review and an edit land between the read and the write.
    await json(
      await api("POST", `/api/vocab/${item.id}/reviews`, { grade: "correct", direction: "ur_en" }),
      201,
    );
    await api("PATCH", `/api/vocab/${item.id}`, { english: "drinking water" });
    const moved = await getItem(item.id);

    const request = {
      handoff_id,
      corrections: [{ vocab_id: item.id, urdu: PANI, english: "water (n.)", reason: "r" }],
      accept: [{ vocab_id: item.id, fields: { english: "water" }, reset: true }],
    };
    const body = await applyCorrections(env.DB, request, [item.id], stale, new Date(), 3);
    if (typeof body === "string") throw new Error(body);
    const result = checked(body.results[0]);
    expect(result).toMatchObject({ written: [], kept: ["english"], reset: "skipped" });

    const after = await getItem(item.id);
    expect(after.english).toBe("drinking water");
    for (const key of SCHEDULE) expect(after[key]).toEqual(moved[key]);
    expect(JSON.parse((await handoffRow(handoff_id))?.outcome ?? "")).toEqual(body.results);
  });

  it("reports an accepted item deleted since the preview as rejected", async () => {
    const pani = await create({ urdu: PANI, english: "water" });
    const ghar = await create({ urdu: GHAR, english: "home" });
    const handoff_id = await issue();
    await api("DELETE", `/api/vocab/${ghar.id}`);
    const body = await json<CorrectionsResponse>(
      await apply({
        handoff_id,
        corrections: [{ vocab_id: ghar.id, urdu: GHAR, english: "house", reason: "r" }],
        accept: [{ vocab_id: ghar.id, fields: { english: "home" }, reset: true }],
      }),
    );
    expect(body.results[0]).toMatchObject({ outcome: "rejected", reason: "no item has this id" });
    expect((await getItem(pani.id)).checked_at).not.toBeNull();
  });

  it("marks an all-fine batch checked, and treats a second paste as a repeat", async () => {
    const item = await create({ urdu: PANI, english: "water" });
    const handoff_id = await issue();
    const request = {
      handoff_id,
      corrections: [{ vocab_id: item.id, urdu: PANI, english: "H2O", reason: "r" }],
      accept: [],
    };
    const first = await json<CorrectionsResponse>(await apply(request));
    const stamped = await getItem(item.id);
    expect(stamped.checked_at).not.toBeNull();
    expect(stamped.english).toBe("water");
    expect((await handoffRow(handoff_id))?.status).toBe("checked");

    const again = await json<CorrectionsResponse>(
      await apply({
        ...request,
        accept: [{ vocab_id: item.id, fields: { english: "water" }, reset: false }],
      }),
    );
    expect(again).toEqual({ ...first, repeat: true });
    const previewed = await json<CorrectionsResponse>(
      await preview({ handoff_id, corrections: request.corrections }),
    );
    expect(previewed).toEqual({ ...first, repeat: true });
    expect(await getItem(item.id)).toEqual(stamped);
  });
});
