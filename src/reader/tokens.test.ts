import { describe, expect, it } from "vitest";
import { inferKind, tokenize } from "./tokens";

const words = (text: string) =>
  tokenize(text)
    .filter((piece) => piece.word)
    .map((piece) => piece.text);
const rebuild = (text: string) =>
  tokenize(text)
    .map((piece) => piece.text)
    .join("");

describe("tokenize", () => {
  it("splits on spaces", () => {
    expect(words("یہ ایک جملہ ہے")).toEqual(["یہ", "ایک", "جملہ", "ہے"]);
  });

  it("splits Urdu punctuation off the word", () => {
    expect(words("آپ کیسے ہیں؟ ٹھیک ہوں۔")).toEqual(["آپ", "کیسے", "ہیں", "ٹھیک", "ہوں"]);
    expect(words("ایک، دو؛ تین")).toEqual(["ایک", "دو", "تین"]);
  });

  it("keeps a ZWNJ-joined compound as one token", () => {
    const compound = "کتاب\u{200C}خانہ";
    expect(words(compound)).toEqual([compound]);
  });

  it("keeps tashkeel attached to its letter", () => {
    const marked = "کِتاب";
    expect(words(marked)).toEqual([marked]);
  });

  it("handles mixed Latin and digits", () => {
    expect(words("ایک word 42 ہے")).toEqual(["ایک", "word", "42", "ہے"]);
  });

  it("treats a run of punctuation as one separator, not a word", () => {
    expect(tokenize("...")).toEqual([{ text: "...", word: false }]);
    expect(words("!!!")).toEqual([]);
  });

  it("loses nothing — the pieces rebuild the input exactly", () => {
    for (const text of ["یہ ایک جملہ ہے", "آپ کیسے ہیں؟  ٹھیک", "  leading and trailing  ", "a"]) {
      expect(rebuild(text)).toBe(text);
    }
  });

  it("returns nothing for an empty string", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("inferKind", () => {
  it("calls a single token a word", () => {
    expect(inferKind("کتاب")).toBe("word");
  });

  it("calls anything containing whitespace a phrase", () => {
    expect(inferKind("کتاب خانہ")).toBe("phrase");
  });

  it("ignores surrounding whitespace", () => {
    expect(inferKind("  کتاب  ")).toBe("word");
  });
});
