# PM Glossary

**Version**: v0.1 (2026-06-18)
**File Purpose**: The standalone single-source-of-truth for the project's **process vocabulary** — the four work types, the identifier ladder, the file-naming convention, the information-home matrix, and the shared work-item spine.
This is the *process* counterpart to a product glossary (which owns *product* nomenclature). They are separate on purpose: a "Stage" or a "mini-plan" is a way-of-working term, not a thing the user sees.

> **Authority.** This doc owns the PM vocabulary + identifier register. `pm/workflows/pm-approach.md` is the worldview that *points here*; `AGENTS.md` carries a one-line pointer. When a process term's meaning is in question, this doc wins. Product names defer to the project's product glossary (`#todo` name it if/when one exists).

---

## 1. The four work types

Work is one of exactly four types. Each (except the degenerate todo) carries a **numbered handle** *and* a **kebab-case slug**, paired one-to-one in its roster.

| Type | Handle | Slug / file | Roster | Has a doc? | Has a journal? | When to reach for it |
|---|---|---|---|---|---|---|
| **Feature** | `f##` | `f##-<slug>.md` | `pm/PLAN.md` (Features Index) | yes (`pm/features/`) | yes (sibling `*-journal.md`) | "Build this thing." Owns a **vision** — a north-star of what it makes possible. |
| **Issue** | `i##` | `i##-<slug>.md` | `pm/issues.md` | yes (`pm/issues/`) | yes | "Fix this." **One problem with a diagnosis arc** — nontrivial, spans surfaces, multi-attempt, or rollback risk. |
| **Mini-plan** | `mp##` | `mp##-<slug>.md` | `pm/mini-plans.md` | yes (`pm/mini-plans/`) | yes | "Do these N bundled tasks." A **vision-less execution container** — a sequenced bundle of scope, no single north-star. |
| **Todo** | — (a line) | a line in `pm/TODO.md` | `pm/TODO.md` | no | no | "Too small for a doc." The deliberate **degenerate case** — atomic chore, micro-tweak, follow-up. |

**The discriminators (and their fuzzy edges — see §6):**
- **Feature vs mini-plan** — a feature *owns a vision*; a mini-plan is a vision-less execution container. (Promotion: a mini-plan that grows a vision graduates to a feature.)
- **Issue vs mini-plan** — an issue is *one problem with a diagnosis arc*; a mini-plan is *N bundled tasks*. A 2-fix bundle is genuinely ambiguous.
- **Todo vs anything-with-a-doc** — if it needs more than a line to be picked up cold, it wants a doc.

**Promotions** (`todo→mini-plan`, `todo→issue`, `*→feature`) are **agent discretion**, surfaced in the wrap / `SESSIONS.md` for post-hoc sponsor veto.

---

## 2. The identifier ladder

Four kinds of identifier, deliberately distinct so they never collide:

| Rung | Form | Scope | Lives in | Example |
|---|---|---|---|---|
| **Phase** | `Phase N` | **Global** roadmap grouping | `pm/PLAN.md` only | "Phase 3" |
| **Stage** | `Stage N` | **Work-front-internal** grouping | a feature / issue / mini-plan doc (Stage 0–N) | "Reporting Stage 3" |
| **Slice** | `s##` | a chunk of scope, **always scoped under its work item** — never bare | a work-item doc / roster | `f05-s03` |
| **Session** | `YYMMDD` + letter | an **executed bundle of work** (a date, no global counter) | journals, `SESSIONS.md`, `DECISIONS.md` | `260618a` |

**Phase vs Stage.** "Phase" is reserved for the **global** PLAN roadmap.
A *work-front-internal* grouping is a **Stage** — this is the **go-forward convention**: new and substantively-touched work-item docs name their internal grouping "Stage N." (The PLAN roadmap Phases are never renamed.)
**Historical feature-internal "Phase N" labels migrate lazily, as each doc is next substantively touched — they are *not* force-rewritten** (the §5.2 lazy-migration rule).

