import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, isDue, listQuery, reviewLabel } from "./list";

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
  const today = "2026-09-18";

  it("treats never-reviewed items as due", () => {
    expect(isDue({ next_review_on: null }, today)).toBe(true);
    expect(reviewLabel({ next_review_on: null }, today)).toBe("Due now");
  });

  it("treats today and past dates as due", () => {
    expect(isDue({ next_review_on: today }, today)).toBe(true);
    expect(isDue({ next_review_on: "2026-09-01" }, today)).toBe(true);
  });

  it("shows the date for future reviews", () => {
    expect(isDue({ next_review_on: "2026-09-19" }, today)).toBe(false);
    expect(reviewLabel({ next_review_on: "2026-09-19" }, today)).toBe("Next 2026-09-19");
  });
});
