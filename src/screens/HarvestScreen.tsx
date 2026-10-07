// f17 (FR-K): the Harvest tab, in Read's place. The tank, the sources list (to harvest first, then
// by latest harvest), each source's harvests, and a harvest's new-vocab round trip, moved here from
// the Vocab tab. Fetched each time a view opens, so counts are fresh after a paste or a review.

import { useState } from "react";
import type {
  CoverageResponse,
  Harvest,
  HarvestDetail,
  HarvestOverview,
  HarvestSummary,
  Source,
  SourceConflictResponse,
  SourceDetail,
  SourceSummary,
} from "../../shared/api";
import { type Copied, CopiedNote, copy, InfoBox, InfoToggle, postJson } from "../handoff/clipboard";
import { FindWordsSheet, PasteNewSheet, pastePath } from "../handoff/NewVocabSheets";
import { newVocabPrompt } from "../handoff/prompts";
import { CoveragePanel } from "../harvest/CoveragePanel";
import { Unavailable, useFetched } from "../harvest/fetched";
import { harvestRequest, hostOf } from "../harvest/request";
import { TankMeter } from "../harvest/TankMeter";
import { Sheet } from "../reader/Sheet";

type Props = { onOpenVocab: (id: string) => void; onLocked: () => void; onChanged: () => void };

// A harvest keeps its source id, so Back works even while the harvest fails to load.
type View =
  | { kind: "overview" }
  | { kind: "source"; id: string }
  | { kind: "harvest"; id: string; sourceId: string };

const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export function HarvestScreen({ onOpenVocab, onLocked, onChanged }: Props) {
  const [view, setView] = useState<View>({ kind: "overview" });
  if (view.kind === "source") {
    return (
      // Keyed, so opening another source (the 409's Open it) never shows this one's data.
      <SourceView
        key={view.id}
        id={view.id}
        onLocked={onLocked}
        onBack={() => setView({ kind: "overview" })}
        onOpenHarvest={(id) => setView({ kind: "harvest", id, sourceId: view.id })}
        onOpenSource={(id) => setView({ kind: "source", id })}
      />
    );
  }
  if (view.kind === "harvest") {
    return (
      <HarvestView
        key={view.id}
        id={view.id}
        onLocked={onLocked}
        onChanged={onChanged}
        onOpenVocab={onOpenVocab}
        onBack={() => setView({ kind: "source", id: view.sourceId })}
      />
    );
  }
  return (
    <Overview
      onLocked={onLocked}
      onChanged={onChanged}
      onOpenVocab={onOpenVocab}
      onOpenSource={(id) => setView({ kind: "source", id })}
    />
  );
}