**Slice vs session are different *kinds* on purpose.** A **slice** is a *planned* scope chunk (always scoped — `f05-s03`, never bare `s03`). A **session** is *delivered* work (a date — `260618a`). They are **many-to-many**: one session may land parts of several slices; one slice may take several sessions. There is **no global session counter**.

**Doc-local identifiers never leak unqualified.** Any `C1`-style or `F5`-style label invented inside one doc stays scoped to that doc; if it's cross-referenced, qualify it with the owning front's handle (e.g. `f05 F5`). A bare cross-doc identifier is a bug.

---

## 3. The structural surfaces — vocabulary

- **Workfront** — a work item *actively in flight this session*. STATUS lists workfronts; the rosters list everything.
- **Hub** — `pm/STATUS.md` in its refactored form: a thin cross-front map (`## Open Workfronts` + `## Next Session Pointers` + an "as of" stamp). **Not** a session journal, **not** a sessions log.
- **Journal** — a sibling `<handle>-<slug>-journal.md` beside each work-item doc, carrying that front's verbose per-session narration. The work-item doc stays lean for scanning; the journal absorbs the prose.
- **Sessions log** — `pm/SESSIONS.md`: a **rolling last ~20** cross-front dated session one-liners, each pointing to its front's journal. Older lines roll off (the journals + git are the durable record). STATUS is *not* the sessions log; `SESSIONS.md` pairs with `STATUS.md` — *STATUS = where things stand · SESSIONS = what happened*.
- **Roster** — `PLAN.md` (features) / `issues.md` (issues) / `mini-plans.md` (mini-plans): the canonical list + status rollup of every work item of its type, each row → its doc.

---

## 4. The file-naming convention

**The handle leads the filename. Always — there is no un-prefixed form.** The live file is named `<handle>-<slug>.md`: the work item's handle (`f##`/`i##`/`mp##`), then its kebab-case slug, then `.md`. The directory encodes the type, so the type word is *not* repeated in the name (`pm/features/f05-reporting.md`, not `feature-reporting.md` and not `feature-f05-reporting.md`).

> **The operative ordering: assign the handle first, then name the file.** Take the next number from the roster *before* you copy the template or type a path. This ordering is the whole rule — a slug chosen before a handle is the one that gets written without one. Every ritual that creates a work-item doc (`pm-open`, `feature-lifecycle.md` §2.5/§3) opens with the handle assignment for exactly this reason.

| Type | Live file | Archived |
|---|---|---|
| Feature | `pm/features/f##-<slug>.md` | `pm/features/archive/f##-<slug>-archive.md` |
| Issue | `pm/issues/i##-<slug>.md` | `pm/issues/archive/i##-<slug>-archive.md` |
| Mini-plan | `pm/mini-plans/mp##-<slug>.md` | `pm/mini-plans/archive/mp##-<slug>-archive.md` |
| Journal | `<dir>/<handle>-<slug>-journal.md` (beside the doc) | rides the doc's archive move |
| Template | `pm/templates/<type>-{xyz}-template.md` | — (templates are handle-less scaffolds, and are the *only* handle-less files under a work-item taxonomy) |

`f##`/`i##`/`mp##` numbers are assigned by **roster order**, monotonic, archived items included — **never reused**. Archived files keep the `-archive` suffix and move into a local `archive/` folder *beside* the original (archive in place — never relocate across the tree).

**Handle width — natural width, two-digit minimum.** `##` is a **placeholder for the number, not a two-digit constraint**. Pad to two digits below 10 (`f01`, `i07`, `mp09`); write the natural width from 100 up (`mp108`, `f142`). **Existing handles are never re-padded** when the roster crosses a power of ten — `mp09` stays `mp09` after `mp108` exists. This makes handle assignment a pure append: the roster's next number, formatted, and no rename ripple ever fires from growth. (Zero-padding to three digits — `f001` — was considered and **declined**: it buys lexical sort only until 1000, and it would be a breaking rename across every adopter's existing docs, rosters, journals, and archives. Sort order is not worth a repo-wide `git mv`.)

