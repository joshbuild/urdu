// f03 s05: the selection action bar's text handling (FR-C5). The bar itself is docked above the
// tab bar in CSS: the floating placement collided with Android Chrome's own selection toolbar on
// the sponsor's phone (2026-09-17), so there is no positioning logic left to test.

// The selected text worth acting on: whitespace runs (including a paragraph break) collapse to
// one space, and a whitespace-only selection yields nothing.
export function selectedTerm(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}
