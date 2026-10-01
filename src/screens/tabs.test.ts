import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TAB, isTab, readStoredTab, TAB_LABELS, TABS } from "./tabs";

describe("tabs (f17)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("puts Harvest where Read was, and opens on Review", () => {
    expect(TABS).toEqual(["harvest", "vocab", "review", "dash", "voice", "settings"]);
    expect(TAB_LABELS.harvest).toBe("Harvest");
    expect(DEFAULT_TAB).toBe("review");
  });

  it("reads a stored read tab as Review, now that Read is parked", () => {
    expect(isTab("read")).toBe(false);
    vi.stubGlobal("localStorage", { getItem: () => "read" });
    expect(readStoredTab()).toBe("review");
    vi.stubGlobal("localStorage", { getItem: () => "harvest" });
    expect(readStoredTab()).toBe("harvest");
  });
});
