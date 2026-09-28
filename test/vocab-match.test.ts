import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { InvalidRequestResponse, MatchResponse, VocabItem } from "../shared/api";
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

async function create(urdu: string): Promise<VocabItem> {
  return json(await api("POST", "/api/vocab", { urdu }), 201);
}

const match = (body: unknown) => api("POST", "/api/vocab/match", body);

// Distinct two-letter Urdu words, none of them in the vault.
function fillerWords(n: number): string[] {
  const letters = [
    ..."\u{0627}\u{0628}\u{067E}\u{062A}\u{0679}\u{062B}\u{062C}\u{0686}\u{062D}\u{062E}\u{062F}\u{0688}\u{0630}\u{0631}\u{0691}",
  ];
  const words: string[] = [];
  for (const a of letters) for (const b of letters) words.push(a + b);
  return words.slice(0, n);
}

describe("POST /api/vocab/match", () => {
  it("returns the stored item for a known word, by urdu_key, and null for a new one", async () => {
    const kitab = await create(KITAB);
    const body = await json<MatchResponse>(await match({ words: [KITAB_WITH_KASRA, PANI] }));
    expect(body.results).toEqual([
      { urdu: KITAB_WITH_KASRA, existing: { id: kitab.id, urdu: KITAB } },
      { urdu: PANI, existing: null },
    ]);
  });

  it("keeps request order, trims entries and answers a repeated entry each time", async () => {
    const ghar = await create(GHAR);
    const body = await json<MatchResponse>(await match({ words: [PANI, ` ${GHAR} `, PANI, GHAR] }));
    const known = { id: ghar.id, urdu: GHAR };
    expect(body.results).toEqual([
      { urdu: PANI, existing: null },
      { urdu: GHAR, existing: known },
      { urdu: PANI, existing: null },
      { urdu: GHAR, existing: known },
    ]);
  });

  it("matches words beyond the first chunk of keys", async () => {
    const kitab = await create(KITAB);
    const pani = await create(PANI);
    const words = [PANI, ...fillerWords(150), KITAB];
    const body = await json<MatchResponse>(await match({ words }));
    expect(body.results).toHaveLength(152);
    expect(body.results[0]?.existing?.id).toBe(pani.id);
    expect(body.results[151]?.existing?.id).toBe(kitab.id);
    expect(body.results.filter((r) => r.existing !== null)).toHaveLength(2);
  });

  it("writes nothing", async () => {
    await create(KITAB);
    const before = await env.DB.prepare("SELECT * FROM vocab").all();
    await json<MatchResponse>(await match({ words: [KITAB, PANI] }));
    const after = await env.DB.prepare("SELECT * FROM vocab").all();
    expect(after.results).toEqual(before.results);
    const handoffs = await env.DB.prepare("SELECT count(*) AS n FROM handoffs").first<{
      n: number;
    }>();
    expect(handoffs?.n).toBe(0);
  });

  it("needs a session", async () => {
    const res = await exports.default.fetch("http://urdu.test/api/vocab/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words: [KITAB] }),
    });
    expect(res.status).toBe(401);
  });

  it.each([
    ["a non-object body", [KITAB], undefined],
    ["an unknown key", { words: [KITAB], extra: 1 }, "extra"],
    ["missing words", {}, "words"],
    ["empty words", { words: [] }, "words"],
    ["501 words", { words: fillerWords(225).concat(fillerWords(225), fillerWords(51)) }, "words"],
    ["a non-string entry", { words: [KITAB, 7] }, "words[1]"],
    ["a blank entry", { words: ["  "] }, "words[0]"],
    ["an entry over 500 characters", { words: [KITAB, "\u{0628}".repeat(501)] }, "words[1]"],
    ["an entry of punctuation only", { words: [KITAB, "\u{06D4}\u{061F}"] }, "words[1]"],
  ])("rejects %s", async (_name, body, field) => {
    const res = await json<InvalidRequestResponse>(await match(body), 400);
    expect(res.field).toBe(field);
  });
});
