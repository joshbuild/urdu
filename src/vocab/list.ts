// f04 s02: the vocab list's decidable logic (FR-D1), kept pure for the node test project.

import type { VocabItem, VocabSort } from "../../shared/api";

export const PAGE_SIZE = 50;

export interface ListFilters {
  q: string;
  tag: string;
  due: boolean;
  sort: VocabSort;
}

export const DEFAULT_FILTERS: ListFilters = { q: "", tag: "", due: false, sort: "added" };

export const SORT_LABELS: Record<VocabSort, string> = {
  added: "Recently added",
  next_review: "Next review",
  mastery: "Mastery",
};

// Query string for GET /api/vocab. Defaults are left out so the URL says only what was chosen.
export function listQuery(filters: ListFilters, offset = 0, limit = PAGE_SIZE): string {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  if (q) params.set("q", q);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.due) params.set("due", "true");
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set("sort", filters.sort);
  if (offset > 0) params.set("offset", String(offset));
  if (limit !== PAGE_SIZE) params.set("limit", String(limit));
  const query = params.toString();
  return query ? `/api/vocab?${query}` : "/api/vocab";
}

// Never-reviewed and overdue items are both simply "due" to the reader of the list (FR-A3).
export function isDue(item: Pick<VocabItem, "next_review_on">, today: string): boolean {
  return item.next_review_on === null || item.next_review_on <= today;
}

export function reviewLabel(item: Pick<VocabItem, "next_review_on">, today: string): string {
  if (isDue(item, today)) return "Due now";
  return `Next ${item.next_review_on}`;
}

// The chosen sort survives reloads on this device (sponsor request 2026-09-18). Search, tag and
// due-only stay per visit: they narrow the list, and a stale narrowing would hide items.
const SORT_KEY = "urdu.vocabSort";

export function parseSort(raw: string | null | undefined): VocabSort {
  return raw != null && Object.hasOwn(SORT_LABELS, raw) ? (raw as VocabSort) : DEFAULT_FILTERS.sort;
}

export function readStoredSort(): VocabSort {
  try {
    return parseSort(localStorage.getItem(SORT_KEY));
  } catch {
    return DEFAULT_FILTERS.sort;
  }
}

export function storeSort(sort: VocabSort): void {
  try {
    localStorage.setItem(SORT_KEY, sort);
  } catch {
    // Non-fatal: the sort simply does not persist on this device.
  }
}
