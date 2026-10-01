// f16: the Dash tab. Fetched each time the tab opens (the tab remounts on selection), so a
// finished review session shows at once. Read-only: viewing it changes nothing.

import { useCallback, useEffect, useState } from "react";
import type { DashResponse } from "../../shared/api";
import { DashView } from "../dash/DashView";

type Props = { onOpenVocab: (id: string) => void; onLocked: () => void };

export function DashScreen({ onOpenVocab, onLocked }: Props) {
  const [dash, setDash] = useState<DashResponse | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setError("");
      try {
        const response = await fetch("/api/dash", { cache: "no-store", signal });
        if (signal?.aborted) return;
        if (response.status === 401) return onLocked();
        if (!response.ok) throw new Error("dash failed");
        const data: DashResponse = await response.json();
        if (!signal?.aborted) setDash(data);
      } catch {
        if (!signal?.aborted) setError("Could not load the Dash. Check your connection.");
      }
    },
    [onLocked],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (dash) return <DashView dash={dash} onOpenVocab={onOpenVocab} />;

  return (
    <section className="panel">
      <p className="eyebrow">DASH</p>
      {error ? (
        <>
          <p className="error" role="alert">
            {error}
          </p>
          <button type="button" className="secondary" onClick={() => void load()}>
            Retry
          </button>
        </>
      ) : (
        <p role="status">Loading your Dash…</p>
      )}
    </section>
  );
}
