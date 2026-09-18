import { describe, expect, it } from "vitest";
import { BAR_GAP, placeActionBar, selectedTerm } from "./actionBar";

const bar = { width: 240, height: 56 };
const viewport = { width: 400, height: 800, bottomInset: 100 };

describe("placeActionBar", () => {
  it("sits above the selection when there is room", () => {
    const p = placeActionBar({ top: 300, left: 100, width: 80, height: 40 }, bar, viewport);
    expect(p.side).toBe("above");
    expect(p.top).toBe(300 - BAR_GAP - 56);
  });

  it("flips below when the selection is near the top", () => {
    const p = placeActionBar({ top: 20, left: 100, width: 80, height: 40 }, bar, viewport);
    expect(p.side).toBe("below");
    expect(p.top).toBe(60 + BAR_GAP);
  });

  it("pins to the top edge when neither side fits", () => {
    const p = placeActionBar({ top: 10, left: 0, width: 400, height: 700 }, bar, viewport);
    expect(p.top).toBe(8);
  });

  it("never lets the below placement run under the tab bar", () => {
    const p = placeActionBar({ top: 40, left: 100, width: 80, height: 600 }, bar, viewport);
    expect(p.top).toBe(8);
  });

  it("centres horizontally on the selection", () => {
    const p = placeActionBar({ top: 300, left: 100, width: 100, height: 40 }, bar, viewport);
    expect(p.left).toBe(150 - 120);
  });

  it("clamps to both screen edges", () => {
    expect(placeActionBar({ top: 300, left: 0, width: 20, height: 40 }, bar, viewport).left).toBe(
      8,
    );
    expect(placeActionBar({ top: 300, left: 380, width: 20, height: 40 }, bar, viewport).left).toBe(
      400 - 240 - 8,
    );
  });

  it("stays on screen when the bar is wider than the viewport", () => {
    expect(
      placeActionBar(
        { top: 300, left: 0, width: 20, height: 40 },
        { width: 500, height: 56 },
        viewport,
      ).left,
    ).toBe(8);
  });
});

describe("selectedTerm", () => {
  it("trims and collapses whitespace, including a paragraph break", () => {
    expect(selectedTerm("  ایک\n\nدو  ")).toBe("ایک دو");
  });

  it("is empty for whitespace-only selections", () => {
    expect(selectedTerm(" \n\t ")).toBe("");
  });
});
