// The vocab text fields, shared by Add to vocab (f03 s06, FR-C6), manual entry (f04 FR-D3) and the
// edit form (f04 FR-D2), so every path writes the same fields in the same shape.

import type { AddDraft } from "./addVocab";

const FIELDS: { name: keyof AddDraft; label: string; urdu?: boolean; multiline?: boolean }[] = [
  { name: "urdu", label: "Urdu", urdu: true },
  { name: "roman", label: "Roman Urdu" },
  { name: "english", label: "English" },
  { name: "notes", label: "Notes", multiline: true },
  { name: "example_urdu", label: "Example (Urdu)", urdu: true, multiline: true },
  { name: "example_english", label: "Example (English)", multiline: true },
  { name: "tags", label: "Tags (comma-separated)" },
];

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
    </>
  );
}
