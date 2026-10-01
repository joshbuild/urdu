import { describe, expect, it } from "vitest";
import type { ProposalResult } from "../../shared/api";
import { pastePath, pasteSummary } from "./NewVocabSheets";

describe("pastePath (f17)", () => {
  it("queues by default and starts with Start now", () => {
    expect(pastePath("01H", false)).toBe("/api/harvests/01H/handoffs");
    expect(pastePath("01H", true)).toBe("/api/harvests/01H/handoffs?start=1");
  });
});

describe("pasteSummary (f17)", () => {
  const results: ProposalResult[] = [
    { index: 0, urdu: "a", outcome: "created", id: "1" },
    { index: 1, urdu: "b", outcome: "created", id: "2" },
    { index: 2, urdu: "c", outcome: "duplicate", existing_id: "3" },
    { index: 3, urdu: "d", outcome: "rejected", reason: "x" },
  ];

  it("counts what was queued or started, and duplicates", () => {
    expect(pasteSummary(results, false)).toBe("2 queued · 1 already in your vault");
    expect(pasteSummary(results, true)).toBe("2 started · 1 already in your vault");
    expect(pasteSummary(results.slice(0, 1), false)).toBe("1 queued");
  });
});
