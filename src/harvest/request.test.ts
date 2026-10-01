import { describe, expect, it } from "vitest";
import { harvestRequest, hostOf } from "./request";

describe("harvestRequest", () => {
  it("names the URL and the filter for the vocab-list command", () => {
    expect(harvestRequest({ name: "Story", url: "https://x.test/a" }, "CEFR A2+")).toBe(
      "vocab-list https://x.test/a at CEFR A2+ or above",
    );
  });

  it("leaves the filter out when there is none", () => {
    expect(harvestRequest({ name: "Story", url: "https://x.test/a" }, null)).toBe(
      "vocab-list https://x.test/a",
    );
  });

  it("uses the name when there is no URL", () => {
    expect(harvestRequest({ name: "Chapter 3 of my reader", url: null }, "B1")).toBe(
      "vocab-list Chapter 3 of my reader at B1 or above",
    );
  });
});

describe("hostOf", () => {
  it("shows the host without www", () => {
    expect(hostOf("https://www.bbc.com/urdu/articles/1")).toBe("bbc.com");
    expect(hostOf("http://x.test:8080/a")).toBe("x.test");
  });

  it("is empty for no URL", () => {
    expect(hostOf(null)).toBe("");
  });
});
