import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { DashResponse, VocabItem } from "../shared/api";
import { todayIn } from "../shared/dates";
import { addSeconds, ladder } from "../shared/ladders";
import { type Api, clearTables, unlockedApi } from "./client";

const KITAB = "\u{06A9}\u{062A}\u{0627}\u{0628}"; // کتاب
const PANI = "\u{067E}\u{0627}\u{0646}\u{06CC}"; // پانی
const DENSE = ladder(8);

let api: Api;

beforeEach(async () => {
  await clearTables();
  api = await unlockedApi();
});

async function create(urdu: string): Promise<VocabItem> {
  const res = await api("POST", "/api/vocab", { urdu, english: "a word" });
  expect(res.status).toBe(201);
  return res.json();
}

// Put an item on the Dense ladder at `step`, last reviewed a day ago.
async function setStep(id: string, step: number) {
  const interval = DENSE.intervals_seconds[step] as number;
  const last = new Date(Date.now() - 86_400_000).toISOString();
  await env.DB.prepare(
    `UPDATE vocab SET ladder_id = 8, ladder_step = ?, interval_seconds = ?, last_reviewed_at = ?,
       due_at = ? WHERE id = ?`,
  )
    .bind(step, interval, last, addSeconds(last, interval), id)
    .run();
}

async function review(id: string, grade: string) {
  const res = await api("POST", `/api/vocab/${id}/reviews`, { grade, direction: "ur_en" });
  expect(res.status).toBe(201);
}

async function getDash(): Promise<DashResponse> {
  const res = await api("GET", "/api/dash");
  expect(res.status).toBe(200);
  return res.json();
}

async function snapshot() {
  const [vocab, events] = await env.DB.batch([
    env.DB.prepare("SELECT * FROM vocab ORDER BY id"),
    env.DB.prepare("SELECT * FROM review_events ORDER BY id"),
  ]);
  return { vocab: vocab?.results, events: events?.results };
}

describe("GET /api/dash", () => {
  it("needs a session", async () => {
    const res = await exports.default.fetch("http://urdu.test/api/dash");
    expect(res.status).toBe(401);
  });

  it("serves every block for an empty vault", async () => {
    const dash = await getDash();
    const today = todayIn(env.HOME_TZ);
    expect(dash.today).toBe(today);
    expect(dash.active_ladder_id).toBe(8);
    expect(Math.abs(Date.parse(dash.generated_at) - Date.now())).toBeLessThan(5000);
    expect(dash.known).toEqual({
      count: 0,
      history: [{ day: today, bands: [0, 0, 0, 0, 0, 0, 0] }],
    });
    expect(dash.forecast).toMatchObject({ overdue: 0, new: 0 });
    expect(dash.forecast.days).toHaveLength(14);
    expect(dash.recall.band).toBe("insufficient");
    expect(dash.trouble).toEqual([]);
    expect(dash.backlog.now).toBe(0);
    expect(dash.backlog.weeks).toHaveLength(8);
    expect(dash.calendar).toHaveLength(84);
  });

  it("derives the blocks from a seeded vault and writes nothing", async () => {
    const known = await create(KITAB);
    const shaky = await create(PANI);
    const fresh = await create("\u{0622}\u{0645}"); // آم
    // Dense step 7 is 32 days: Known.
    await setStep(known.id, 7);
    await setStep(shaky.id, 4);
    await review(shaky.id, "wrong");
    await review(shaky.id, "partial");
    await env.DB.prepare("UPDATE settings SET value = '9' WHERE key = 'active_ladder_id'").run();

    const before = await snapshot();
    const dash = await getDash();
    expect(await snapshot()).toEqual(before);

    expect(dash.active_ladder_id).toBe(9);
    expect(dash.known.count).toBe(1);
    expect(dash.forecast.new).toBe(1);
    expect(dash.recall.recognition).toEqual({ n: 2, recalled: 0 });
    expect(dash.trouble).toEqual([
      { id: shaky.id, urdu: PANI, english: "a word", lapses: 2, band: expect.any(Number) },
    ]);
    expect(dash.backlog.now).toBe(2);
    expect(dash.backlog.weeks.at(-1)?.started).toBe(3);
    expect(dash.calendar.at(-1)).toEqual({ day: dash.today, count: 2, level: 1 });
    expect(fresh.id).toBeTruthy();
  });
});
