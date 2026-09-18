// f04 s02: the vault list (FR-D1) — search, tag filter, due-only, sort, "load more" paging.

import { useEffect, useState } from "react";
import type { TagsResponse, VocabItem, VocabListResponse, VocabSort } from "../../shared/api";
import { type ListFilters, listQuery, reviewLabel, SORT_LABELS } from "./list";
import { MasteryPill } from "./MasteryPill";

const SEARCH_DELAY_MS = 250;

export function VocabList({
  filters,
  onFilters,
  now,
  onOpen,
}: {
  filters: ListFilters;
  onFilters: (next: ListFilters) => void;
  now: string;
  onOpen: (id: string) => void;
}) {
  const [search, setSearch] = useState(filters.q);
  const [tags, setTags] = useState<string[]>([]);
  const [items, setItems] = useState<VocabItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Typing waits for a pause before it searches, so each keystroke is not a request.
  useEffect(() => {
    if (search === filters.q) return;
    const timer = setTimeout(() => onFilters({ ...filters, q: search }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search, filters, onFilters]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/tags", { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<TagsResponse>) : { tags: [] }))
      .then((body) => setTags(body.tags.map((t) => t.name)))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // A new filter replaces the list; the abort drops responses to filters no longer showing.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(listQuery(filters), { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("list failed");
        const body = (await response.json()) as VocabListResponse;
        setItems(body.items);
        setTotal(body.total);
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setError("Could not load your vocabulary. Check your connection and try again.");
        setLoading(false);
      });
    return () => controller.abort();
  }, [filters]);

  async function loadMore() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(listQuery(filters, items.length), { cache: "no-store" });
      if (!response.ok) throw new Error("list failed");
      const body = (await response.json()) as VocabListResponse;
      setItems((current) => [...current, ...body.items]);
      setTotal(body.total);
    } catch {
      setError("Could not load more. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <label htmlFor="vocab-search">Search</label>
      <input
        id="vocab-search"
        type="search"
        placeholder="Urdu, Roman or English"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        autoCapitalize="none"
        spellCheck={false}
      />

      <div className="vocab-filters">
        <div>
          <label htmlFor="vocab-tag">Tag</label>
          <select
            id="vocab-tag"
            value={filters.tag}
            onChange={(event) => onFilters({ ...filters, tag: event.target.value })}
          >
            <option value="">All tags</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="vocab-sort">Sort</label>
          <select
            id="vocab-sort"
            value={filters.sort}
            onChange={(event) => onFilters({ ...filters, sort: event.target.value as VocabSort })}
          >
            {(Object.keys(SORT_LABELS) as VocabSort[]).map((sort) => (
              <option key={sort} value={sort}>
                {SORT_LABELS[sort]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="check">
        <input
          type="checkbox"
          checked={filters.due}
          onChange={(event) => onFilters({ ...filters, due: event.target.checked })}
        />
        Due only
      </label>

      <p className="hint" role="status">
        {loading && items.length === 0
          ? "Loading…"
          : `${total.toLocaleString()} ${total === 1 ? "item" : "items"}`}
      </p>

      <ul className="vocab-list">
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" className="vocab-row" onClick={() => onOpen(item.id)}>
              <span className="vocab-row-head">
                <span className="vocab-row-roman">{item.roman}</span>
                <span className="urdu-inline" dir="rtl" lang="ur">
                  {item.urdu}
                </span>
              </span>
              <span className="vocab-row-gloss">{item.english || "—"}</span>
              <span className="vocab-row-meta">
                <MasteryPill item={item} /> {reviewLabel(item, now)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {items.length < total && (
        <button type="button" className="secondary" onClick={loadMore} disabled={loading}>
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </>
  );
}
