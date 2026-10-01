// f06 Stages 1-2: the ChatGPT round trip at the top of the Vocab list. Copy a prompt, run it
// in any ChatGPT chat, paste the JSON reply back. f11 corrections (FR-F9) are previewed with a tick
// per change and apply only the ticked ones. f13: Copy check prompt opens a dialog of check options
// (mode, fields, how many, only unchecked); its completeness mode replaced the f06 fill-in pair
// (FR-F7). f17: the new-vocab rows (paste, Find new words) moved to a harvest on the Harvest tab
// (NewVocabSheets.tsx); this panel keeps the check rows.

import { useState } from "react";
import {
  type CheckBatchResponse,
  type CheckMode,
  type CheckOptions,
  type CorrectionPlan,
  type CorrectionResult,
  type CorrectionsResponse,
  type FieldChange,
  type FillableField,
  MAX_CHECK_BATCH,
} from "../../shared/api";
import { Sheet } from "../reader/Sheet";
import {
  acceptList,
  defaultTicks,
  isReported,
  isShown,
  type Ticks,
  toggleField,
  toggleReset,
} from "./check";
import {
  MODE_LABELS,
  optionsProblem,
  parseCount,
  readCheckOptions,
  storeCheckOptions,
  toggleOptionField,
} from "./checkOptions";
import { type Copied, CopiedNote, copy, InfoBox, InfoToggle, postJson } from "./clipboard";
import { PasteBox } from "./NewVocabSheets";
import { checkPrompt, FIELD_LABELS, parsePasted } from "./prompts";

export function HandoffPanel({
  onChanged,
  onOpen,
}: {
  onChanged: () => void;
  onOpen: (id: string) => void;
}) {
  const [copied, setCopied] = useState<Copied>({ kind: "none" });
  const [busy, setBusy] = useState(false);
  const [pasting, setPasting] = useState<"options" | "check" | null>(null);
  const [info, setInfo] = useState(false);

  // The Worker picks and records the batch, so the prompt waits on it.
  async function copyCheck(options: CheckOptions) {
    setBusy(true);
    const posted = await postJson<CheckBatchResponse>("/api/handoffs/check-batch", options);
    setBusy(false);
    setPasting(null);
    if (!posted.ok) return setCopied({ kind: "copied", note: posted.message });
    const { handoff_id, items, candidates, unchecked } = posted.body;
    if (handoff_id === null)
      return setCopied({ kind: "copied", note: emptyNote(options, candidates) });
    const fresh = unchecked > 0 ? `; ${unchecked} not yet ${CHECKED_WAY[options.mode]}` : "";
    setCopied(
      await copy(
        checkPrompt(items, handoff_id, options),
        `Check prompt copied (${items.length} of ${candidates} items${fresh}). Paste it into ChatGPT.`,
      ),
    );
  }

  return (
    <div className="handoff">
      <p className="eyebrow">CHATGPT</p>
      <div className="handoff-buttons">
        <button type="button" className="secondary" onClick={() => setPasting("options")}>
          Copy check prompt
        </button>
        <button type="button" className="secondary" onClick={() => setPasting("check")}>
          Paste check reply
        </button>
        <InfoToggle id="check" name="the check" open={info} onToggle={() => setInfo(!info)} />
        {info && <InfoBox id="check" text={CHECK_INFO} />}
      </div>
      <p className="hint">New words come in through a harvest on the Harvest tab.</p>
      <CopiedNote copied={copied} />

      {pasting === "options" && (
        <CheckOptionsSheet busy={busy} onCopy={copyCheck} onClose={() => setPasting(null)} />
      )}
      {pasting === "check" && (
        <PasteCheckSheet
          onClose={() => setPasting(null)}
          onChanged={onChanged}
          onOpen={(id) => {
            setPasting(null);
            onOpen(id);
          }}
        />
      )}
    </div>
  );
}

// f14: a reminder of the round trip, shown under its button row.
const CHECK_INFO =
  "Tap Copy check prompt and choose correctness, completeness or both, the fields and how many items. Paste the prompt into ChatGPT and copy its JSON reply. Tap Paste check reply, untick anything you disagree with, and apply. Only ticked fields change; review times stay unless you tick Reset.";

const CHECKED_WAY: Readonly<Record<CheckMode, string>> = {
  correctness: "checked for correctness",
  completeness: "checked for completeness",
  both: "checked both ways",
};

const MARKED: Readonly<Record<CheckMode, string>> = {
  correctness: "marked checked",
  completeness: "marked filled",
  both: "marked checked and filled",
};

// Why a batch came back empty: nothing qualifies, or only_unchecked filtered every item out.
function emptyNote(options: CheckOptions, candidates: number): string {
  if (candidates > 0) {
    return "Every item has been checked this way; untick Only unchecked to go round again.";
  }
  if (options.mode === "correctness") return "No item has these fields to check.";
  if (options.mode === "completeness") return "Every item has these fields.";
  return "Your vault is empty; nothing to check.";
}

