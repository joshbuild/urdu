// f18 (FR-L): the classify sheet's pure parts, so the node project tests them.

import type { ClassifyResponse } from "../../shared/api";

type Results = ClassifyResponse["results"];

// Every row the preview can apply starts ticked.
export function initiallyTicked(results: Results): Set<number> {
  const ticked = new Set<number>();
  for (const r of results) if (r.outcome === "classify") ticked.add(r.n);
  return ticked;
}

const LABELS: Readonly<Record<Results[number]["outcome"], string>> = {
  classify: "ready",
  classified: "classified",
  stale: "kept (edited since)",
  declined: "unticked",
  rejected: "rejected",
  missing: "left out",
};

// "2 classified · 1 kept (edited since)": each outcome present, in a fixed order.
export function classifySummary(results: Results): string {
  const counts = new Map<string, number>();
  for (const r of results) counts.set(r.outcome, (counts.get(r.outcome) ?? 0) + 1);
  return (Object.keys(LABELS) as Results[number]["outcome"][])
    .filter((outcome) => counts.has(outcome))
    .map((outcome) => `${counts.get(outcome)} ${LABELS[outcome]}`)
    .join(" · ");
}
