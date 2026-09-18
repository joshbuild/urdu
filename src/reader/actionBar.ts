// f03 s05: where the selection action bar goes (FR-C5), kept pure so it can be tested in the node
// project. Inputs are plain rectangles in viewport coordinates; the caller reads them from the DOM.

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
  // Space at the bottom the bar must never cover — the fixed tab bar.
  bottomInset: number;
}

export interface Placement {
  top: number;
  left: number;
  side: "above" | "below";
}

// Clear of the selection handles: Android draws them below the selection, and its own
// copy/share toolbar usually sits just above it, so the gap is generous rather than tight.
export const BAR_GAP = 12;
const EDGE = 8;

// FR-C5 says above the selection. Above wins whenever it fits; otherwise below, and if neither
// fits (a selection taller than the screen) the bar pins to the top edge. Horizontally it
// centres on the selection and clamps to the screen.
export function placeActionBar(
  selection: Rect,
  bar: { width: number; height: number },
  viewport: Viewport,
): Placement {
  const floor = viewport.height - viewport.bottomInset;
  const aboveTop = selection.top - BAR_GAP - bar.height;
  const belowTop = selection.top + selection.height + BAR_GAP;

  let top: number;
  let side: Placement["side"];
  if (aboveTop >= EDGE) {
    top = aboveTop;
    side = "above";
  } else if (belowTop + bar.height <= floor - EDGE) {
    top = belowTop;
    side = "below";
  } else {
    top = EDGE;
    side = "above";
  }

  const centred = selection.left + selection.width / 2 - bar.width / 2;
  const maxLeft = Math.max(EDGE, viewport.width - bar.width - EDGE);
  const left = Math.min(Math.max(centred, EDGE), maxLeft);

  return { top, left, side };
}

// The selected text worth acting on: whitespace runs (including a paragraph break) collapse to
// one space, and a whitespace-only selection yields nothing.
export function selectedTerm(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}
