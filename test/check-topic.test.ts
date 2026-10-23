// mp08 s02: Topic & level as a check field — selection, lenient parsing, scope rules and apply.
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  CheckBatchResponse,
  CorrectionPlan,
  CorrectionsResponse,
  InvalidRequestResponse,
  VocabItem,
} from "../shared/api";
import { type Api, clearTables, unlockedApi } from "./client";

const PANI = "\u{067E}\u{0627}\u{0646}\u{06CC}"; // پانی
const KARTA = "\u{06A9}\u{0631}\u{062A}\u{0627}"; // کرتا

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

async function batch(options: object): Promise<CheckBatchResponse> {
  return json(await api("POST", "/api/handoffs/check-batch", options));
}

async function issue(options: object): Promise<string> {
  const { handoff_id } = await batch(options);
  if (!handoff_id) throw new Error("no batch issued");
  return handoff_id;
}

const preview = (body: unknown) => api("POST", "/api/handoffs/corrections?preview=1", body);
const apply = (body: unknown) => api("POST", "/api/handoffs/corrections", body);

async function planOf(body: object): Promise<Exclude<CorrectionPlan, { outcome: "rejected" }>> {
  const res = await json<CorrectionsResponse>(await preview(body));
  if (!res.preview) throw new Error("expected a preview");
  const [plan] = res.results;
  if (!plan || plan.outcome === "rejected") throw new Error("expected a plan");
  return plan;
}

// The verb form imported under another topic before `conjugation` existed.
const misfiled = () =>
  create({ urdu: KARTA, english: "does", topic: "actions", cefr: "A1", tags: ["work"] });

describe("check-batch with Topic & level", () => {
  it("correctness lists classified items; completeness lists those lacking a topic or level", async () => {
    const classified = await misfiled();
    const bare = await create({ urdu: PANI, english: "water" });
    const ids = async (options: object) => (await batch(options)).items.map((i) => i.id);
    expect(await ids({ fields: ["topic"] })).toEqual([classified.id]);
    expect(await ids({ mode: "completeness", fields: ["topic"] })).toEqual([bare.id]);
  });

  it("an item checked for its text is still unchecked for its topic, until a topic check (bit 32)", async () => {
    const item = await misfiled();
    const run = async (fields: string[]) => {
      const handoff_id = await issue({ fields });
      await json(await apply({ handoff_id, corrections: [], accept: [] }));
    };
    await run(["english"]);
    const owed = await batch({ fields: ["topic"], only_unchecked: true });
    expect(owed.items.map((i) => i.id)).toEqual([item.id]);
    await run(["topic"]);
    expect((await getItem(item.id)).checked_fields).toBe(2 | 32);
    const none = await batch({ fields: ["topic"], only_unchecked: true });
    expect(none).toMatchObject({ handoff_id: null, candidates: 1, unchecked: 0 });
  });

  it("an unclassified item gets no topic bit from a both check it was not filled in", async () => {
    const item = await create({ urdu: PANI, english: "water" });
    const handoff_id = await issue({ mode: "both", fields: ["english", "topic"] });
    await json(await apply({ handoff_id, corrections: [], accept: [] }));
    expect((await getItem(item.id)).checked_fields).toBe(2);
  });

  it("refuses an unknown field and gives a suss batch the topic field", async () => {
    const bad = await api("POST", "/api/handoffs/check-batch", { fields: ["cefr"] });
    expect((await json<InvalidRequestResponse>(bad, 400)).field).toBe("fields[0]");
    const item = await misfiled();
    await json(await api("PUT", `/api/vocab/${item.id}/suss`, { note: "not an action" }));
    const handoff_id = await issue({ suss: true });
    const row = await env.DB.prepare("SELECT payload FROM handoffs WHERE id = ?")
      .bind(handoff_id)
      .first<{ payload: string }>();
    expect(JSON.parse(row?.payload ?? "{}").fields).toContain("topic");
  });
});

