// Voice spend (f07 s04, FR-G / FR-I1). One source of truth for the rates and the cap defaults, so
// the running estimate in the browser and the recorded cost in the Worker cannot drift apart.
//
// Rates are OpenAI's pricing page as read by mp02 on 2026-09-14
// (`pm/mini-plans/archive/mp02-gpt-live-spike-journal-archive.md`). They are prices, not a
// measurement: the Settings display is an estimate and is checked against the dashboard in
// smoke-test-07. Cached input is billed as plain input here — the difference is a fraction of a
// cent per session and the data channel does not always break the two apart.

// gpt-live-1 voice: $0.05 a minute, billed per second, plus 15 s charged at WebRTC session create.
export const VOICE_RATE_PER_SECOND = 0.05 / 60;
export const CREATE_CHARGE_SECONDS = 15;

// gpt-5.6-luna backend (the delegation model): $0.20 in / $1.20 out per 1M tokens.
export const BACKEND_INPUT_PER_TOKEN = 0.2 / 1_000_000;
export const BACKEND_OUTPUT_PER_TOKEN = 1.2 / 1_000_000;

export const DEFAULT_SOFT_CAP_USD = 0.5;
export const DEFAULT_HARD_CAP_USD = 1.0;

// A cap is a daily dollar amount. The bounds keep a typo from disabling spending control or
// authorising a fortune; 0 is allowed and means "refuse every session".
export const MIN_CAP_USD = 0;
export const MAX_CAP_USD = 20;

export type VoiceUsage = {
  // Cumulative billed session seconds as last reported by `session.usage.updated`/`session.closed`.
  seconds: number;
  backend_input_tokens: number;
  backend_output_tokens: number;
};

export const NO_USAGE: VoiceUsage = {
  seconds: 0,
  backend_input_tokens: 0,
  backend_output_tokens: 0,
};

// The create charge applies once a session exists, which is why it is not conditional on seconds.
export function voiceCost(seconds: number): number {
  return (Math.max(0, seconds) + CREATE_CHARGE_SECONDS) * VOICE_RATE_PER_SECOND;
}

export function backendCost(inputTokens: number, outputTokens: number): number {
  return (
    Math.max(0, inputTokens) * BACKEND_INPUT_PER_TOKEN +
    Math.max(0, outputTokens) * BACKEND_OUTPUT_PER_TOKEN
  );
}

export function sessionCost(usage: VoiceUsage): number {
  return (
    voiceCost(usage.seconds) + backendCost(usage.backend_input_tokens, usage.backend_output_tokens)
  );
}

// Dollars for display: always two decimals, so "$0.50" and "$0.00" read the same width.
export function formatUsd(usd: number): string {
  return `$${(Math.round(usd * 100) / 100).toFixed(2)}`;
}

export function isCapUsd(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MIN_CAP_USD &&
    value <= MAX_CAP_USD
  );
}

// A cap read back from the settings table. Anything unparseable falls back to the default rather
// than leaving spending uncapped.
export function capOrDefault(stored: string | null | undefined, fallback: number): number {
  // Not `Number(stored)` alone: Number(null) and Number("") are 0, a valid cap, which would turn a
  // missing row into "refuse every session".
  if (typeof stored !== "string" || stored.trim() === "") return fallback;
  const value = Number(stored);
  return isCapUsd(value) ? value : fallback;
}
