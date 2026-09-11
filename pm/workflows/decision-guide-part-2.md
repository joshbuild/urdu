# Decision Guide Part 2 — REFERENCE

*v0.01 | 2026-05-26*

*Pulled from Part 1 on ambiguity*

## Types — the five decision types

1. **DT1 Product** — user-facing functionality & behavior: what a control does, what's persisted, what the user sees, interaction semantics, gestures.
2. **DT2 Strategy** — scope, sequencing, version boundaries, what to cut/defer, what to build next.
3. **DT3 Aesthetic** — visual *intent*: color, typography, layout feel, motion, surface treatment. Functional UI *structure* (sizes, breakpoints, anatomy) is owned by the project's UI authority doc (`#todo`); intent lives here.
4. **DT4 Architectural** — see §DT4 below.
5. **DT5 Technical** — implementation choices **and local architecture inside an established boundary**: data structures, file organization, internal API shape, library/pattern selection, refactor scope, collaborator wiring within an existing subsystem. Invisible to the user when done right.

> **Straddle rule.** A technical choice with a user-perceptible perf consequence; an aesthetic that constrains layout; a DT5 that turns out to move a boundary (→ DT4): **escalate to the higher-attention bucket. When in doubt, escalate.**

## DT4 — what counts as architectural (the boundary that matters most)

A decision is **DT4** if it creates or changes a **cross-cutting boundary** — borrowing Nygard's test for architectural significance, anything touching the system's **structure, dependencies, interfaces, persisted state, threading/concurrency model, or where state lives.** Concretely:

- **Module split / boundary** — what's a unit, what talks to what.
- **Persisted-schema shape** — serialized parameters, save/snapshot format, schema version.
- **A public/serialized contract** — what data crosses a boundary, in which direction.
- **Concurrency model / where state lives** — who owns a piece of state; which thread/process touches it.
- **Public API.**

DT4 is **always material** — it constrains every DT5 and DT1 beneath it and is visible to users only indirectly (performance ceilings, consistency, what stays evolvable). **There is no "minor DT4."** If a call feels minor enough to slip the net, it is **DT5** (local architecture inside an established boundary) — *re-classify, don't escape.*

### DT4 vs DT5 — the razor (examples)

The single question: **does it create or move a cross-cutting boundary?**

| Decision                                                     | Call         | Why                                             |
| ------------------------------------------------------------ | ------------ | ----------------------------------------------- |
| Interpret unclear requirement such that a user would notice  | **DT1**      | User-facing functionality.                      |
| Add a field to the persisted save/snapshot format            | **DT4**      | Schema shape — a tattoo.                        |
| Add a new persisted parameter                                | **DT4**      | Persisted shape + likely a schema-version bump. |
| Change what crosses a public/serialized boundary             | **DT4**      | Contract change.                                |
| Move where a piece of state lives across a boundary          | **DT4**      | Where state lives.                              |
| Internal data structure for state a component *already* receives | **DT5**  | Local to the component; no new boundary.        |
| Rename an internal helper; reorder functions in a file       | **DT5**      | Local; invisible.                               |
| Hand-rolled loop vs util fn *inside* an existing function    | **DT5**      | Local; no boundary.                             |
| Introduce a new third-party dependency                       | **Escalate** | Escalation trigger regardless of type.          |

> `#todo` replace the generic rows above with this project's real DT4/DT5 boundary examples once they're known.

## Minor — the minor-impact threshold (DT1 / DT2 / DT3 only)

DT1/DT2/DT3 normally escalate — but trivial calls shouldn't burn Sponsor cycles. **Agent decides without escalation only when ALL of these hold; if ANY fails, escalate.** (These five gates are the formal version of the "hat" intuition.)

