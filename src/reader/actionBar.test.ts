import { describe, expect, it } from "vitest";
import { selectedTerm } from "./actionBar";

describe("selectedTerm", () => {
  it("trims and collapses whitespace, including a paragraph break", () => {
    expect(selectedTerm("  ایک\n\nدو  ")).toBe("ایک دو");
  });

  it("is empty for whitespace-only selections", () => {
    expect(selectedTerm(" \n\t ")).toBe("");
  });
});
