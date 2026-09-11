# Feature Plan — {Xyz}

> **Template usage.** **Assign the next `f##` handle from `pm/PLAN.md`'s Features Index first, then name the file** — a slug chosen before a handle is the one that gets written without one. Copy this file to `pm/features/f##-{slug}.md` (replace `{xyz}`/`{Xyz}`/`{slug}` with the feature's kebab-case name and `f##` with the assigned handle — e.g. `f05-reporting.md`). **The handle leads the filename; there is no un-prefixed form** — the `features/` directory already encodes the type, so drop the `feature-` and `-template` infixes entirely (never `feature-reporting.md`, never a bare `reporting.md`). Handle width is natural, two-digit minimum (`f01` … `f142`); existing handles are never re-padded. Full rule: `pm/pm-glossary.md` §4. Then fill each section, deleting the italic prompt as you answer it. This doc is the feature's **micro-project**: a single self-contained home for its vision through to its decision log, so the feature can be picked up cold without spelunking the global pm/ docs. Promote cross-cutting decisions to `pm/DECISIONS.md` and surfacing-now backlog items to `pm/TODO.md` as usual — this file owns the feature, not the project.



**Status**: 🔴 NOT STARTED · ⚪ DRAFT · 🟡 IN PROGRESS · 🟢 SHIPPED — *(pick one; one-line state)*
**Handle**: `f##` *(assign from the `pm/PLAN.md` Features Index)*
**Created**: *YYYY-MM-DD* · **Updated**: *YYYY-MM-DD*

**Owner docs it serves**: *the authority docs this feature touches or ripples (one per line) — optional but helps cold pickup.*

> **One-line:** *the whole feature in a sentence.*

> **Shared spine** (Status · Created · handle · Owner-docs · one-line · planned-work · §Decisions) is common to all three work-item types; the sections below are this type's specific schema. See `pm/pm-glossary.md` §5.



## Intent

### Vision

*What is this feature, who is it for, and what does it make possible that wasn't possible before? Capture the north-star in a paragraph or two — the "why" and the felt experience, not the "how".*

### Scope

*What, concretely, is IN this feature for this version? Where do its boundaries sit, and what is the smallest coherent thing that delivers the vision?*

### Exclusions

*What is deliberately NOT in scope here — and, where the line is non-obvious, why was each item rejected or merely deferred? (Name the thing it's easily confused with.)*

### User Stories

*Who does what, and to what end? Frame each as: as a ⟨role⟩, I want ⟨capability⟩ so that ⟨outcome⟩.*

### Non-Functional Requirements

*What qualities must this have beyond behaviour — performance budgets, latency, resource limits, accessibility, compatibility, persistence/migration? What must it never do?*



## Planning

### Testing

*How will we know it works and keeps working? List the automated tests, manual checks, and edge cases — and what each one must prove.*

### Done When

*What observable conditions, when ALL true, mean this feature is finished and verified? (Concrete, checkable — the acceptance gate.)*

### Roadmap

*What is the sequence of work to get from nothing to "Done When"? Break it into stages or vertical slices; note dependencies and what can proceed independently.*



## Status

### Recently Completed

*What has actually landed so far in this feature's life? Keep a dated, append-only running log of finished work (newest first).*

### Next Steps

*What is the immediate next action (or two) when work resumes here? The pick-up-from-cold pointer.*

### Open Questions

*What is still undecided or unknown, and whose call is it? Flag anything blocked on an answer, with the option space if known.*



## Decisions

*What has been settled for this feature, and why? Dated and append-only — read this before re-litigating a closed choice. Promote project-wide decisions up to `pm/DECISIONS.md`.*
