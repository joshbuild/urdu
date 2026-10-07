// GET plumbing for the Harvest tab's views (f17), shared with f18's coverage panel.

import { useCallback, useEffect, useState } from "react";

type Loaded<T> = { state: "loading" } | { state: "error" } | { state: "ok"; data: T };

// GET with the app's lock handling; `reload` refetches. `preloaded` seeds the state, so a static
// render (tests, the headless layout check) shows a view without fetching.
export function useFetched<T>(path: string, onLocked: () => void, preloaded?: T) {
  const [loaded, setLoaded] = useState<Loaded<T>>(
    preloaded === undefined ? { state: "loading" } : { state: "ok", data: preloaded },
  );
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(path, { cache: "no-store", signal });
        if (signal?.aborted) return;
        if (response.status === 401) return onLocked();
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as T;
        if (!signal?.aborted) setLoaded({ state: "ok", data });
      } catch {
        if (!signal?.aborted) setLoaded({ state: "error" });
      }
    },
    [path, onLocked],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  return { loaded, reload: () => void load() };
}

export function Unavailable({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <>
      <p className="error" role="alert">
        Could not load {what}. Check your connection.
      </p>
      <button type="button" className="secondary" onClick={onRetry}>
        Retry
      </button>
    </>
  );
}
