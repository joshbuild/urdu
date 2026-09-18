// f03: the bottom sheet the reader's Add (s06) and Define (s07) open over the passage, so the text
// and its scroll position are still there when it closes.

export function Sheet({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="sheet-backdrop">
      {/* The backdrop closes the sheet; the button is the accessible way to do the same. */}
      <button type="button" className="sheet-scrim" aria-label="Close" onClick={onClose} />
      <div className="sheet panel" role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}
