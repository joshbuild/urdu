import { describe, expect, it } from "vitest";
import {
  CEFR_LEVELS,
  cefrLevel,
  isTopic,
  QUOTA_LEVELS,
  quotaTotals,
  TOPIC_SECTIONS,
  TOPICS,
  topicSlug,
} from "./topics";

describe("topics", () => {
  it("are 50, with unique kebab-case slugs", () => {
    expect(TOPICS).toHaveLength(50);
    const slugs = TOPICS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(50);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it("each have a label, a known section and a scope line", () => {
    const sections = new Set(TOPIC_SECTIONS.map((s) => s.id));
    for (const t of TOPICS) {
      expect(t.label.trim()).not.toBe("");
      expect(t.scope.trim()).not.toBe("");
      expect(sections.has(t.section)).toBe(true);
    }
  });

  it("leave no section empty, and list each section's topics together", () => {
    for (const s of TOPIC_SECTIONS) {
      expect(TOPICS.some((t) => t.section === s.id)).toBe(true);
    }
    const order = TOPICS.map((t) => t.section);
    const runs = order.filter((s, i) => i === 0 || order[i - 1] !== s);
    expect(runs).toEqual(TOPIC_SECTIONS.map((s) => s.id));
  });

  it("have the approved quotas: A1 685, A2 955, B1 935 (2,575 in all)", () => {
    expect(quotaTotals()).toEqual({ A1: 685, A2: 955, B1: 935 });
    for (const t of TOPICS) {
      for (const level of QUOTA_LEVELS) {
        expect(Number.isInteger(t.quota[level]) && t.quota[level] >= 0).toBe(true);
      }
    }
  });
});

describe("topicSlug", () => {
  it("trims and folds case to a known slug", () => {
    expect(topicSlug(" Food ")).toBe("food");
    expect(topicSlug("COMPOUND-VERBS")).toBe("compound-verbs");
    expect(isTopic("food")).toBe(true);
  });

  it("refuses anything not on the list", () => {
    for (const bad of ["objects", "", "food ", 3, null, undefined]) {
      expect(isTopic(bad)).toBe(false);
    }
    for (const bad of ["objects", "", "verbs", 3, null]) expect(topicSlug(bad)).toBeNull();
  });
});

describe("cefrLevel", () => {
  it("accepts A1 to C2 in any case", () => {
    expect(CEFR_LEVELS).toEqual(["A1", "A2", "B1", "B2", "C1", "C2"]);
    expect(cefrLevel(" a2 ")).toBe("A2");
    expect(cefrLevel("C2")).toBe("C2");
  });

  it("refuses anything else", () => {
    for (const bad of ["A2+", "A0", "B3", "", 1, null]) expect(cefrLevel(bad)).toBeNull();
  });
});
