// f03 s02: the reader's text handling, kept pure so it can be tested in the node project.

// FR-C1: pasted newlines become paragraphs. Runs of blank lines collapse to one break, and
// leading/trailing whitespace on each line goes, so text pasted out of a chat app does not
// arrive with a ragged right (in RTL terms, a ragged left) edge of stray spaces.
export function toParagraphs(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

const URDU_TEXT_KEY = "urdu.reader.text";

// FR-C8: the current text survives a reload. localStorage throws in private windows and with
// site data blocked, so every access is guarded — the reader works without persistence.
export function readStoredText(): string {
  try {
    return localStorage.getItem(URDU_TEXT_KEY) ?? "";
  } catch {
    return "";
  }
}

export function storeText(text: string): void {
  try {
    if (text) localStorage.setItem(URDU_TEXT_KEY, text);
    else localStorage.removeItem(URDU_TEXT_KEY);
  } catch {
    // Non-fatal: the text simply does not survive a reload on this device.
  }
}
