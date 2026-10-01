import { describe, expect, it } from "vitest";
import { intakeOffer, startCounts } from "./intake";

describe("intakeOffer (f17)", () => {
  it("offers a batch, or what is left when the queue is shorter", () => {
    expect(intakeOffer({ queued: 40, new: 0, batch_size: 10 })).toEqual({
      count: 10,
      label: "Intake +10",
    });
    expect(intakeOffer({ queued: 3, new: 8, batch_size: 10 })).toEqual({
      count: 3,
      label: "Intake +3",
    });
  });

  it("is hidden with an empty queue", () => {
    expect(intakeOffer({ queued: 0, new: 4, batch_size: 10 })).toBeNull();
  });
});

describe("startCounts (f17)", () => {
  it("names the new words inside the due count", () => {
    // Joined with no-break spaces, so "10 new" never splits.
    const nb = (text: string) =>
      text.replaceAll(" ", "\u{00A0}").replace("\u{00A0}·\u{00A0}", " · ");
    expect(startCounts(12, 5)).toBe(nb("12 due · 5 new"));
    expect(startCounts(1, 0)).toBe(nb("1 due · 0 new"));
    expect(startCounts(1234, 10)).toBe(nb("1,234 due · 10 new"));
  });
});
