import { type FormEvent, useCallback, useEffect, useState } from "react";
import type { StatusResponse } from "../shared/api";
import "./app.css";
import { useVoice } from "./reader/useVoice";
import { ReaderScreen } from "./screens/ReaderScreen";
import { ReviewScreen } from "./screens/ReviewScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { readStoredTab, storeTab, TAB_LABELS, TABS, type Tab } from "./screens/tabs";
import { VocabScreen } from "./screens/VocabScreen";

type Screen = "loading" | "locked" | "ready" | "unavailable";

export function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [tab, setTab] = useState<Tab>(readStoredTab);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openVocabId, setOpenVocabId] = useState<string | null>(null);
  // One voice for the whole app: the reader speaks with what Settings chose (FR-C4, FR-I1).
  const voiceState = useVoice();

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

  function selectTab(next: Tab) {
    setTab(next);
    storeTab(next);
  }

  // The reader's duplicate link opens that item on the Vocab tab.
  function openVocab(id: string) {
    setOpenVocabId(id);
    selectTab("vocab");
  }

  const clearOpenVocab = useCallback(() => setOpenVocabId(null), []);
  const refreshStatus = useCallback(() => void loadStatus(), [loadStatus]);

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

  const ready = screen === "ready" && status !== null;

  return (
    <>
      <main className={ready ? "shell shell--tabbed" : "shell"}>
        <header className="brand">
          <img src="/icons/icon-192.png" width="64" height="64" alt="" />
          <div>
            <p className="eyebrow">YOUR URDU COMPANION</p>
            <h1>Urdu</h1>
          </div>
        </header>

        {ready && status ? (
          <>
            {tab === "read" && <ReaderScreen voiceState={voiceState} onOpenVocab={openVocab} />}
            {tab === "vocab" && (
              <VocabScreen
                status={status}
                voice={voiceState.voice}
                openId={openVocabId}
                onOpened={clearOpenVocab}
                onChanged={refreshStatus}
              />
            )}
            {tab === "review" && (
              <ReviewScreen status={status} voice={voiceState.voice} onChanged={refreshStatus} />
            )}
            {tab === "settings" && (
              <SettingsScreen onLock={lock} busy={busy} voiceState={voiceState} />
            )}
            {error && (
              <p id="request-error" className="error" role="alert">
                {error}
              </p>
            )}
          </>
        ) : (
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
                    Use your saved secret from your password manager. This device stays unlocked
                    until you lock it.
                  </p>
                  <button type="submit" disabled={busy}>
                    {busy ? "Unlocking…" : "Unlock"}
                  </button>
                </form>
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
        )}
      </main>

      {ready && (
        <nav className="tabs" aria-label="Sections">
          {TABS.map((name) => (
            <button
              key={name}
              type="button"
              className="tab"
              aria-current={tab === name ? "page" : undefined}
              onClick={() => selectTab(name)}
            >
              {TAB_LABELS[name]}
            </button>
          ))}
        </nav>
      )}
    </>
  );
}
