# ADR-NNNN — {Title}

> **Template usage.** Copy this file to `pm/adr/NNNN-{slug}.md` — `NNNN` is the next zero-padded monotonic number (look at the highest existing file in `pm/adr/`), `{slug}` is the decision's kebab-case name (e.g. `0001-storage-backend.md`). Fill each section, deleting the italic prompt as you answer it.
>
> **What earns an ADR (vs. a plain `DECISIONS.md` entry).** An ADR is for a **repeatedly-cited, architectural (`DT4`) and/or `🪦`-class** decision that wants a **stable link + lifecycle status** — the kind a future agent re-derives or re-litigates if it isn't pinned. Most decisions stay plain `DECISIONS.md` entries; reserve ADRs for the load-bearing few. **Process/PM-regime decisions are NOT ADRs** (ADRs are for *architecture*; the PM regime itself is a plain `DECISIONS.md` entry). Numbering therefore starts at `0001` with the architectural set, not the PM regime.
>
> **The `DECISIONS.md` ↔ ADR contract.** When a decision earns an ADR, its `DECISIONS.md` **Log body retires immediately** (no double-maintenance) — but its dated **Index row stays** (that row is the permanent address space every `DECISIONS.md <date>` citation resolves to) and gains a `→ pm/adr/NNNN-slug` pointer. The ADR is the body's new home; the Index row + the ADR are the surviving record.

**Status**: Accepted *(Proposed · Accepted · Superseded by ADR-NNNN · Deprecated — pick one)*
**Date**: *YYYY-MM-DD (the underlying decision date — match the `DECISIONS.md` Index row)*
**Decision type**: *`DT4` Architectural (typical) · reversibility class 🎩 / 💈 / 🪦*

**Back-links**:
- `DECISIONS.md` Index row → *the dated row this ADR extracts (e.g. `2026-04-25 — a system-level architecture decision`)*
- *the subsystem doc(s) this governs, if any (`#todo`: e.g. an architecture/system-map doc once one exists — e.g. Core engine)*

---

## Context

*What forces are in play? What problem, constraint, or pressure made a decision necessary? State the situation neutrally — the facts a reader needs before the choice makes sense. (No solution yet.)*

## Decision

*What did we choose, stated plainly and actively? The single load-bearing sentence first, then the shape of the chosen approach.*

## Consequences

*What becomes true once this is in force — the good, the bad, and the accepted costs? Include the mitigations for the costs.*

## Alternatives rejected

*What else was on the table, and why was each turned down? One short paragraph per alternative — this is the part most worth preserving, since it's what a future re-litigation will re-discover.*
