// f17 (FR-K): the text Copy harvest request puts on the clipboard. It runs f14's `vocab-list`
// command on the source, so the ChatGPT Project instructions don't change.

import type { Source } from "../../shared/api";

export function harvestRequest(
  source: Pick<Source, "name" | "url">,
  filter: string | null,
): string {
  const level = filter ? ` at ${filter} or above` : "";
  return `vocab-list ${source.url ?? source.name}${level}`;
}

// The host a source row shows, without "www.".
export function hostOf(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