> **Don't ripple renames into archives.** Frozen `*-archive.md` docs (and anything under an `archive/` folder) are **not** churned when a naming convention changes — their internal historical narration faithfully records what files were called *then*. Active links *into* archived files (from live rosters/hub) **are** repointed so navigation resolves.

---

## 5. Internal anatomy — the information-home matrix + the shared spine

The three work-item doc types are **container-parallel** (each has a handle, a home folder, a roster, a sibling journal, an archive) but their **internal section schemas legitimately diverge** — an issue's `Symptom`/`Diagnosis` has no feature analog; a feature's `Vision`/`Scope` has no issue analog. **The schema does not force section-name uniformity.** Instead it defines two orthogonal things.

### 5.1 The information-home matrix — *which information lives where*

Type-agnostic. Each class of information has exactly one primary home (plus, where noted, a thin mirror):

| Information class | Primary home | Mirror / note |
|---|---|---|
| Vision / scope / intent | the work-item doc | — |
| Planned work (stages/slices/roadmap) | the work-item doc | — |
| Sessions done (verbose narration) | the sibling **journal** | a one-liner in `SESSIONS.md` (rolling ~20) |
| Open questions | the work-item doc §Open Questions | a `pm/research/` memo when a sponsor-blocking trade-off wants extended, multi-turn deliberation |
| Next action (cold-pickup pointer) | the work-item doc | the hub's `## Next Session Pointers` for in-flight fronts |
| Decisions (work-local) | the work-item doc §Decisions | promote cross-cutting → `DECISIONS.md` |
| Status (the badge) | the work-item doc badge — **canonical** | roster row + hub **mirror** (may lag — see honesty line below) |

### 5.2 The shared spine — *the sections all three genuinely share*

Every work-item doc carries this spine, **plus** its type-specific sections:

**Spine (all three):** Status badge · Created/Updated · the `f##`/`i##`/`mp##` handle · Owner-docs (authority docs it serves) · one-line summary · planned-work block · §Decisions.

**Type-specific:**
- **Feature** — `Vision` / `Scope` / `Exclusions` / `User Stories` / `NFRs` / `Roadmap` / `Recently Completed` / `Next Steps` / `Open Questions`.
- **Issue** — `Symptom` / `Diagnosis` / `Fix Plan` / `Done When` / `Status` / `Open Questions` / `Log & Decisions`.
- **Mini-plan** — `Stages` / `Slices` / `Done When` / `Open Questions`.

> **`Open Questions` is shared, not type-specific.** All three types carry it — it is the in-doc home the §5.1 matrix assigns to open questions. It is *not* in the §5.2 spine list because the spine is the always-on skeleton; `Open Questions` is present-when-non-empty. A question escalates to a `pm/research/` memo only when sponsor-blocking and wanting extended, multi-turn deliberation, cross-linked back here when it does.

**Scope of conformance:** new docs conform from the template; existing docs **migrate lazily as touched** (not a forced retrofit). A `pm-clean` check guards template divergence.

---

## 6. Standing judgment calls & honesty lines

*Read these before assuming the regime is airtight — they are deliberately-left soft edges, named so no one mistakes them for oversights.*

**Boundary cases (standing judgment calls, not closed):**
- **Issue ↔ mini-plan** — a bundle that is mostly fixes blurs the line; a 2-fix bundle is genuinely ambiguous. Caller's call, surfaced in the wrap.
- **Mini-plan ↔ feature** — the "owns a vision?" discriminator is defensible but has judgment-call cases; the `*→feature` promotion trigger still wants a sharper named test.

**Honesty line (a) — status is triplicated-with-lag.** Status physically lives in three places (doc badge · roster row · hub). The badge is *canonical* and the other two *mirror* it, but they **may lag**. This is a deliberate punt on the "one job, one home" ideal for the status job, not a solution.

**Honesty line (b) — historical labels coexist with the go-forward convention.** As the regime is adopted, older docs keep their historical `Phase N` / session labels until each is next substantively touched — they migrate lazily (§5.2), not by a force-rewrite. A feature-internal "Phase N" in an older doc *aliases* what the convention now calls "Stage N."
