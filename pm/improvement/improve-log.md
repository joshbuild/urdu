# Improve Log — Urdu PWA

**File Purpose**: The **Tier-1 capture store** of the self-improvement loop — an append-only, bounded, *sweepable* log of process/dev observations (gotchas, repeated errors, friction, near-misses) that have no terse, per-line home elsewhere.
One line per observation; captured cheaply at task boundaries; **consolidated** during `pm-clean`'s deep sweep, where a recurrence gate promotes only the patterns worth a durable rule (per [`pm/workflows/self-improve.md`](../workflows/self-improve.md), the shared lens).

> **This is a staging area, not a guidance doc.** Appending here is low-stakes and ungated — a line costs nothing and is allowed to be wrong or one-off. The *promotion* of a line into an owner doc is the gated, propose-only act (see the lens). Lines never accumulate forever: promoted/dismissed entries roll off to `archive/improve-log-archive.md` during the sweep, so the live log stays short by construction.

## Boundary — what belongs here vs. the neighbours

This log is **not** a second home for things that already have one:

- a decision or reversal still goes to `pm/DECISIONS.md`;
- a framework/build/tooling gotcha still goes to the project's own tips doc (if it keeps one);
- a durable, already-earned engineering pattern lives in its promoted owner doc — it does not stay here long-term.

The improve-log captures the *process/dev observations* in between — the ones with no terse, sweepable home.

## Entry format

One line per observation, semantic-line-break friendly, greppable by `[area]` for recurrence:

```
- YYYY-MM-DD · [area] · <terse observation — what bit, in one clause>. **Ev:** <commit sha / file:line / session id>. **St:** open
```

- **`[area]`** — a *freeform* lowercase tag: no enforced taxonomy; a clustered taxonomy emerges from real entries. Reuse an existing tag when one fits (that reuse is exactly what the recurrence gate reads). Examples: `[git]`, `[build]`, `[planning]`, `[doc-ripple]`, `[tooling]`.
- **`Ev:`** — the evidence anchor (the incident that produced the line). Required — every line is grounded in a specific miss, never an abstract worry.
- **`St:`** — `open` (live), `promoted→<owner doc>` (a durable rule landed; line is now drainable), or `dismissed` (judged one-off/not worth a rule; drainable). `promoted`/`dismissed` lines roll to the archive on the next sweep.

**Worked example (illustrative — not a live entry):**

```
- 2026-01-15 · [planning] · A cleanup slice was scoped from a doc claim about where dead code lived — the claim was stale after a refactor; one grep at scoping time would have caught it. Watch: removal slices should grep-verify the target exists before becoming work. **Ev:** commit a1b2c3d; pm/features/f03-*.md §Slices. **St:** open
```

---

## Log

*(Append newest-last. Empty at birth — capture fires from `/pm-stress-test` and `/pm-wrap --improve`; consolidation from `/pm-clean`'s deep sweep.)*
- 2026-10-01 · [verify] · Headless Edge at --window-size=360 lays the page out wider and crops the screenshot, so the first 360 px check showed false clipping and hid the real six-tab overflow; framing the page in a 360 px iframe gave a true viewport. Watch: phone-width headless checks need an iframe (or device emulation), not just a window size. **Ev:** f16 journal 261001b; commit 0501e1f. **St:** open
- 2026-10-01 · [review] · A derived metric was banded on the raw ratio while the UI showed a rounded percent, so 90.4% displayed "90%" beside "Recall is high"; the independent review caught it. Watch: when a threshold drives wording next to a rounded number, compare the rounded value. **Ev:** shared/dash.ts recallBand; commit 0501e1f. **St:** open
- 2026-10-01 · [review] · An Intl.DateTimeFormat per instant made a whole-history derivation 63–111 ms on 5,000 events; review flagged it against the Workers CPU limit, and memoising per 15-minute slot fixed it. Watch: any per-event timezone bucketing in the Worker should reuse one formatter and memoise. **Ev:** shared/dates.ts dateIn; commit 7eb3514 (Decisions). **St:** open