export function Overview({
  onLocked,
  onChanged = () => {},
  onOpenVocab = () => {},
  onOpenSource,
  preloaded,
  preloadedCoverage,
}: {
  onLocked: () => void;
  onChanged?: () => void;
  onOpenVocab?: (id: string) => void;
  onOpenSource: (id: string) => void;
  preloaded?: HarvestOverview;
  preloadedCoverage?: CoverageResponse;
}) {
  const { loaded, reload } = useFetched<HarvestOverview>("/api/harvest", onLocked, preloaded);
  const [adding, setAdding] = useState(false);

  return (
    <section className="panel" aria-labelledby="harvest-title">
      <p className="eyebrow" id="harvest-title">
        HARVEST
      </p>
      {loaded.state === "loading" && <p role="status">Loading your sources…</p>}
      {loaded.state === "error" && <Unavailable what="your sources" onRetry={reload} />}
      {loaded.state === "ok" && (
        <>
          <TankMeter intake={loaded.data.intake} />
          <CoveragePanel
            onLocked={onLocked}
            onChanged={() => {
              onChanged();
              reload();
            }}
            onOpenVocab={onOpenVocab}
            preloaded={preloadedCoverage}
          />
          <p className="eyebrow harvest-subhead">SOURCES</p>
          <button type="button" onClick={() => setAdding(true)}>
            Add source
          </button>
          {loaded.data.sources.length === 0 ? (
            <p className="hint">
              No sources yet. Add a story or page to harvest, or a catch-all such as "ChatGPT chat".
            </p>
          ) : (
            <ul className="harvest-list">
              {loaded.data.sources.map((s) => (
                <li key={s.id}>
                  <SourceRow source={s} onOpen={() => onOpenSource(s.id)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {adding && (
        <SourceSheet
          onClose={() => setAdding(false)}
          onSaved={(source) => {
            setAdding(false);
            onOpenSource(source.id);
          }}
          onOpenExisting={(id) => {
            setAdding(false);
            onOpenSource(id);
          }}
        />
      )}
    </section>
  );
}

function SourceRow({ source, onOpen }: { source: SourceSummary; onOpen: () => void }) {
  const host = hostOf(source.url);
  return (
    <button type="button" className="harvest-row" onClick={onOpen}>
      <span className="harvest-row-head">
        <span className="harvest-row-name">{source.name}</span>
        <span className={`chip chip--${source.status}`}>
          {source.status === "harvested" ? "Harvested" : "To harvest"}
        </span>
      </span>
      {(host || source.latest) && (
        <span className="harvest-row-meta">
          {host}
          {host && source.latest && " · "}
          {source.latest &&
            `${source.latest.filter ? `${source.latest.filter}, ` : ""}${dateOf(source.latest.created_at)}`}
        </span>
      )}
    </button>
  );
}

function SourceSheet({
  source,
  onClose,
  onSaved,
  onOpenExisting,
}: {
  source?: Source;
  onClose: () => void;
  onSaved: (source: Source) => void;
  onOpenExisting: (id: string) => void;
}) {
  const [name, setName] = useState(source?.name ?? "");
  const [url, setUrl] = useState(source?.url ?? "");
  const [notes, setNotes] = useState(source?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [existing, setExisting] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError("");
    setExisting(null);
    try {
      const response = await fetch(source ? `/api/sources/${source.id}` : "/api/sources", {
        method: source ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url, notes }),
      });
      if (response.ok) return onSaved((await response.json()) as Source);
      if (response.status === 409) {
        return setExisting(((await response.json()) as SourceConflictResponse).existing_id);
      }
      if (response.status === 401) {
        return setError("This device is locked. Unlock it and try again.");
      }
      if (response.status === 400) {
        const body = (await response.json()) as { field?: string; message: string };
        return setError(`${body.field ? `${body.field} ` : ""}${body.message}.`);
      }
      setError("Could not save. Please try again.");
    } catch {
      setError("Could not connect. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet label={source ? "Edit source" : "Add source"} onClose={onClose}>
      <p className="eyebrow">{source ? "EDIT SOURCE" : "ADD SOURCE"}</p>
      <label htmlFor="source-name">Name</label>
      <input
        id="source-name"
        value={name}
        maxLength={200}
        onChange={(event) => setName(event.target.value)}
      />
      <label htmlFor="source-url">URL (optional)</label>
      <input
        id="source-url"
        type="url"
        inputMode="url"
        autoCapitalize="none"
        spellCheck={false}
        value={url}
        onChange={(event) => setUrl(event.target.value)}
      />
      <label htmlFor="source-notes">Notes (optional)</label>
      <textarea
        id="source-notes"
        rows={3}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />
      {existing && (
        <p className="error" role="alert">
          Already in your sources.{" "}
          <button type="button" className="link" onClick={() => onOpenExisting(existing)}>
            Open it
          </button>
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="button" onClick={save} disabled={busy || name.trim() === ""}>
        {busy ? "Saving…" : "Save"}
      </button>
      <button type="button" className="secondary" onClick={onClose}>
        Cancel
      </button>
    </Sheet>
  );
}

function counts(h: HarvestSummary): string {
  return `${h.total} ${h.total === 1 ? "word" : "words"} · ${h.queued} queued · ${h.started} started`;
}

export function SourceView({
  id,
  onLocked,
  onBack,
  onOpenHarvest,
  onOpenSource,
  preloaded,
}: {
  id: string;
  onLocked: () => void;
  onBack: () => void;
  onOpenHarvest: (id: string) => void;
  onOpenSource: (id: string) => void;
  preloaded?: SourceDetail;
}) {
  const { loaded, reload } = useFetched<SourceDetail>(`/api/sources/${id}`, onLocked, preloaded);
  const [sheet, setSheet] = useState<"edit" | "delete" | "harvest" | null>(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function remove(path: string, after: () => void) {
    setError("");
    setDeleting(true);
    try {
      // The CSRF guard wants JSON on every write, bodyless DELETE included (415 otherwise).
      const response = await fetch(path, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (response.status === 401) return onLocked();
      // Already gone is the outcome asked for.
      if (!response.ok && response.status !== 404) throw new Error(String(response.status));
      after();
    } catch {
      setError("Could not delete. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  const errorLine = error && (
    <p className="error" role="alert">
      {error}
    </p>
  );

  return (
    <section className="panel">
      <button type="button" className="back" onClick={onBack}>
        ← Sources
      </button>
      {loaded.state === "loading" && <p role="status">Loading…</p>}
      {loaded.state === "error" && <Unavailable what="this source" onRetry={reload} />}
      {loaded.state === "ok" && (
        <>
          <p className="eyebrow">SOURCE</p>
          <h2 className="harvest-title">{loaded.data.source.name}</h2>
          {loaded.data.source.url && (
            <p className="harvest-url">
              <a href={loaded.data.source.url} target="_blank" rel="noreferrer">
                {loaded.data.source.url}
              </a>
            </p>
          )}
          {loaded.data.source.notes && <p className="hint">{loaded.data.source.notes}</p>}
          <button type="button" onClick={() => setSheet("harvest")}>
            New harvest
          </button>
          {loaded.data.harvests.length === 0 ? (
            <p className="hint">Not harvested yet.</p>
          ) : (
            <>
              <p className="eyebrow harvest-subhead">HARVESTS</p>
              <ul className="harvest-list">
                {loaded.data.harvests.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      className="harvest-row"
                      onClick={() => onOpenHarvest(h.id)}
                    >
                      <span className="harvest-row-head">
                        <span className="harvest-row-name">{h.filter ?? "No filter"}</span>
                        <span className="harvest-row-date">{dateOf(h.created_at)}</span>
                      </span>
                      <span className="harvest-row-meta">{counts(h)}</span>
                    </button>
                    {h.total === 0 && (
                      <button
                        type="button"
                        className="link"
                        disabled={deleting}
                        aria-label={`Delete empty harvest ${h.filter ?? "with no filter"}, ${dateOf(h.created_at)}`}
                        onClick={() => void remove(`/api/harvests/${h.id}`, reload)}
                      >
                        Delete empty harvest
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {sheet !== "delete" && errorLine}
          <button type="button" className="secondary" onClick={() => setSheet("edit")}>
            Edit source
          </button>
          <button type="button" className="secondary" onClick={() => setSheet("delete")}>
            Delete source
          </button>
          {sheet === "edit" && (
            <SourceSheet
              source={loaded.data.source}
              onClose={() => setSheet(null)}
              onSaved={() => {
                setSheet(null);
                reload();
              }}
              onOpenExisting={(existing) => {
                setSheet(null);
                onOpenSource(existing);
              }}
            />
          )}
          {sheet === "delete" && (
            <Sheet label="Delete source" onClose={() => setSheet(null)}>
              <p className="eyebrow">DELETE SOURCE</p>
              <p>
                Delete {loaded.data.source.name} and its harvests? {loaded.data.words}{" "}
                {loaded.data.words === 1 ? "word stays" : "words stay"} in your vault.
              </p>
              {errorLine}
              <button
                type="button"
                disabled={deleting}
                onClick={() => void remove(`/api/sources/${id}`, onBack)}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <button type="button" className="secondary" onClick={() => setSheet(null)}>
                Cancel
              </button>
            </Sheet>
          )}
          {sheet === "harvest" && (
            <NewHarvestSheet
              sourceId={id}
              lastFilter={loaded.data.harvests[0]?.filter ?? null}
              onClose={() => setSheet(null)}
              onCreated={(h) => {
                setSheet(null);
                onOpenHarvest(h.id);
              }}
            />
          )}
        </>
      )}
    </section>
  );
}

function NewHarvestSheet({
  sourceId,
  lastFilter,
  onClose,
  onCreated,
}: {
  sourceId: string;
  lastFilter: string | null;
  onClose: () => void;
  onCreated: (harvest: Harvest) => void;
}) {
  const [filter, setFilter] = useState(lastFilter ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setBusy(true);
    setError("");
    const posted = await postJson<Harvest>(`/api/sources/${sourceId}/harvests`, { filter });
    setBusy(false);
    if (!posted.ok) return setError(posted.message);
    onCreated(posted.body);
  }

  return (
    <Sheet label="New harvest" onClose={onClose}>
      <p className="eyebrow">NEW HARVEST</p>
      <label htmlFor="harvest-filter">Filter (optional)</label>
      <input
        id="harvest-filter"
        placeholder="CEFR A2+"
        maxLength={100}
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      <p className="hint">The level or rule ChatGPT picks words by, such as CEFR A2+.</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="button" onClick={create} disabled={busy}>
        {busy ? "Creating…" : "Create harvest"}
      </button>
      <button type="button" className="secondary" onClick={onClose}>
        Cancel
      </button>
    </Sheet>
  );
}

type InfoRow = "request" | "find" | "new";

const INFO: Readonly<Record<InfoRow, { name: string; text: string }>> = {
  request: {
    name: "the harvest request",
    text: "Tap Copy harvest request and paste it into a chat in your Urdu Coach Project. It runs vocab-list on this source, at the filter if there is one, and ChatGPT replies with a word list. Copy that list for Find new words.",
  },
  find: {
    name: "Find new words",
    text: "Tap Find new words, paste the word list and tap Find. Copy the new words for ChatGPT and paste them into the chat: it replies with JSON for just those words. Only exact matches count: plurals and other forms of a word you have still show as new.",
  },
  new: {
    name: "new vocab",
    text: "In your Urdu Coach Project, type vocab-json. In any other chat, tap Copy new-vocab prompt, paste it and add your words. Copy the JSON reply and tap Paste new vocab. The words join your queue and enter review a batch a day, oldest first; tick Start now to review them straight away. Up to 50 words per paste; a harvest takes as many pastes as you need.",
  },
};

export function HarvestView({
  id,
  onLocked,
  onChanged,
  onOpenVocab,
  onBack,
  preloaded,
}: {
  id: string;
  onLocked: () => void;
  onChanged: () => void;
  onOpenVocab: (id: string) => void;
  onBack: () => void;
  preloaded?: HarvestDetail;
}) {
  const { loaded, reload } = useFetched<HarvestDetail>(`/api/harvests/${id}`, onLocked, preloaded);
  const [copied, setCopied] = useState<Copied>({ kind: "none" });
  const [sheet, setSheet] = useState<"find" | "paste" | null>(null);
  const [info, setInfo] = useState<InfoRow | null>(null);
  const toggle = (row: InfoRow) => ({
    id: row,
    name: INFO[row].name,
    open: info === row,
    onToggle: () => setInfo(info === row ? null : row),
  });

  if (loaded.state !== "ok") {
    return (
      <section className="panel">
        <button type="button" className="back" onClick={onBack}>
          ← Source
        </button>
        {loaded.state === "loading" ? (
          <p role="status">Loading…</p>
        ) : (
          <Unavailable what="this harvest" onRetry={reload} />
        )}
      </section>
    );
  }

  const { harvest, source } = loaded.data;
  return (
    <section className="panel">
      <button type="button" className="back" onClick={onBack}>
        ← {source.name}
      </button>
      <p className="eyebrow">HARVEST</p>
      <h2 className="harvest-title">
        {source.name}
        {harvest.filter && <span className="hint"> · {harvest.filter}</span>}
      </h2>
      <p className="hint">
        {dateOf(harvest.created_at)} · {counts(harvest)}
      </p>
      <div className="handoff">
        <p className="eyebrow">CHATGPT</p>
        <div className="handoff-buttons">
          <button
            type="button"
            className="secondary wide"
            onClick={async () =>
              setCopied(
                await copy(
                  harvestRequest(source, harvest.filter),
                  "Harvest request copied. Paste it into your Urdu Coach Project chat.",
                ),
              )
            }
          >
            Copy harvest request
          </button>
          <InfoToggle {...toggle("request")} />
          {info === "request" && <InfoBox id="request" text={INFO.request.text} />}
          <button type="button" className="secondary wide" onClick={() => setSheet("find")}>
            Find new words
          </button>
          <InfoToggle {...toggle("find")} />
          {info === "find" && <InfoBox id="find" text={INFO.find.text} />}
          <button
            type="button"
            className="secondary"
            onClick={async () =>
              setCopied(
                await copy(
                  newVocabPrompt(),
                  "New-vocab prompt copied. Paste it into ChatGPT and add your words after it.",
                ),
              )
            }
          >
            Copy new-vocab prompt
          </button>
          <button type="button" className="secondary" onClick={() => setSheet("paste")}>
            Paste new vocab
          </button>
          <InfoToggle {...toggle("new")} />
          {info === "new" && <InfoBox id="new" text={INFO.new.text} />}
        </div>
        <CopiedNote copied={copied} />
      </div>
      {sheet === "find" && <FindWordsSheet onClose={() => setSheet(null)} onOpen={onOpenVocab} />}
      {sheet === "paste" && (
        <PasteNewSheet
          path={(start) => pastePath(harvest.id, start)}
          onClose={() => {
            setSheet(null);
            reload();
          }}
          onChanged={onChanged}
          onOpen={onOpenVocab}
        />
      )}
    </section>
  );
}