function CheckOptionsSheet({
  busy,
  onCopy,
  onClose,
}: {
  busy: boolean;
  onCopy: (options: CheckOptions) => void;
  onClose: () => void;
}) {
  const [options, setOptions] = useState<CheckOptions>(readCheckOptions);
  const [countText, setCountText] = useState(() => String(options.count));
  const current = { ...options, count: parseCount(countText) };
  const problem = optionsProblem(current);

  return (
    <Sheet label="Check options" onClose={onClose}>
      <p className="eyebrow">CHECK OPTIONS</p>
      <fieldset className="direction">
        <legend>Check for</legend>
        {(Object.keys(MODE_LABELS) as CheckMode[]).map((mode) => (
          <label key={mode}>
            <input
              type="radio"
              name="check-mode"
              value={mode}
              checked={options.mode === mode}
              onChange={() => setOptions({ ...options, mode })}
            />
            {MODE_LABELS[mode]}
          </label>
        ))}
      </fieldset>
      <fieldset className="direction">
        <legend>Fields</legend>
        {(Object.keys(FIELD_LABELS) as FillableField[]).map((field) => (
          <label key={field}>
            <input
              type="checkbox"
              checked={options.fields.includes(field)}
              onChange={() => setOptions(toggleOptionField(options, field))}
            />
            {FIELD_LABELS[field]}
          </label>
        ))}
      </fieldset>
      <label htmlFor="check-count">How many items</label>
      <input
        id="check-count"
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_CHECK_BATCH}
        value={countText}
        onChange={(event) => setCountText(event.target.value)}
      />
      <label className="check">
        <input
          type="checkbox"
          checked={options.only_unchecked}
          onChange={() => setOptions({ ...options, only_unchecked: !options.only_unchecked })}
        />
        Only items not yet checked this way
      </label>
      {problem && <p className="hint">{problem}</p>}
      <button
        type="button"
        disabled={busy || problem !== null}
        onClick={() => {
          storeCheckOptions(current);
          onCopy(current);
        }}
      >
        {busy ? "Copying…" : "Copy prompt"}
      </button>
      <button type="button" className="secondary" onClick={onClose}>
        Cancel
      </button>
    </Sheet>
  );
}

// A phone is too narrow for old and new side by side, so each change takes two lines, old struck out.
function ChangeValue({ change, side }: { change: FieldChange; side: "old" | "new" }) {
  const value = change[side];
  const props =
    change.field === "example_urdu"
      ? { className: "urdu-inline", dir: "rtl", lang: "ur" }
      : { dir: "auto" as const };
  if (side === "old") {
    return value === null ? (
      <span className="change-empty">(empty)</span>
    ) : (
      <del {...props}>{value}</del>
    );
  }
  return (
    <span>
      →{" "}
      {value === null ? (
        <span className="change-empty">(removed)</span>
      ) : (
        <ins {...props}>{value}</ins>
      )}
    </span>
  );
}

function Flag({ suggestion }: { suggestion: string }) {
  return (
    <p className="hint">
      Suggested spelling:{" "}
      <span className="urdu-inline" dir="rtl" lang="ur">
        {suggestion}
      </span>{" "}
      (not applied; edit the item if you agree)
    </p>
  );
}

function PlanLine({
  plan,
  ticks,
  onTicks,
}: {
  plan: CorrectionPlan;
  ticks: Ticks;
  onTicks: (ticks: Ticks) => void;
}) {
  const item = ticks[plan.vocab_id];
  return (
    <li>
      <span className="urdu-inline" dir="rtl" lang="ur">
        {plan.urdu}
      </span>
      {plan.outcome === "rejected" ? (
        <> · Rejected ({plan.reason})</>
      ) : (
        <>
          <p className="hint">{plan.reason}</p>
          {plan.changes.map((change) => (
            <label key={change.field} className="check change">
              <input
                type="checkbox"
                checked={item?.fields[change.field] ?? false}
                onChange={() => onTicks(toggleField(ticks, plan.vocab_id, change.field))}
              />
              <span className="change-body">
                <span className="change-field">{FIELD_LABELS[change.field]}</span>
                <ChangeValue change={change} side="old" />
                <ChangeValue change={change} side="new" />
              </span>
            </label>
          ))}
          {plan.ignored.length > 0 && (
            <p className="hint">Ignored, not asked for in this check: {fieldList(plan.ignored)}</p>
          )}
          {plan.urdu_suggestion !== undefined && <Flag suggestion={plan.urdu_suggestion} />}
          <label className="check">
            <input
              type="checkbox"
              checked={item?.reset ?? false}
              onChange={() => onTicks(toggleReset(ticks, plan.vocab_id))}
            />
            Reset to first rung
          </label>
        </>
      )}
    </li>
  );
}

const RESET_LABEL = {
  applied: "Reset to the first rung.",
  skipped: "Not reset: the item was reviewed after the preview.",
} as const;

function fieldList(fields: readonly FillableField[]): string {
  return fields.map((f) => FIELD_LABELS[f]).join(", ");
}

