import { describe, expect, it } from "vitest";
import { toParagraphs } from "./text";

describe("toParagraphs", () => {
  it("splits on newlines", () => {
    expect(toParagraphs("ایک\nدو\nتین")).toEqual(["ایک", "دو", "تین"]);
  });

  it("collapses blank lines and trims each line", () => {
    expect(toParagraphs("  ایک  \n\n\n   دو\n \n")).toEqual(["ایک", "دو"]);
  });

  it("handles CRLF from a Windows paste", () => {
    expect(toParagraphs("ایک\r\nدو")).toEqual(["ایک", "دو"]);
  });

  it("returns a single paragraph for text with no newlines", () => {
    expect(toParagraphs("یہ ایک جملہ ہے")).toEqual(["یہ ایک جملہ ہے"]);
  });

  it("returns nothing for empty or whitespace-only text", () => {
    expect(toParagraphs("")).toEqual([]);
    expect(toParagraphs("   \n\t\n  ")).toEqual([]);
  });
});
