import { describe, expect, it } from "vitest";
import { buildCreateRequest, initialDraft, parseTags, sourceSentence } from "./addVocab";

describe("sourceSentence", () => {
  const paragraph = "میں گھر جا رہا ہوں۔ آپ کہاں ہیں؟ کل ملیں گے";

  it("finds the sentence holding the term, terminator included", () => {
    expect(sourceSentence(paragraph, "کہاں")).toBe("آپ کہاں ہیں؟");
  });

  it("handles a last sentence with no terminator", () => {
    expect(sourceSentence(paragraph, "ملیں")).toBe("کل ملیں گے");
  });

  it("falls back to the paragraph when the term crosses a sentence break", () => {
    expect(sourceSentence(paragraph, "ہوں۔ آپ")).toBe(paragraph);
  });

  it("collapses whitespace in both the paragraph and the term", () => {
    expect(sourceSentence("میں  گھر\nجا رہا ہوں۔", "گھر  جا")).toBe("میں گھر جا رہا ہوں۔");
  });

  it("is empty when the term is not in the paragraph or is blank", () => {
    expect(sourceSentence(paragraph, "کتاب")).toBe("");
    expect(sourceSentence(paragraph, "  ")).toBe("");
  });
});

describe("parseTags", () => {
  it("splits on Latin and Urdu commas, trims and dedupes", () => {
    expect(parseTags(" food, travel،food ,, ")).toEqual(["food", "travel"]);
  });

  it("is empty for blank input", () => {
    expect(parseTags("")).toEqual([]);
  });
});

describe("initialDraft", () => {
  it("puts the source sentence in notes", () => {
    expect(initialDraft("کہاں", "آپ کہاں ہیں؟").notes).toBe("آپ کہاں ہیں؟");
  });

  it("leaves notes empty when the sentence is just the term", () => {
    expect(initialDraft("کہاں", "کہاں").notes).toBe("");
  });
});

describe("buildCreateRequest", () => {
  it("infers a word and marks the source as reading", () => {
    expect(buildCreateRequest(initialDraft(" کہاں ", ""))).toEqual({
      urdu: "کہاں",
      kind: "word",
      source: "reading",
    });
  });

  it("infers a phrase from the edited term, and sends only filled fields", () => {
    const draft = {
      ...initialDraft("کہاں", ""),
      urdu: "آپ کہاں",
      english: " where ",
      tags: "a, b",
    };
    expect(buildCreateRequest(draft)).toEqual({
      urdu: "آپ کہاں",
      kind: "phrase",
      source: "reading",
      english: "where",
      tags: ["a", "b"],
    });
  });
});
