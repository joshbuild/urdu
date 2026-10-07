// The vocab text fields, shared by Add to vocab (f03 s06, FR-C6), manual entry (f04 FR-D3) and the
// edit form (f04 FR-D2), so every path writes the same fields in the same shape.

import { CEFR_LEVELS, TOPIC_SECTIONS, TOPICS } from "../../shared/topics";
import type { AddDraft } from "./addVocab";

type TextField = Exclude<keyof AddDraft, "topic" | "cefr" | "tags">;

const FIELDS: { name: TextField; label: string; urdu?: boolean; multiline?: boolean }[] = [
  { name: "urdu", label: "Urdu", urdu: true },
  { name: "roman", label: "Roman Urdu" },
  { name: "english", label: "English" },
  { name: "notes", label: "Notes", multiline: true },
  { name: "example_urdu", label: "Example (Urdu)", urdu: true, multiline: true },
  { name: "example_english", label: "Example (English)", multiline: true },
];

// f18: the fixed topic list, grouped by section, for the topic and secondary pickers.
export function TopicOptions({ none }: { none: string }) {
  return (
    <>
      <option value="">{none}</option>
      {TOPIC_SECTIONS.map((section) => (
        <optgroup key={section.id} label={section.label}>
          {TOPICS.filter((t) => t.section === section.id).map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.label}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

export function DraftFields<D extends AddDraft>({
  idPrefix,
  draft,
  onChange,
}: {
  idPrefix: string;
  draft: D;
  onChange: (update: (current: D) => D) => void;
}) {
  return (
    <>
      {FIELDS.map(({ name, label, urdu, multiline }) => {
        const props = {
          id: `${idPrefix}-${name}`,
          value: draft[name],
          dir: urdu ? "rtl" : undefined,
          lang: urdu ? "ur" : undefined,
          className: urdu ? "urdu-field" : undefined,
          required: name === "urdu",
          onChange: (event: { target: { value: string } }) =>
            onChange((current) => ({ ...current, [name]: event.target.value })),
        };
        return (
          <div key={name}>
            <label htmlFor={props.id}>{label}</label>
            {multiline ? <textarea rows={2} {...props} /> : <input {...props} />}
          </div>
        );
      })}

      {/* Topic labels run long, so the topic pickers take the full width and the level half. */}
      <div className="vocab-filters">
        <div className="vocab-filters-wide">
          <label htmlFor={`${idPrefix}-topic`}>Topic</label>
          <select
            id={`${idPrefix}-topic`}
            value={draft.topic}
            onChange={(event) => onChange((current) => ({ ...current, topic: event.target.value }))}
          >
            <TopicOptions none="None" />
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-cefr`}>Level</label>
          <select
            id={`${idPrefix}-cefr`}
            value={draft.cefr}
            onChange={(event) => onChange((current) => ({ ...current, cefr: event.target.value }))}
          >
            <option value="">None</option>
            {CEFR_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>
        {[0, 1].map((index) => (
          <div key={index} className="vocab-filters-wide">
            <label htmlFor={`${idPrefix}-tag-${index}`}>Also about</label>
            <select
              id={`${idPrefix}-tag-${index}`}
              value={draft.tags[index] ?? ""}
              onChange={(event) =>
                onChange((current) => {
                  const tags = [current.tags[0] ?? "", current.tags[1] ?? ""];
                  tags[index] = event.target.value;
                  return { ...current, tags };
                })
              }
            >
              <TopicOptions none="—" />
            </select>
          </div>
        ))}
      </div>
    </>
  );
}