describe("corrections with Topic & level", () => {
  it("previews topic and level changes, and notes an unknown tag it left out", async () => {
    const item = await misfiled();
    const handoff_id = await issue({ fields: ["topic"] });
    const plan = await planOf({
      handoff_id,
      corrections: [
        {
          vocab_id: item.id,
          urdu: KARTA,
          topic: "conjugation",
          cefr: "A2",
          tags: ["work", "verbs"],
          english: "he does",
          reason: "a verb form",
        },
      ],
    });
    expect(plan.changes).toEqual([
      { field: "topic", old: "actions", new: "conjugation" },
      { field: "cefr", old: "A1", new: "A2" },
    ]);
    expect(plan.ignored).toEqual(["english"]);
    expect(plan.dropped).toEqual(["tag verbs"]);
  });

  it("drops an unknown topic or level and changes nothing for it", async () => {
    const item = await misfiled();
    const handoff_id = await issue({ fields: ["topic"] });
    const plan = await planOf({
      handoff_id,
      corrections: [{ vocab_id: item.id, urdu: KARTA, topic: "verbs", cefr: "A7", reason: "r" }],
    });
    expect(plan).toMatchObject({ outcome: "nothing", changes: [], ignored: [] });
    expect(plan.dropped).toEqual(["topic verbs", "level A7"]);
  });

  it("completeness fills a missing topic and level, and ignores tags and fixes", async () => {
    const bare = await create({ urdu: PANI, english: "water", cefr: "A1" });
    const handoff_id = await issue({ mode: "completeness", fields: ["topic"] });
    const plan = await planOf({
      handoff_id,
      corrections: [
        { vocab_id: bare.id, urdu: PANI, topic: "food", cefr: "A2", tags: ["nature"], reason: "r" },
      ],
    });
    expect(plan.changes).toEqual([{ field: "topic", old: null, new: "food" }]);
    expect(plan.ignored).toEqual(["cefr", "tags"]);
  });

  it("applies ticked topic, level and tags without touching the schedule", async () => {
    const item = await misfiled();
    const handoff_id = await issue({ fields: ["topic"] });
    const corrections = [
      {
        vocab_id: item.id,
        urdu: KARTA,
        topic: "conjugation",
        cefr: "A2",
        tags: ["actions"],
        reason: "a verb form",
      },
    ];
    const res = await json<CorrectionsResponse>(
      await apply({
        handoff_id,
        corrections,
        accept: [
          {
            vocab_id: item.id,
            fields: { topic: "actions", cefr: "A1", tags: ["work"] },
            reset: false,
          },
        ],
      }),
    );
    expect(res.results[0]).toMatchObject({ outcome: "checked", kept: [], declined: [] });
    const after = await getItem(item.id);
    expect(after).toMatchObject({ topic: "conjugation", cefr: "A2", tags: ["actions"] });
    expect(after.checked_fields & 32).toBe(32);
    expect(after.updated_at).not.toBe(item.updated_at);
    for (const key of ["ladder_id", "ladder_step", "interval_seconds", "due_at"] as const) {
      expect(after[key]).toBe(item[key]);
    }
    const tags = await env.DB.prepare("SELECT name FROM tags WHERE name = 'actions'").first();
    expect(tags).not.toBeNull();
  });

  it("a new topic leaves the tags, even when only the topic is ticked", async () => {
    const item = await misfiled();
    const handoff_id = await issue({ fields: ["topic"] });
    await json(
      await apply({
        handoff_id,
        corrections: [{ vocab_id: item.id, urdu: KARTA, topic: "work", reason: "r" }],
        accept: [{ vocab_id: item.id, fields: { topic: "actions" }, reset: false }],
      }),
    );
    expect(await getItem(item.id)).toMatchObject({ topic: "work", tags: [] });
  });

  it("a proposed tag naming the item's own topic is dropped from the change", async () => {
    const item = await misfiled();
    const handoff_id = await issue({ fields: ["topic"] });
    const plan = await planOf({
      handoff_id,
      corrections: [{ vocab_id: item.id, urdu: KARTA, tags: ["actions", "motion"], reason: "r" }],
    });
    expect(plan.changes).toEqual([{ field: "tags", old: ["work"], new: ["motion"] }]);
  });

  it("keeps a topic edited between the preview and the apply", async () => {
    const item = await misfiled();
    const handoff_id = await issue({ fields: ["topic"] });
    await json(await api("PATCH", `/api/vocab/${item.id}`, { topic: "motion" }));
    const res = await json<CorrectionsResponse>(
      await apply({
        handoff_id,
        corrections: [{ vocab_id: item.id, urdu: KARTA, topic: "conjugation", reason: "r" }],
        accept: [{ vocab_id: item.id, fields: { topic: "actions" }, reset: false }],
      }),
    );
    expect(res.results[0]).toMatchObject({ outcome: "checked", written: [], kept: ["topic"] });
    expect((await getItem(item.id)).topic).toBe("motion");
  });

  it("reads a null tags as none, and wants the old tags shown as a list", async () => {
    const item = await misfiled();
    const handoff_id = await issue({ fields: ["topic"] });
    const fixed = [{ vocab_id: item.id, urdu: KARTA, tags: null, reason: "r" }];
    const plan = await planOf({ handoff_id, corrections: fixed });
    expect(plan.changes).toEqual([{ field: "tags", old: ["work"], new: [] }]);
    const bad = await apply({
      handoff_id,
      corrections: fixed,
      accept: [{ vocab_id: item.id, fields: { tags: "work" }, reset: false }],
    });
    expect((await json<InvalidRequestResponse>(bad, 400)).field).toBe("accept[0].fields.tags");
  });
});
