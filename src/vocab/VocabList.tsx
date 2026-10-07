// f04 s02: the vault list (FR-D1) — search, topic and level filters (f18), due-only, sort, "load
// more" paging.

import { useEffect, useState } from "react";
import type { VocabItem, VocabListResponse, VocabSort } from "../../shared/api";
import { CEFR_LEVELS } from "../../shared/topics";
import { TopicOptions } from "../reader/DraftFields";
import { isQueued, type ListFilters, listQuery, reviewLabel, SORT_LABELS, topicChip } from "./list";
import { MasteryPill, QueuedBadge } from "./MasteryPill";

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
        <div className="vocab-filters-wide">
          <label htmlFor="vocab-topic">Topic</label>
          <select
            id="vocab-topic"
            value={filters.topic}
            onChange={(event) => onFilters({ ...filters, topic: event.target.value })}
          >
            <TopicOptions none="All topics" />
          </select>
        </div>
        <div>
          <label htmlFor="vocab-cefr">Level</label>
          <select
            id="vocab-cefr"
            value={filters.cefr}
            onChange={(event) => onFilters({ ...filters, cefr: event.target.value })}
          >
            <option value="">All levels</option>
            {CEFR_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
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
          onChange={(event) => onFilters({ ...filters, due: event.target.checked, queued: false })}
        />
        Due only
      </label>
      {/* f17: the two narrow to disjoint sets, so ticking one clears the other. */}
      <label className="check">
        <input
          type="checkbox"
          checked={filters.queued}
          onChange={(event) => onFilters({ ...filters, queued: event.target.checked, due: false })}
        />
        Queued only
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
                {isQueued(item) ? <QueuedBadge /> : <MasteryPill item={item} />}{" "}
                {isQueued(item) ? "Waiting to start" : reviewLabel(item, now)}
                {topicChip(item) && <span className="chip chip--topic">{topicChip(item)}</span>}
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