function ResultLine({
  result,
  onOpen,
}: {
  result: CorrectionResult;
  onOpen: (id: string) => void;
}) {
  return (
    <li>
      <span className="urdu-inline" dir="rtl" lang="ur">
        {result.urdu}
      </span>
      {result.outcome === "rejected" ? (
        <> · Rejected ({result.reason})</>
      ) : (
        <>
          <button type="button" className="link" onClick={() => onOpen(result.vocab_id)}>
            Open
          </button>
          {result.written.length > 0 && (
            <p className="hint">Saved: {fieldList(result.written.map((c) => c.field))}</p>
          )}
          {result.kept.length > 0 && (
            <p className="hint">Not saved, edited after the preview: {fieldList(result.kept)}</p>
          )}
          {result.declined.length > 0 && (
            <p className="hint">Unticked, left as they were: {fieldList(result.declined)}</p>
          )}
          {result.reset !== "not_asked" && <p className="hint">{RESET_LABEL[result.reset]}</p>}
          {result.urdu_suggestion !== undefined && <Flag suggestion={result.urdu_suggestion} />}
        </>
      )}
    </li>
  );
}

type Previewed = Extract<CorrectionsResponse, { preview: true }>;
type Applied = Extract<CorrectionsResponse, { preview: false }>;

function PasteCheckSheet({
  onClose,
  onChanged,
  onOpen,
}: {
  onClose: () => void;
  onChanged: () => void;
  onOpen: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<object>({});
  const [plan, setPlan] = useState<Previewed | null>(null);
  const [ticks, setTicks] = useState<Ticks>({});
  const [applied, setApplied] = useState<Applied | null>(null);

  async function preview() {
    const pasted = parsePasted(text);
    if (!pasted.ok) return setError(pasted.message);
    setBusy(true);
    setError("");
    const posted = await postJson<CorrectionsResponse>(
      "/api/handoffs/corrections?preview=1",
      pasted.value,
    );
    setBusy(false);
    if (!posted.ok) return setError(posted.message);
    // An already-applied batch answers with its stored outcome, so there is nothing to tick.
    if (!posted.body.preview) return setApplied(posted.body);
    // The Worker accepted it, so it is an object.
    setPayload(pasted.value as object);
    setPlan(posted.body);
    setTicks(defaultTicks(posted.body.results));
  }

  const accept = plan ? acceptList(plan.results, ticks) : [];

  async function apply() {
    setBusy(true);
    setError("");
    const posted = await postJson<CorrectionsResponse>("/api/handoffs/corrections", {
      ...payload,
      accept,
    });
    setBusy(false);
    if (!posted.ok) return setError(posted.message);
    if (posted.body.preview) return setError("Could not save. Please try again.");
    setApplied(posted.body);
    onChanged();
  }

  const errorLine = error && (
    <p className="error" role="alert">
      {error}
    </p>
  );

  if (applied) {
    const reported = applied.results.filter(isReported);
    return (
      <Sheet label="Check applied" onClose={onClose}>
        <p className="eyebrow">CHECK APPLIED</p>
        <p className="hint">
          {applied.repeat
            ? "This reply was already applied; nothing changed."
            : `${applied.batch_size} ${applied.batch_size === 1 ? "item" : "items"} ${MARKED[applied.mode]}.`}
        </p>
        {reported.length > 0 && (
          <ul className="handoff-results">
            {reported.map((r) => (
              <ResultLine key={r.vocab_id} result={r} onOpen={onOpen} />
            ))}
          </ul>
        )}
        <button type="button" onClick={onClose}>
          Done
        </button>
      </Sheet>
    );
  }

  if (plan) {
    const shown = plan.results.filter(isShown);
    const suggested = shown.filter((p) => p.outcome !== "rejected").length;
    return (
      <Sheet label="Preview corrections" onClose={onClose}>
        <p className="eyebrow">PREVIEW CORRECTIONS</p>
        <p className="hint">
          {plan.batch_size} {plan.batch_size === 1 ? "item" : "items"} in this batch;{" "}
          {suggested === 0
            ? "the chat found nothing to change."
            : `${suggested} with suggestions. Untick any you disagree with.`}
        </p>
        {shown.length > 0 && (
          <ul className="handoff-results">
            {shown.map((p) => (
              <PlanLine key={p.vocab_id} plan={p} ticks={ticks} onTicks={setTicks} />
            ))}
          </ul>
        )}
        {errorLine}
        <button type="button" onClick={apply} disabled={busy}>
          {busy
            ? "Saving…"
            : accept.length === 0
              ? plan.mode === "correctness"
                ? "Mark checked"
                : plan.mode === "completeness"
                  ? "Mark filled"
                  : "Mark checked and filled"
              : `Apply to ${accept.length} ${accept.length === 1 ? "item" : "items"}`}
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          Cancel
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet label="Paste check reply" onClose={onClose}>
      <p className="eyebrow">PASTE CHECK REPLY</p>
      <PasteBox value={text} onChange={setText} />
      {errorLine}
      <button type="button" onClick={preview} disabled={busy}>
        {busy ? "Checking…" : "Preview"}
      </button>
      <button type="button" className="secondary" onClick={onClose}>
        Cancel
      </button>
    </Sheet>
  );
}
