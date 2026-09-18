import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, isDue, listQuery, parseSort, reviewLabel } from "./list";

describe("listQuery", () => {
  it("is the bare route for default filters", () => {
    expect(listQuery(DEFAULT_FILTERS)).toBe("/api/vocab");
  });

  it("sends only what was chosen, with the search trimmed", () => {
    const url = listQuery({ q: "  book ", tag: "nouns", due: true, sort: "mastery" }, 50);
    const params = new URL(url, "http://x").searchParams;
    expect(Object.fromEntries(params)).toEqual({
      q: "book",
      tag: "nouns",
      due: "true",
      sort: "mastery",
      offset: "50",
    });
  });

  it("encodes Urdu search text", () => {
    const url = listQuery({ ...DEFAULT_FILTERS, q: "کتاب" });
    expect(new URL(url, "http://x").searchParams.get("q")).toBe("کتاب");
  });

  it("drops a whitespace-only search", () => {
    expect(listQuery({ ...DEFAULT_FILTERS, q: "   " })).toBe("/api/vocab");
  });
});

describe("isDue / reviewLabel", () => {
  const now = "2026-09-18T20:00:00.000Z";

  it("treats never-reviewed items as due", () => {
    expect(isDue({ due_at: null }, now)).toBe(true);
    expect(reviewLabel({ due_at: null }, now)).toBe("Due now");
  });

  it("treats now and past instants as due", () => {
    expect(isDue({ due_at: now }, now)).toBe(true);
    expect(isDue({ due_at: "2026-09-01T08:00:00.000Z" }, now)).toBe(true);
    expect(reviewLabel({ due_at: "2026-09-01T08:00:00.000Z" }, now)).toBe("Due now");
  });

  it("shows how long until a future review", () => {
    expect(isDue({ due_at: "2026-09-19T03:00:00.000Z" }, now)).toBe(false);
    expect(reviewLabel({ due_at: "2026-09-19T03:00:00.000Z" }, now)).toBe("Due in 7 h");
    expect(reviewLabel({ due_at: "2026-10-12T20:00:00.000Z" }, now)).toBe("Due in 3 wk");
  });
});

describe("parseSort", () => {
  it("keeps a known sort and falls back to added otherwise", () => {
    expect(parseSort("mastery")).toBe("mastery");
    expect(parseSort("next_review")).toBe("next_review");
    expect(parseSort(null)).toBe("added");
    expect(parseSort("random")).toBe("added");
    expect(parseSort("toString")).toBe("added");
  });
});
