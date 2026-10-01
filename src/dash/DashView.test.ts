import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DashView, TroubleCard } from "./DashView";
import { emptyDash, fullDash, sparseDash } from "./fixtures";

const render = (dash = emptyDash()) =>
  renderToStaticMarkup(createElement(DashView, { dash, onOpenVocab: () => {} }));

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("DashView", () => {
  it("renders an empty vault with every element's empty state", () => {
    const html = render(emptyDash());
    const titles = [
      "KNOWN",
      "DUE FORECAST",
      "RECALL, LAST 30 DAYS",
      "TROUBLE ITEMS",
      "LEARNING BACKLOG",
      "REVIEW CALENDAR",
    ].map((t) => html.indexOf(`>${t}<`));
    expect(titles.every((at) => at >= 0)).toBe(true);
    expect([...titles].sort((p, q) => p - q)).toEqual(titles);
    expect(html).toContain("<strong>0</strong> items on an interval of 14 days or more");
    expect(html).toContain("History builds as you review.");
    expect(count(html, "not enough reviews yet (n=0)")).toBe(2);
    expect(html).toContain("No trouble items in the last 30 days.");
    expect(count(html, 'class="dash-heat dash-heat--0"')).toBe(84);
    expect(html).not.toContain("NaN");
  });

  it("draws the band history from two days, still below the recall minimum", () => {
    const dash = sparseDash();
    expect(dash.known.history).toHaveLength(2);
    const html = render(dash);
    expect(count(html, 'class="dash-band dash-band--')).toBe(7);
    expect(html).not.toContain("History builds as you review.");
    expect(html).toContain("not enough reviews yet");
    expect(html).not.toContain('class="dash-hint"');
    expect(html).not.toContain("NaN");
  });

  it("renders every block from a full vault", () => {
    const dash = fullDash();
    const html = render(dash);
    expect(dash.recall.band).not.toBe("insufficient");
    expect(html).toMatch(/<strong>\d+%<\/strong> \(n=\d+\)/);
    expect(html).toContain('class="dash-hint"');
    expect(dash.trouble.length).toBeGreaterThan(0);
    expect(count(html, 'class="vocab-row"')).toBe(dash.trouble.length);
    expect(html).toContain("misses");
    expect(count(html, 'class="dash-bar dash-bar--added"')).toBeGreaterThan(0);
    expect(html).not.toContain("NaN");
  });
});

describe("RecallCard hint", () => {
  it.each([
    ["high", 11, "Recall is high, on the widest ladder"],
    ["high", 8, "Recall is high: a wider ladder would mean fewer reviews"],
    ["low", 7, "Recall is low: add fewer new words for a while"],
  ] as const)("words %s on ladder %i from the response", (band, ladderId, text) => {
    const full = fullDash(ladderId);
    const html = render({ ...full, recall: { ...full.recall, band } });
    expect(html).toContain(`<p class="dash-hint">${text}</p>`);
  });
});

describe("TroubleCard", () => {
  // Walks an element tree of plain elements (TroubleCard uses no hooks or child components).
  function buttons(node: ReactNode): { onClick: () => void }[] {
    if (Array.isArray(node)) return node.flatMap(buttons);
    if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) return [];
    const own =
      node.type === "button" && node.props.onClick ? [{ onClick: node.props.onClick }] : [];
    return [...own, ...buttons(node.props.children)];
  }

  it("opens a tapped item on the Vocab tab", () => {
    const dash = fullDash();
    const onOpenVocab = vi.fn();
    const rows = buttons(TroubleCard({ dash, onOpenVocab }));
    expect(rows).toHaveLength(dash.trouble.length);
    rows[1]?.onClick();
    expect(onOpenVocab).toHaveBeenCalledExactlyOnceWith(dash.trouble[1]?.id);
  });
});
