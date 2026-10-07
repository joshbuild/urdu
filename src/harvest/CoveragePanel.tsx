// f18 (FR-L): the coverage grid on the Harvest tab. Have/target per topic and level, folded by
// section; Next batch asks ChatGPT for the two emptiest cells, a tapped open cell for that cell,
// and Paste batch reply brings the answer back into a harvest of the Topics source.

import { useState } from "react";
import type { BatchIssueResponse, CoverageResponse } from "../../shared/api";
import type { QuotaLevel } from "../../shared/topics";
import { type Copied, CopiedNote, copy, postJson } from "../handoff/clipboard";
import { PasteNewSheet } from "../handoff/NewVocabSheets";
import { batchPrompt } from "../handoff/prompts";
import { type CoverageGrid, coverageGrid, type GridCell, type LevelTotal } from "./coverage";
import { Unavailable, useFetched } from "./fetched";

const BATCH_PASTE = (start: boolean) => `/api/batches/handoffs${start ? "?start=1" : ""}`;

const ratio = (t: { have: number; quota: number }) => `${t.have}/${t.quota}`;

function TotalsLine({ totals }: { totals: readonly LevelTotal[] }) {
  return (
    <span className="coverage-totals">
      {totals.map((t) => (
        <span key={t.level}>
          {t.level} {ratio(t)}
        </span>
      ))}
    </span>
  );
}

function Cell({
  cell,
  topic,
  label,
  busy,
  onAsk,
}: {
  cell: GridCell;
  topic: string;
  label: string;
  busy: boolean;
  onAsk: (topic: string, level: QuotaLevel) => void;
}) {
  if (cell.quota === 0) {
    return <td className="coverage-cell coverage-cell--none">{cell.have > 0 ? cell.have : "–"}</td>;
  }
  const fill = Math.min(1, cell.have / cell.quota);
  const state = cell.open ? (cell.have === 0 ? "empty" : "part") : "full";
  return (
    <td className={`coverage-cell coverage-cell--${state}`}>
      {cell.open ? (
        <button
          type="button"
          disabled={busy}
          aria-label={`Ask for ${label} at ${cell.level}: ${cell.have} of ${cell.quota}`}
          onClick={() => onAsk(topic, cell.level)}
          style={{ "--fill": `${Math.round(fill * 100)}%` } as React.CSSProperties}
        >
          {ratio(cell)}
        </button>
      ) : (
        ratio(cell)
      )}
    </td>
  );
}

export function CoverageTable({
  grid,
  busy,
  onAsk,
}: {
  grid: CoverageGrid;
  busy: boolean;
  onAsk: (topic: string, level: QuotaLevel) => void;
}) {
  return (
    <div className="coverage-sections">
      {grid.sections.map((section) => (
        <details key={section.id} className="coverage-section">
          <summary>
            <span className="coverage-section-name">{section.label}</span>
            <TotalsLine totals={section.totals} />
          </summary>
          <table className="coverage-table">
            <thead>
              <tr>
                <th scope="col">Topic</th>
                <th scope="col">A1</th>
                <th scope="col">A2</th>
                <th scope="col">B1</th>
                <th scope="col" title="B2 and above, no target yet">
                  B2+
                </th>
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row) => (
                <tr key={row.slug}>
                  <th scope="row">{row.label}</th>
                  {row.cells.map((cell) => (
                    <Cell
                      key={cell.level}
                      cell={cell}
                      topic={row.slug}
                      label={row.label}
                      busy={busy}
                      onAsk={onAsk}
                    />
                  ))}
                  <td className="coverage-cell coverage-cell--none">{row.beyond || "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ))}
    </div>
  );
}

export function CoveragePanel({
  onLocked,
  onChanged,
  onOpenVocab,
  preloaded,
}: {
  onLocked: () => void;
  onChanged: () => void;
  onOpenVocab: (id: string) => void;
  preloaded?: CoverageResponse;
}) {
  const { loaded, reload } = useFetched<CoverageResponse>("/api/coverage", onLocked, preloaded);
  const [copied, setCopied] = useState<Copied>({ kind: "none" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pasting, setPasting] = useState(false);

  async function ask(cell?: { topic: string; level: QuotaLevel }) {
    setBusy(true);
    setError("");
    setCopied({ kind: "none" });
    const posted = await postJson<BatchIssueResponse>("/api/batches", cell ?? {});
    setBusy(false);
    if (!posted.ok) return setError(posted.message);
    const asked = posted.body.cells.map((c) => `${c.ask} ${c.level} ${c.topic}`).join(" + ");
    setCopied(
      await copy(
        batchPrompt(posted.body),
        `Batch prompt copied (${asked}). Paste it into ChatGPT, then tap Paste batch reply.`,
      ),
    );
  }

  if (loaded.state === "loading") return <p role="status">Loading coverage…</p>;
  if (loaded.state === "error") return <Unavailable what="coverage" onRetry={reload} />;

  const grid = coverageGrid(loaded.data);
  const anyOpen = grid.totals.some((t) => t.have < t.quota);
  return (
    <div className="coverage">
      <p className="eyebrow">COVERAGE</p>
      <p className="coverage-summary">
        <TotalsLine totals={grid.totals} />
      </p>
      {grid.unclassified > 0 && (
        <p className="hint">
          {grid.unclassified} {grid.unclassified === 1 ? "word has" : "words have"} no topic or
          level yet.
        </p>
      )}
      <div className="handoff-buttons">
        <button
          type="button"
          className="secondary"
          disabled={busy || !anyOpen}
          onClick={() => void ask()}
        >
          {busy ? "Choosing…" : anyOpen ? "Next batch" : "Every target met"}
        </button>
        <button type="button" className="secondary" onClick={() => setPasting(true)}>
          Paste batch reply
        </button>
      </div>
      <CopiedNote copied={copied} />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <CoverageTable grid={grid} busy={busy} onAsk={(topic, level) => void ask({ topic, level })} />
      {pasting && (
        <PasteNewSheet
          path={BATCH_PASTE}
          title="Paste batch reply"
          onClose={() => {
            setPasting(false);
            reload();
          }}
          onChanged={onChanged}
          onOpen={onOpenVocab}
        />
      )}
    </div>
  );
}
