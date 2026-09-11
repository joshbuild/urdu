# Issue — {Xyz}

> **Template usage.** **Assign the next `i##` handle from `pm/issues.md` first, then name the file** — a slug chosen before a handle is the one that gets written without one. Copy this file to `pm/issues/i##-{slug}.md` (replace `{xyz}`/`{Xyz}`/`{slug}` with the issue's kebab-case name and `i##` with the assigned handle — e.g. `i12-export-timeout.md`). **The handle leads the filename; there is no un-prefixed form** — the `issues/` directory already encodes the type, so drop the `issue-` and `-template` infixes entirely (never `issue-export-timeout.md`, never a bare `export-timeout.md`). Handle width is natural, two-digit minimum (`i01` … `i142`); existing handles are never re-padded. Full rule: `pm/pm-glossary.md` §4. Then fill each section, deleting the italic prompt as you answer it. Reach for an issue doc when a **bug is nontrivial** — it needs real diagnosis, spans several surfaces, has taken (or will take) multiple attempts, or carries rollback risk. A one-line fix does **not** need a doc; commit it straight to `main` (a `TODO.md` line at most). This doc lets `STATUS.md` / `TODO.md` stay light by pointing here for the detail, and lets the issue be picked up cold. **Work commits directly to `main`** (trunk-based) — no `issue/{slug}` branch by default; a branch is the rare escape hatch (see `pm/workflows/feature-lifecycle.md`). Promote cross-cutting decisions to `pm/DECISIONS.md` as usual. See `pm/pm-glossary.md` §1 for the issue-vs-mini-plan boundary.



**Status**: 🔴 OPEN · 🟡 INVESTIGATING · 🔵 FIXING · 🟢 RESOLVED — *(pick one; one-line state)*
**Handle**: `i##` *(assign from the `pm/issues.md` Issues Index)*
**Created**: *YYYY-MM-DD* · **Updated**: *YYYY-MM-DD*

**Owner docs it serves**: *the authority/feature docs this issue touches or ripples (one per line) — optional.*

> **One-line:** *the bug + the fix shape in a sentence.*

> **Shared spine** (Status · Created · handle · Owner-docs · one-line · planned-work · §Decisions) is common to all three work-item types; the sections below are this type's specific schema. See `pm/pm-glossary.md` §5.

---

## Symptom

*What is actually wrong, as observed? Describe the broken behaviour, who/what it hits, and how bad it is (blocker / annoyance / cosmetic). Include the repro: the smallest steps, environment, and inputs that trigger it — and what you expected instead. If it's intermittent, say how often and under what conditions.*

## Diagnosis

*What is the real, underlying cause — and why is this nontrivial rather than a quick patch? Trace from symptom to root: the failing code path, the wrong assumption, the architectural mismatch. If the cause is still unknown, record what's been ruled out and the leading hypotheses. (This is the section that earns the doc — be specific about the "why", with `file:line` pointers where you can.)*

## Fix Plan

*What is the approach, and in what order? Name the shape (one-shot patch vs phased), then list the steps or vertical slices and their dependencies. Call out anything that must NOT change — invariants, adjacent behaviour, contracts to preserve — so the fix doesn't trade one bug for another.*

## Done When

*What observable conditions, when ALL true, mean this is fixed and verified? Make each one checkable: the repro no longer reproduces, a regression guard added (and where), the affected surfaces re-verified, and the docs synced.*

## Status

*Where does this stand right now, for a cold pickup? The immediate next action (or two), plus any open questions or blockers and whose call they are.*

## Open Questions

*Unresolved trade-offs or sponsor-blocking questions specific to this issue (the work-item doc is their primary home — `pm/pm-glossary.md` §5.1). Each: the question, the option space, and whose call it is. **Escalate to a `pm/research/` memo only when sponsor-blocking AND the trade-off wants extended, multi-turn deliberation** — and when you do, leave a pointer back here so the thread can't get lost. Resolved ones move down to `## Log & Decisions`.*

## Log & Decisions

*Append-only, dated, newest first. Record what's been settled and why (read this before re-litigating a closed choice) AND the approaches already tried and rejected — a failed fix is a finding: note what was attempted and why it didn't hold, so no one re-treads it. Promote project-wide decisions up to `pm/DECISIONS.md`.*
