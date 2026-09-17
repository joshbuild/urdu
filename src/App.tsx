import { type FormEvent, useCallback, useEffect, useState } from "react";
import type { StatusResponse } from "../shared/api";
import "./app.css";

type Screen = "loading" | "locked" | "ready" | "unavailable";

export function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/status", { cache: "no-store", signal });
      if (signal?.aborted) return;
      if (response.status === 401) {
        setStatus(null);
        setScreen("locked");
        return;
      }
      if (!response.ok) throw new Error("status unavailable");
      const data: StatusResponse = await response.json();
      if (signal?.aborted) return;
      setStatus(data);
      setScreen("ready");
    } catch {
      if (!signal?.aborted) {
        setScreen("unavailable");
        setError("Could not reach your vault. Check your connection and try again.");
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadStatus(controller.signal);
    return () => controller.abort();
  }, [loadStatus]);

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const secret = new FormData(form).get("password");
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      if (!response.ok) {
        setError(
          response.status === 401
            ? "That secret did not match. Try again."
            : response.status === 429
              ? "Too many attempts. Wait a minute, then try again."
              : "Could not unlock your vault. Please try again.",
        );
        return;
      }
      form.reset();
      await loadStatus();
    } catch {
      setError("Could not connect. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function lock() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok && response.status !== 401) throw new Error("lock failed");
      setStatus(null);
      setScreen("locked");
    } catch {
      setError("Could not lock this device. You are still unlocked; please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    setBusy(true);
    setError("");
    await loadStatus();
    setBusy(false);
  }

  return (
    <main className="shell">
      <header className="brand">
        <img src="/icons/icon-192.png" width="64" height="64" alt="" />
        <div>
          <p className="eyebrow">YOUR URDU COMPANION</p>
          <h1>Urdu</h1>
        </div>
      </header>

      <section className="panel" aria-busy={busy || screen === "loading"}>
        {screen === "loading" && <p role="status">Opening your vault…</p>}

        {screen === "locked" && (
          <>
            <h2>Welcome back</h2>
            <p>Unlock your vocabulary vault on this device.</p>
            <form onSubmit={unlock}>
              <input type="hidden" name="username" autoComplete="username" value="owner" />
              <label htmlFor="password">Personal secret</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={busy}
                aria-describedby={error ? "request-error" : "unlock-hint"}
                autoCapitalize="none"
                spellCheck={false}
              />
              <p id="unlock-hint" className="hint">
                Use your saved secret from your password manager. This device stays unlocked until
                you lock it.
              </p>
              <button type="submit" disabled={busy}>
                {busy ? "Unlocking…" : "Unlock"}
              </button>
            </form>
          </>
        )}

        {screen === "ready" && status && (
          <>
            <p className="eyebrow">YOUR VAULT</p>
            <h2>A little Urdu, every day.</h2>
            <dl className="counts">
              <div>
                <dt>Vocabulary items</dt>
                <dd>{status.total.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Due for review</dt>
                <dd>{status.due.toLocaleString()}</dd>
              </div>
            </dl>
            <p className="hint">Review date: {status.today} · Vancouver time</p>
            <button type="button" className="secondary" onClick={lock} disabled={busy}>
              {busy ? "Locking…" : "Lock this device"}
            </button>
          </>
        )}

        {screen === "unavailable" && (
          <>
            <h2>Your vault is unavailable</h2>
            <button type="button" onClick={retry} disabled={busy}>
              {busy ? "Connecting…" : "Try again"}
            </button>
            <button type="button" className="secondary" onClick={lock} disabled={busy}>
              Lock this device
            </button>
          </>
        )}

        {error && (
          <p id="request-error" className="error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