- **Reversible cheaply** — one commit; no schema bump, migration, data loss, or rollback gymnastics. *(= it's a hat.)*
- **Local in scope** — one widget, one panel, one milestone-internal sub-task. Not a pattern others copy.
- **No new precedent** — stays inside the existing grammar of the project's authority docs (`#todo`). No new token, primitive, term, or gesture.
- **No persisted-shape change** — no persisted-parameter add/rename/range-change, no schema-version implication, no semantic shift, no save/snapshot drift.
- **No backlog interaction** — doesn't cut, defer, or lock out a Backlog item; doesn't move a planned milestone boundary.

Minor → Agent decides + one bullet in the feature doc's §Decisions.

**Shape by type:**

- **DT1 minor:** tooltip wording for a non-critical control; default ordering when no spec exists; hover/active polish. **DT1 material:** any new parameter, gesture rebind, persisted change, or user-visible behavior change.
- **DT2 minor:** sub-task sequencing inside an approved milestone; which of two equally-blocking bugs first. **DT2 material:** feature deferral, scope cut, new feature insertion, milestone reshuffle.
- **DT3 minor:** picking among existing surface tokens for a one-off chrome detail; choosing between two already-spec'd visual variants. **DT3 material:** new visual primitive, new color/type token, layout-primitive change, motion-language change.

## Adjudication — choosing between surviving DT5 options

**Only run this when the decision is yours (DT5) AND the call isn't obvious.** Most DT5 calls don't need it. Compare options *only* on dimensions where they actually differ.

### Priority tiers

 🟣 **CRITICAL**

- **Performance on user-perceptible paths** — Predictable, bounded cost wherever a user would feel it: any hot path or inner loop, and interactive UI paths (drag, scroll, resize, hover, gesture response, animation frames). On these paths, a stall, dropped frame, or stutter is unshippable — perf beats elegance. Test: would a user notice if this got 2× slower or jittered?

 🔴 **HIGH**

- **Maintainability & evolution tolerance** — Cold reader picks it up, changes it, doesn't break it. Principled shape, no awkward special cases, abstractions that fit, identifiers that earn their weight. Survives the next 2–3 roadmap items without a rewrite. This is the default lens for the majority of the codebase — anywhere not on a user-perceptible path.

 🔵 **NORMAL — Tiebreakers**
  - **SDLC re-work cost** — For this change, cheapest path through design → build → test → ship → maintain.
  - **Common-path convention** — what a typical project in this space ships. Sanity check, not a driver.

### How to choose

Classify each real gap's **magnitude**: **Decisive** (lopsided — weeks vs hours, drop a dependency vs add one) · **Meaningful** (clearly better — one file vs three) · **Marginal** (noise — either passes review). Then:

1. **Decisive lead on any tier** → that option wins. *(Sanity-check a decisive lead on NORMAL alone — unusual.)*
2. **No decisive leads** → meaningful lead on the **highest tier** wins (CRITICAL > HIGH > NORMAL).
3. **Only marginal differences** → smaller diff > fewer files touched > easier to reverse.
4. **Genuinely tied** → **escalate.**

The whole pass fits in a few sentences in §Decisions — not a scorecard.

---

## Traces — worked examples

Three illustrative calls, each run through Part 1. They span the spectrum and each shows a different piece of machinery doing its job. *(`#todo` replace these generic traces with real project calls as they accumulate.)*

### Trace A — DT5, Agent decides (the frictionless common case)

**Decision:** how to track per-item "recently changed" state so a view can briefly highlight-and-decay an updated row (~200–500 ms), given the view *already* receives the updated-item data.

1. **Classify:** implementation detail inside the view, invisible when done right → **DT5.**
2. **Filter:** local render state; **does anything new cross a boundary? No** — the data already arrives. So this is local → confirms DT5, *not* DT4. Nothing disqualified.
3. **Reversibility:** 🎩 hat — swap the structure in one commit, no persisted change.
4. **Route:** DT5 → Agent decides. Options: (a) store `lastChangedTimestamp` per item, compute the highlight on the fly; (b) maintain a parallel decay buffer updated each frame. They tie on CRITICAL (both fit comfortably at the item counts in play); (a) has fewer moving parts and no second buffer to keep in sync — **meaningful lead on Maintainability (HIGH)** → (a) wins.
5. **Log:** one bullet in the feature doc §Decisions. Sponsor never sees it.

→ *This is the path most decisions should take: classify, confirm it's local, ship it.*

### Trace B — DT1 minor, Agent decides

**Decision:** the exact content/format/order of a status readout line, now that it's a header overlay rather than a footer.

1. **Classify:** user-visible text → **DT1.**
2. **Filter:** nothing disqualified.
3. **Reversibility:** 🎩 hat.
4. **Route:** check the five minor gates — reversible cheaply ✔ · local (one widget) ✔ · **no new precedent** ✔ *(uses existing project terms)* · no persisted-shape change ✔ · no backlog interaction ✔. All hold → **DT1 minor → Agent decides.**
5. **Log:** one bullet.

→ *Watch the precedent gate: if the agent wanted to introduce a **new** abbreviation not in the project's naming authority, "no new precedent" fails and this escalates instead. The gate catches term creep.*

### Trace C — Escalate, even though it looks like "just a label"

**Decision:** rename a user-facing control label that is also a persisted identifier.

1. **Classify:** it's a user-visible label (**DT1**) *and* part of the project's naming/terminology system (**DT3**). Straddle → higher-attention bucket; both are Sponsor-decides when material.
2. **Filter:** nothing disqualified — but note the next step.
3. **Reversibility:** 💈/🪦 — depends how deep the rename goes. A display-string change is a haircut; renaming the **persisted identifier** is a tattoo (migration + schema bump).
4. **Route:** the minor gates **fail on two independent counts** — *(i) No new precedent?* Fails: it sets/extends a naming grammar that other controls will copy. *(ii) No persisted-shape change?* Fails if it touches the persisted ID → schema-version bump + save-file compatibility. **Either failure alone forces escalation;** "persisted-identifier rename" is also a named escalation trigger. → **Agent does NOT decide.** Agent proposes: situation (generic label vs project register) · options (keep / rename display only / rename persisted ID + migrate) · tradeoffs (clarity value vs save-compat cost + schema bump) · risk (breaking existing saved data) · recommendation. **Sponsor decides.**
5. **Log:** after Sponsor confirms — feature doc if local, `pm/DECISIONS.md` if it ratifies the naming convention cross-cutting.

→ *The machinery's whole job is catching this: a call that looks like a one-word label edit is material on two axes and touches persisted shape. The gates surface that before any harm is done.*

---

*Maintenance: when the core procedure or the matrix changes, log it in `pm/DECISIONS.md`. If Part 1 ever outgrows ~one screen, split Part 2 into a sibling `decision-guide-reference.md` and keep Part 1 as the hot path — but not before, to avoid juggling two files.*
