# PM Approach — the Work-Front Doc Model (Delta from the base seven-doc model)
*v0.1 | 2026-06-18*

> **What this is.** A single-doc snapshot of how a project works on top of (and away from) the base PM skill suite. Two audiences: (1) any agent or sponsor working *in a repo that has adopted this pattern* who wants the worldview behind `STATUS.md` / `PLAN.md` / `pm/features/` / `pm/issues/`, and (2) any **other project** that wants to imprint the same pattern.
>
> **What it is not.** It is not the operational ritual sheet — the open/close procedure for a work item lives in **`pm/workflows/feature-lifecycle.md`**. It is not a re-teach of the base model. It is not the process-vocabulary reference — the precise definitions of the work types, the identifier ladder, the file-naming convention, and the information-home matrix live in **`pm/pm-glossary.md`** (this doc points at them, doesn't restate them). This doc is the *delta* and the *worldview*.

---

## TL;DR — four shifts on top of the base seven-doc model

1. **Every nontrivial feature or issue is its own micro-project doc** under `pm/features/f##-<slug>.md` or `pm/issues/i##-<slug>.md`. They carry vision-through-decision for that one thing.
2. **STATUS shrinks to active workfronts** and points outward; the full rosters live in **`PLAN.md` (Features index)**, **`issues.md` (Issues index)**, and **`mini-plans.md` (Mini-plans index)**.
3. **Trunk-based git**: all work commits directly to `main`. The commit is the rollback unit; branches/worktrees are a rare escape hatch.
4. **An authority catalogue sits above pm/**: a small set of single-source-of-truth domain docs that explicitly defer to each other, so cross-doc conflicts have a winner without a meeting.

Everything below expands these four.

---

## 1. The pm/ doc model

### 1.1 The base seven docs — kept, with role tweaks

The base surface is kept (`VISION.md`, `PRD.md`, `PLAN.md`, `STATUS.md`, `TODO.md`, `DECISIONS.md`) but **several of them are narrowed** so the per-feature docs can do the heavy lifting. *(The base model's seventh doc, `DISCUSSION.md`, was **retired** once the model oriented around work-fronts — discussion threads found their home in the owning work-item doc's §Open Questions, or a `pm/research/` memo for deeper design deliberation; there was nothing left for a standalone file to hold.)*

| Doc | Base role | Role here | Delta |
|---|---|---|---|
| **VISION.md** | North-star intent | Same | — |
| **PRD.md** | Product requirements | Same, **plus PRD↔as-built boundary rule** (§3.3) | clarified |
| **PLAN.md** | Rolling-wave roadmap | Roadmap **+ Features Index** (table pointing at `pm/features/*`) | **extended** |
| **STATUS.md** | Next Pointers + Done + Issues | The thin **hub**: `## Open Workfronts` (in-flight only) + `## Next Session Pointers` + "as of" stamp; **no journal** (narration → sibling journals; sessions → `SESSIONS.md`) | **narrowed → hub** |
| **TODO.md** | All backlog | Only items **too small for a feature/issue doc** | **narrowed** |
| **DECISIONS.md** | All significant decisions | **Cross-cutting / project-wide only** — feature-local decisions stay in the feature doc | **narrowed** |
| **DISCUSSION.md** | Open threads + inbox | *Retired* — threads live in the owning work-item doc's §Open Questions (or a `pm/research/` memo); no standalone file | **dropped** |
| **`issues.md`** (NEW) | — | The Issues Index, companion to PLAN.md's Features Index | **added** |
| **`mini-plans.md`** (NEW) | — | The Mini-plans Index — the third roster (vision-less execution containers) | **added** |
| **`SESSIONS.md`** (NEW) | — | Rolling last-~20 cross-front session one-liners (older lines roll off to journals + git); pairs with STATUS (*STATUS = where things stand · SESSIONS = what happened*) | **added** |

> **`CHANGELOG.md` sits at the repo root, not in pm/.** It ships *with the artifact* and is the user-facing release-notes drain (Keep-a-Changelog; `[Unreleased]` → dated/versioned at release). It is deliberately **not** a pm/ doc — pm/ holds the *internal* record (decisions, journals, narration); the CHANGELOG holds only what a *user* would notice.

> **The fourth work type.** This regime runs **four** work types, not three: feature · issue · **mini-plan** · todo. A *mini-plan* is a vision-less execution container — a sequenced bundle of scope with no single north-star (its discriminator vs a feature, which *owns* a vision). It has its own roster (`pm/mini-plans.md`), template (`pm/templates/mini-plan-{xyz}-template.md`), and `mp##` handle. See **`pm/pm-glossary.md` §1** for the full taxonomy and the boundary judgment calls.

### 1.2 The new layer — per-feature/issue micro-projects

Each non-trivial feature or issue gets a self-contained doc that owns its whole lifecycle: vision, scope, exclusions, user stories, NFRs, testing, "done when", roadmap, status (recently completed + next steps + open questions), and a local decision log. So the feature can be picked up *cold* without spelunking the global docs, and **parallel agents working different features don't all edit the same file**.

```
pm/
  features/
    f##-<slug>.md               ← live          (e.g. f05-reporting.md)
    f##-<slug>-journal.md       ← its narration
    archive/
      f##-<slug>-archive.md     ← shipped, tombstoned
  issues/
    i##-<slug>.md               ← live          (e.g. i12-stale-cache.md)
    archive/
      i##-<slug>-archive.md     ← closed
  mini-plans/
    mp##-<slug>.md              ← live (vision-less execution container)
    archive/
      mp##-<slug>-archive.md    ← done
  templates/
    feature-{xyz}-template.md   ← copy this for a new feature
    issue-{xyz}-template.md     ← copy this for a new issue
    mini-plan-{xyz}-template.md ← copy this for a new mini-plan
  improvement/
    improve-log.md              ← self-improve Tier-1 capture log (lens: workflows/self-improve.md)
```

> **The handle leads the filename — mandatory, with no un-prefixed form.** The directory encodes the type, so the name carries the handle and the slug only (`f05-reporting.md` — never `feature-reporting.md`, never a bare `reporting.md`). **Assign the handle first, then name the file**: pull the next number off the roster *before* copying the template. A slug chosen before a handle is the one that gets written without one. Handle width is natural, two-digit minimum (`f01` … `mp108`), and existing handles are never re-padded. Templates are the sole handle-less files here. Full rule: **`pm/pm-glossary.md` §4**; `pm-clean` check 14 audits it.

> **Mini-plans are the third micro-project type.** Same container shape as features/issues (own doc, own roster, own sibling journal, own archive) but a **divergent internal schema** — `Stages`/`Slices`/`Done-when` instead of `Vision`/`Scope`. All three templates share a **spine** (Status badge · Created · handle · Owner-docs · one-line · planned-work · §Decisions) and keep their type-specific sections — there is *no forced section-name uniformity*. The full information-home matrix + shared-spine schema live in **`pm/pm-glossary.md` §5**.

**When to create a doc:**

- **Feature doc** — any feature large enough to want a branch and a PR. Anything that's "build this thing" rather than "fix this line."
- **Issue doc** — any bug that is **nontrivial**: needs real diagnosis, spans surfaces, has taken or will take multiple attempts, or carries rollback risk. A one-line fix does *not* need a doc.

**Doc shape:** see `pm/templates/`. Both templates open with a **Status badge** (one of 🔴 / ⚪ / 🟡 / 🟢, with date) so the index tables can render the rollup. Both end with a local **§Decisions** section — promote cross-cutting decisions up to `pm/DECISIONS.md`, keep feature-internal ones here.

> **Convention — every copy-from scaffold lives in `pm/templates/`.** Feature, issue, mini-plan, and ADR templates live there; **any new doc *type* that wants a scaffold** adds its `<type>-{xyz}-template.md` here too — **never** a `_template.md` stashed beside the docs it seeds. Before authoring a new template, look in `pm/templates/` first.

### 1.3 PLAN.md gains a Features Index

PLAN.md still carries the rolling-wave phase plan at the top. Beneath it, a `## Features` section with a table:

```
| Feature                | Status         | Scope          | Phase | Updated |
| [Reporting](features/f05-reporting.md) | 🟡 In progress | ... | Phase 4 | 2026-06-18 |
| ...                    |                |                |       |         |
```

Every row points at the per-feature doc. The table is the **roster + rollup**; the doc is the truth.

### 1.4 `issues.md` is the Issues Index

Mirror file to PLAN.md's Features section, but at the pm/ root and for bugs/refactors/fixes. Same table shape. Status badges: ⚪ Draft, 🟡 Scoped/Investigating, 🔴 Open, 🟢 Closed.

### 1.5 STATUS is the thin hub (Open Workfronts + Next Pointers)

STATUS is a **pure cross-front hub**: an **`## Open Workfronts`** block listing only the features/issues/mini-plans *actively in flight* (each a one-line pointer to its doc/journal, badge mirroring the doc) + **`## Next Session Pointers`** (the cold-pickup next-actions) + an "as of" stamp. The full rosters live in PLAN.md / issues.md / mini-plans.md; STATUS does not duplicate them.

The rule: if it's actively being worked, it's a workfront row; if it's not, it's just an index row in PLAN/issues/mini-plans.md.

**STATUS is no longer a session journal.** Any lead-paragraph narration, `Done This Session`, or embedded `Recent sessions ledger` is gone. Verbose per-session narration now lives in each front's sibling **`<handle>-<slug>-journal.md`**; the rolling cross-front "what happened" index is **`pm/SESSIONS.md`** (last ~20, older lines roll off). See `pm/pm-glossary.md` §3 (vocabulary) and §5.1 (the information-home matrix).

**The wrap/resume ritual** (now encoded by the `pm-resume` / `pm-wrap` skills — run them rather than doing it by hand, but the steps remain the canonical reference):
- **Resume:** read the **hub** (`STATUS.md` Open Workfronts + Next Pointers) → skim **`SESSIONS.md`** (last ~20) → open the in-flight fronts' **journals** the pointers name. The hub orients; the journals carry the detail.
- **Wrap:** write the touched front's **journal** (prepend the session line) → prepend one terse line to **`SESSIONS.md`** + trim its tail past ~20 → update the **hub** *only if* a status badge changed or a next-action shifted → append `DECISIONS.md` (if material) / `CHANGELOG [Unreleased]` (if user-facing) → stage + commit. Keep the hub edit minimal — it is the contended write surface.

### 1.6 TODO shrinks to "too small for a doc"

Anything that warrants a feature, issue, **or mini-plan** doc *goes there instead*. TODO is the catch-all for project-wide chores, micro-tweaks, follow-ups, and items still waiting to be promoted into a doc or a triage routing. **Todo ↔ mini-plan boundary:** a single atomic chore stays a TODO line; once it's *N bundled tasks worth sequencing*, it graduates to a mini-plan (`mp##`). Promotion is agent discretion, surfaced in the wrap (see `pm/pm-glossary.md` §1). The base status-tag state machine (`#agent-triage` → `#agent-research` / `#sponsor-respond` / `#sponsor-decide` / `#agent-implement`) still applies inside TODO.

### 1.7 DECISIONS scoped to cross-cutting

Project-wide decisions only. Feature-local "we picked option B over A for this feature" decisions live in that feature doc's §Decisions section. They graduate up to `pm/DECISIONS.md` only when they affect other features, change a project-wide convention, or set a precedent.

**The routing — when to decide vs escalate, how to classify, what locks a decision in — lives in `pm/workflows/decision-guide-part-1.md`** (with `decision-guide-part-2.md` pulled on ambiguity). The decision guide and §1.7's "cross-cutting only" rule are complements: the guide says *who decides and when to log*; this section says *where the log lives*.

---

## 2. The git + lifecycle model

### 2.1 Trunk-based

> **All work commits directly to `main`.**

- No per-feature branch by default. A feature is a *sequence of small atomic commits on `main`*, not a branch merged at the end. The commit is the rollback unit and the review surface — keep it self-contained, well-described, and verified before it lands.
- **Why.** On a solo trunk (sponsor + one agent, serial work) a feature branch buys a clean rollback boundary and a PR but costs recurring merge-conflict friction: the global pm docs churn constantly, so every branch has to merge `main` back in and resolve conflicts that serial trunk work never generates. Not worth it at this team size.
- Branches/worktrees survive as a **rare escape hatch** (§2.4) — high-risk work wanting an isolated rollback boundary, or genuinely concurrent multi-agent runs. Named `feat/<slug>` / `fix/<slug>` / `issue/<slug>` when used.

### 2.2 Planning lands on `main` like everything else

Feature/issue docs are **planning artifacts, not branch artifacts** — write and commit them straight to `main`, then build against them on the trunk.

### 2.3 The open/close ritual

The actual step-by-step (gate check → status flips → archive/tombstone) lives in **`pm/workflows/feature-lifecycle.md`**. Read it before opening or closing a feature. The ambient hazards — commit hygiene, feature-doc-as-micro-project, per-feature state staying in the feature doc — are described in `AGENTS.md` § *Trunk-based Development — Main & Feature Docs*.

### 2.4 Escape hatch + shared-doc discipline

The default is serial work on `main`. Branches/worktrees are reserved for the exception:

1. **Branch only for high-risk isolation or genuine concurrency.** A change risky enough to want a clean abandon-line or a real PR review → a short `feat/<slug>` off `main`, integrated via `git-feature-closeout.md`. Two agents that must run *simultaneously* → a worktree.
2. **Per-feature state lives in the feature doc, not the global docs.** Feature-local detail (recently-completed / next-steps / open-questions) stays in the feature doc; the shared `STATUS.md` / `TODO.md` / `DECISIONS.md` carry only cross-cutting rollups. Keep each commit's diff focused.
3. **Only cross-cutting decisions and surfacing-now backlog promote to the shared docs.**

### 2.5 Archive convention

Rename a superseded file with an `-archive` suffix and move it to a local `archive/` folder *beside* the original — archive **in place**, don't relocate across the tree.

```
pm/features/f05-reporting.md
  → pm/features/archive/f05-reporting-archive.md
```

The archived name **keeps the handle** — archiving adds the `-archive` suffix and changes nothing else. Files already sitting under `archive/` are never renamed to match a later naming reform: their names are a faithful record of what they were called then.

For shipped feature docs, **tombstone the top** with a short *as-shipped* digest: status, what shipped, pointers to the authority docs (or the code) where the live truth now lives. The phased execution journal stays below the fold as the archaeological record. Update any refs to the old path.

---

## 3. The authority architecture (the layer above pm/)

This is the part that scales the base model from "small project session memory" to "project with several long-lived spec docs that need to agree." On a small or single-domain project it can be a single paragraph in `AGENTS.md`; on a project with several domain specs it earns its own section.

### 3.1 The 7-layer doc taxonomy

Every doc serves one (or, for the cross-cutting authority docs, a few) of these layers. Knowing the layer answers "where does this go?":

| Layer | Answers | Examples |
|---|---|---|
| 1 · **Intent** | why we're building this | `VISION.md` |
| 2 · **Requirements** | what must be true for users | `PRD.md` |
| 3 · **Architecture** | how major systems relate | `#todo` (e.g. an architecture/system-map doc) |
| 4 · **As-built** | how it actually works *now* | as-built docs; code + comments; archived feature *as-shipped* tombstones |
| 5 · **Tests** | how behaviour is verified | `test/`, smoke checklists |
| 6 · **Decisions** | why chosen, what was rejected | `DECISIONS.md` + feature-doc §Decisions + `pm/adr/` |
| 7 · **Process / session** | how we work, where we are | `STATUS.md`, `PLAN.md`, `issues.md`, `TODO.md`, `workflows/`, `features/`, `issues/` |

### 3.2 The authority catalogue

A small catalogue, kept in `AGENTS.md`, that names the single-source-of-truth doc for each domain and **how those SSOT docs defer to each other**. Example shape (one row per domain):

```
| Authority doc          | Authoritative for           | Defers to / wins over             |
| <schema source>        | data/schema layout          | edit-first; consuming surfaces gen'd |
| <product glossary>     | canonical nomenclature      | everything defers to it for names |
| pm/pm-glossary.md      | process vocabulary          | process terms defer here          |
| ...                    |                             |                                   |
```

**Two rules make this work:**
- **Edit the owner first, then ripple.** "Keep-in-sync" checklists live next to each domain (in `AGENTS.md` or in the owner doc). They name the adjacent surfaces that drift when the owner changes.
- **When two docs disagree, the owner wins.** No meetings.

### 3.3 The PRD ↔ as-built boundary rule

A persistent failure mode for any spec project: PRDs creep into describing what's built, as-built docs creep into wishful thinking. The rule:

- **PRD owns *what must be true*** — scope, behaviour, constraints, acceptance. Planned-but-unbuilt scope may be future-tense and **must be marked planned** (e.g., "post-v0", "v1").
- **As-built docs own *what is true now*** — never aspirational. Planned-not-built is marked *planned / proposed / unknown*, never stated as current fact.
- **Hybrid docs span both** — classify *within* the doc which parts are normative-spec vs descriptive-as-built.

---

## 4. Base lifecycle commands — superseded by the `pm-*` suite

The generic predecessor PM skills are **not used under this regime** — a committed project-local `pm-*` skill suite (`pm-resume`/`pm-wrap`/`pm-open`/`pm-close`/`pm-triage`/`pm-clean`/`pm-release`) replaces them and knows the regime (hub · journals · `SESSIONS.md` · `mp##` · shared spine · identifier register). Each base ritual maps to its `pm-*` replacement (`resume→pm-resume`, `wrap→pm-wrap`, `triage→pm-triage`, `clean→pm-clean`, `release→pm-release`); `pm-open`/`pm-close` are net-new lifecycle skills the base model lacked. See `.claude/skills/README.md`.

---

## 5. Imprinting this on a new project

Minimal copy set (in order):

1. **Scaffold the seven base docs** (the base init skill or equivalent).
2. **Copy this doc** (`pm/workflows/pm-approach.md`) — the worldview.
3. **Copy `pm/workflows/feature-lifecycle.md`** — the open/close ritual + trunk-based git policy (with the branch/worktree escape hatch). Tool-neutral; should work as-is.
4. **Copy `pm/pm-glossary.md`** — the process vocabulary the skills lean on.
5. **Copy `pm/templates/*`** — the per-feature/issue/mini-plan/ADR doc templates.
6. **Copy the `.claude/skills/pm-*` suite** (+ `orchestrate`, the `reviewer`/`verifier` agents) and `.claude/skills/README.md`.
7. **Create `pm/issues.md` and `pm/mini-plans.md`** as one-line "**File Purpose**: …" + an empty index table; create `pm/SESSIONS.md` with its roll-off header.
8. **Add a `## Features` section to `PLAN.md`**; add `## Open Workfronts` + `## Next Session Pointers` to `STATUS.md`.
9. **In `AGENTS.md` / `CLAUDE.md`**:
   - Add a short "Trunk-based Development — Main & Feature Docs" ambient-hazards section pointing at `pm/workflows/feature-lifecycle.md`.
   - Add the **archive convention** (one paragraph).
   - If the project has several domain spec docs: add a **§Doc architecture** section with the 7-layer taxonomy table, the authority catalogue table, and the PRD↔as-built boundary rule. On a small/single-domain project, keep the catalogue inline as a few bullets.
   - Point at this doc ("How we work — see `pm/workflows/pm-approach.md`").

**Adapt steps:**
- Fill the authority catalogue with the project's own SSOT docs.
- Pick the Status badges you want (🔴/⚪/🟡/🟢).
- Fill the build/test commands the `verifier` agent and `orchestrate` skill reference (the `#todo` placeholders).

---

## 6. Consolidation — where overlap is settled

- **`feature-lifecycle.md` stays separate.** It is the live operational sheet; this doc is the worldview. Two granularities, two readers.
- **Templates stay separate** under `pm/templates/`. They're meant to be copied. This is the canonical home for *every* copy-from scaffold.
- **`AGENTS.md` § Trunk-based Development** carries the ambient-hazards bullets + pointers to this doc (worldview) and `feature-lifecycle.md` (ritual).
- **`AGENTS.md` § Doc architecture** carries the live, project-specific authority catalogue; the *worldview* (the 7-layer taxonomy, the authority-catalogue *pattern*, the PRD↔as-built rule) is owned by §3 above. The abstract pattern lives here once; the live catalogue lives in AGENTS.md once; neither duplicates the other.
