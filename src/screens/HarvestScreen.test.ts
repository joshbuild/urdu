import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HARVEST, OVERVIEW, SOURCE } from "../harvest/fixtures";
import { TankMeter } from "../harvest/TankMeter";
import { HarvestView, Overview, SourceView } from "./HarvestScreen";

const noop = () => {};
describe("Harvest overview", () => {
  it("shows the tank, then each source with its chip, host and latest harvest", () => {
    const html = renderToStaticMarkup(
      createElement(Overview, { onLocked: noop, onOpenSource: noop, preloaded: OVERVIEW }),
    );
    expect(html).toContain("tank tank--low");
    expect(html).toContain("3 days of new words left: harvest soon");
    expect(html).toContain("24 queued · 10 a day");
    expect(html.indexOf("Toba Tek Singh")).toBeLessThan(html.indexOf("monsoon report"));
    expect(html).toContain(">To harvest<");
    expect(html.split(">Harvested<").length - 1).toBe(2);
    expect(html).toContain("rekhta.org");
    expect(html).toContain("CEFR A2+, ");
  });

  it("invites a first source when there are none", () => {
    const html = renderToStaticMarkup(
      createElement(Overview, {
        onLocked: noop,
        onOpenSource: noop,
        preloaded: { intake: { queued: 0, new: 0, batch_size: 10 }, sources: [] },
      }),
    );
    expect(html).toContain("Empty: time to harvest");
    expect(html).toContain("No sources yet.");
  });
});

describe("Source view", () => {
  it("lists harvests with counts, and Delete only on an empty one", () => {
    const html = renderToStaticMarkup(
      createElement(SourceView, {
        id: "s2",
        onLocked: noop,
        onBack: noop,
        onOpenHarvest: noop,
        onOpenSource: noop,
        preloaded: SOURCE,
      }),
    );
    expect(html).toContain("62 words · 40 queued · 12 started");
    expect(html).toContain("0 words · 0 queued · 0 started");
    expect(html.split(">Delete empty harvest<").length - 1).toBe(1);
    expect(html).toContain("New harvest");
  });
});

describe("Harvest view", () => {
  it("offers the round trip in order: request, find, prompt, paste", () => {
    const html = renderToStaticMarkup(
      createElement(HarvestView, {
        id: "h1",
        onLocked: noop,
        onChanged: noop,
        onOpenVocab: noop,
        onBack: noop,
        preloaded: HARVEST,
      }),
    );
    const order = [
      "Copy harvest request",
      "Find new words",
      "Copy new-vocab prompt",
      "Paste new vocab",
    ].map((label) => html.indexOf(`>${label}<`));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain("CEFR A2+");
  });
});

describe("TankMeter", () => {
  it.each([
    [0, "empty", 0],
    [20, "low", 29],
    [60, "ok", 86],
    [200, "full", 200],
  ] as const)("draws %i queued as %s with a %i-wide fill", (queued, level, width) => {
    const html = renderToStaticMarkup(
      createElement(TankMeter, { intake: { queued, new: 0, batch_size: 10 }, compact: true }),
    );
    expect(html).toContain(`tank tank--${level} tank--compact`);
    if (width === 0) expect(html).not.toContain("tank-fill");
    else expect(html).toContain(`width="${width}"`);
    expect(html).not.toContain("a day");
  });
});
