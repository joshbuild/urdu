// f04: the Vocab tab — list (FR-D1), item detail and edit (FR-D2), manual entry (FR-D3). f06 adds
// the ChatGPT handoff panel; mp07 puts search first and adds the Suss view.
// One view at a time inside the tab; the list's filters live here so Back returns to the same list.

import { useCallback, useEffect, useState } from "react";
import type { StatusResponse, VocabItem } from "../../shared/api";
import { HandoffPanel } from "../handoff/HandoffPanel";
import { AddVocabSheet } from "../reader/AddVocabSheet";
import { SussView } from "../suss/SussView";
import { DEFAULT_FILTERS, type ListFilters, readStoredSort, storeSort } from "../vocab/list";
import { VocabDetail } from "../vocab/VocabDetail";
import { VocabEdit } from "../vocab/VocabEdit";
import { VocabList } from "../vocab/VocabList";

type View =
  | { kind: "list" }
  | { kind: "suss" }
  | { kind: "detail"; id: string }
  | { kind: "edit"; item: VocabItem };

export function VocabScreen({
  status,
  voice,
  openId,
  onOpened,
  onChanged,
}: {
  status: StatusResponse;
  voice: SpeechSynthesisVoice | null;
  // An item another screen asked to show (the reader's duplicate link).
  openId: string | null;
  onOpened: () => void;
  // The vault changed; App refreshes the counts.
  onChanged: () => void;
}) {
  const [view, setView] = useState<View>(() =>
    openId ? { kind: "detail", id: openId } : { kind: "list" },
  );
  const [filters, setFilters] = useState<ListFilters>(() => ({
    ...DEFAULT_FILTERS,
    sort: readStoredSort(),
  }));
  const [adding, setAdding] = useState(false);

  const changeFilters = useCallback((next: ListFilters) => {
    storeSort(next.sort);
    setFilters(next);
  }, []);

  useEffect(() => {
    if (!openId) return;
    setView({ kind: "detail", id: openId });
    onOpened();
  }, [openId, onOpened]);

  const open = (id: string) => setView({ kind: "detail", id });
  const toList = () => setView({ kind: "list" });
  // The vault changed: App refreshes the counts, and a fresh filters object refetches the list.
  const refreshList = () => {
    onChanged();
    setFilters((current) => ({ ...current }));
  };

  return (
    <section className="panel">
      <p className="eyebrow">VOCABULARY</p>

      {view.kind === "list" && (
        <VocabList
          filters={filters}
          onFilters={changeFilters}
          now={new Date().toISOString()}
          onOpen={open}
        >
          <div className="vocab-actions">
            <button type="button" onClick={() => setAdding(true)}>
              New item
            </button>
            <button type="button" className="secondary" onClick={() => setView({ kind: "suss" })}>
              Suss cards
            </button>
          </div>
          <HandoffPanel onChanged={refreshList} onOpen={open} />
        </VocabList>
      )}

      {view.kind === "suss" && <SussView onBack={toList} onOpen={open} onChanged={refreshList} />}

      {view.kind === "detail" && (
        <VocabDetail
          id={view.id}
          now={new Date().toISOString()}
          voice={voice}
          onBack={toList}
          onEdit={(item) => setView({ kind: "edit", item })}
          onDeleted={() => {
            onChanged();
            toList();
          }}
          onReleased={onChanged}
        />
      )}

      {view.kind === "edit" && (
        <VocabEdit
          item={view.item}
          activeLadderId={status.active_ladder_id}
          onCancel={() => open(view.item.id)}
          onSaved={(item) => {
            onChanged();
            open(item.id);
          }}
          onOpenExisting={open}
        />
      )}

      {adding && (
        <AddVocabSheet
          term=""
          sentence=""
          source="manual"
          doneLabel="Back to vocabulary"
          onClose={() => {
            setAdding(false);
            onChanged();
            // A fresh filters object refetches the list, so a new item shows up.
            setFilters((current) => ({ ...current }));
          }}
          onOpenExisting={(id) => {
            setAdding(false);
            open(id);
          }}
        />
      )}
    </section>
  );
}
