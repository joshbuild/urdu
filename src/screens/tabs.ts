// f03 s01: the app's four screens. A tab bar rather than a router — Phase 2 adds three screens to
// the shell and none of them are deep-linked, so there is nothing for routes to buy yet (f03 doc,
// s01 open question). The selected tab is kept in localStorage so a phone reload lands where it left.

export const TABS = ["read", "vocab", "review", "settings"] as const;
export type Tab = (typeof TABS)[number];

export const TAB_LABELS: Record<Tab, string> = {
  read: "Read",
  vocab: "Vocab",
  review: "Review",
  settings: "Settings",
};

export const DEFAULT_TAB: Tab = "read";

const STORAGE_KEY = "urdu.tab";

export function isTab(value: unknown): value is Tab {
  return typeof value === "string" && (TABS as readonly string[]).includes(value);
}

// Private browsing and blocked site data make these throw; the tab bar works without them.
export function readStoredTab(): Tab {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isTab(stored) ? stored : DEFAULT_TAB;
  } catch {
    return DEFAULT_TAB;
  }
}

export function storeTab(tab: Tab): void {
  try {
    localStorage.setItem(STORAGE_KEY, tab);
  } catch {
    // Non-fatal: the tab simply does not persist on this device.
  }
}
