# Workflow — pm-clean (PM Hygiene Pass)
*v0.1 | 2026-06-18*

> **Read this when** the pm docs have drifted, bloated, or accumulated superseded material and you want to bring them back into alignment. This is the structure-aware successor to the base PM-clean check — the base model only knows the seven base docs and a flat `pm/`; this repo has the authority catalogue, the per-feature/issue micro-projects, the system map, the off-taxonomy buckets (`mini-plans/`, `research/`, `improvement/`), and the trunk-based archive convention. Use the base PM-clean *disciplines*; apply them to *our* structure.
>
> Tool-neutral. Lives in `pm/workflows/` beside `feature-lifecycle.md` and `pm-approach.md`. Read **`pm-approach.md`** first for the worldview this enforces; this doc is the recurring maintenance ritual.
>
> **Two granularities, one name.** This doc is the **deep periodic pass** — the full Ground → Align → Dross → Densify → Gate → Report sweep, including the structure-aware checks (catalogue, index↔doc↔archive, system-map, off-taxonomy buckets, naming drift, keep-in-sync) that the regime scan doesn't carry. The **fast scan** is the 14-check work-item / handle-prefix / hub / journal / identifier / decision-log / skills drift list at **`feature-lifecycle.md` §8**, which the `pm-clean` *skill* (`.claude/skills/pm-clean/`) runs verbatim. They are **complementary, not duplicative**: invoke the skill for a quick drift check; read *this* doc for a thorough hygiene session. Phase 1 below references §8 for the regime checks rather than restating them (cite-don't-duplicate).

The pass has **three jobs** and ends with **one report**:

1. **Alignment** — mutual consistency across pm docs, the authority catalogue, the indices, and the system map.
2. **Dross** — archive or delete superseded / shipped / orphaned material per the trunk-based archive convention.
3. **Densify** — tighten repetitive or fluffy prose. **Prefer concision over grammar.** A terse fragment that carries the fact beats a well-formed sentence that buries it.

> **Read-then-propose, then gate.** The base model's core rule holds: surface findings before editing. But this is a longer pass over more docs, so batch the findings into the Phase 5 report, auto-apply the **low-risk** classes, and gate the rest. Don't silently rewrite docs the sponsor reviews session-to-session.

---

## Guardrails — read before touching anything

These are the load-bearing invariants. Violating one is worse than leaving drift in place.

- **DECISIONS.md is append/prepend-only.** Never edit a prior entry. A wrong past decision is corrected by a *new* dated entry, proposed for sponsor sign-off — never by rewriting history.
- **Edit the authority-doc owner first, then ripple.** Never densify normative content out of an authority doc (catalogued in `AGENTS.md §Doc architecture`) to "save words." Their precision is the point. Trim *their* fluff (intros, dead examples), not their rules, IDs, ranges, or dates.
- **Never ripple into archival/frozen files.** Anything under an `archive/` folder, and any `-archive` tombstone's below-the-fold journal, are frozen. Don't churn renames or densification into them.
- **Archive in place.** Superseded file → `-archive` suffix → local `archive/` folder *beside* it, never relocated across the tree (AGENTS.md convention). Repoint inbound refs to the new path.
- **Tombstone shipped feature/issue docs; don't delete them.** A short *as-shipped* digest at the top (status · what shipped · pointers to where live truth now lives); the phased journal stays below the fold (`feature-lifecycle.md §5`).
- **Deletion is reserved for true dross** — exact duplicates, throwaway scratch, content that exists verbatim elsewhere. Everything with archaeological value is archived, not deleted. Deletion is always gated (Phase 4).
- **Preserve dates, IDs, commit hashes, status badges, and `→ see` cross-refs verbatim** when moving or densifying. Moves are faithful relocations, not rewrites.

---

## Phase 0 — Ground

1. **Read the spine.** The thin hub `STATUS.md` + its pair `SESSIONS.md`, `TODO.md`, `DECISIONS.md` (recent ~10 + header), the three rosters — `PLAN.md` (Features index), `issues.md` (Issues index), `mini-plans.md` (Mini-plans index) — `VISION.md`, `PRD.md`, and `pm-glossary.md` (the process-vocabulary authority the regime checks lean on).
2. **Read the structure-aware extras** the base model ignores: `AGENTS.md §Doc architecture` (authority catalogue), the system-map doc (`#todo` — if the project has one), `pm/adr/` (the ADR track), and the index of `pm/features/`, `pm/issues/`, `pm/mini-plans/`, `pm/research/`, `pm/improvement/`. Don't deep-read every micro-project doc — read its **Status badge + top banner** (and, for in-flight fronts, glance at its sibling `*-journal.md`), and open the body only when a finding points there.
3. **Ground against reality.** `git log --oneline -25` to check "what actually shipped" against what the docs claim. Spot-check file existence for any path a doc references.

Capture findings as you go: `{file(s), what's wrong, proposed fix, risk class}`. Don't fix yet.

---

## Phase 1 — Alignment & mutual consistency

The base alignment checks (A–I) still apply to the seven base docs — run them. Below are the **structure-aware extensions** that the base model doesn't know about. Run all sets.

> **Plus the §8 regime scan.** The 14 work-item / handle-prefix / hub / journal / identifier / decision-log / skills / research checks at **`feature-lifecycle.md` §8** (the `pm-clean` skill's body) cover the regime: no build-narration regrown in DECISIONS bodies · ADRs catalogued + back-linking an Index row · the dated Index has no hole · every live work-item doc has a roster row · the three templates haven't diverged from the shared spine · doc-local identifiers don't leak unqualified · no bare feature-internal `Phase N` in a just-touched doc · STATUS holds no session narration · `SESSIONS.md` ≤ ~20 lines · every in-flight front has a journal · the `pm-*` suite hasn't drifted · the live `DECISIONS.md` Log isn't overdue for a month-rollover · no live `pm/research/` memo whose consuming work item has shipped · **every live work-item file and journal leads with its handle** (check 14). **Run that list here too** (or invoke the skill); the extensions J–P below add only the structure-aware checks §8 doesn't carry. Don't restate §8 — read it.

### Base checks (from the base PM-clean checks, condensed)
- **Scope violations** — backlog in STATUS → TODO; open questions in TODO → the owning work-item doc's §Open Questions; session-status in PRD/PLAN/VISION → flag.
- **Staleness** — STATUS `Updated` older than git head; TODO Immediate items >2wk with no commits.
- **Already-done still listed** — TODO / STATUS pointers naming work that git or the repo shows shipped.
- **Decision drift** — recent DECISIONS contradicted by PRD/PLAN/VISION (the stable doc updates to match the decision, or flag).
- **Orphan refs** — dead `§` section refs, missing file paths, stale `*Next: N*`.
- **Duplicates** — same task in two TODO tiers; TODO restating a work-item §Open Question; re-decided DECISIONS.
- **PLAN markers** — one `[~]` per stage; `[x]` matches shipped reality; `[ ]` despite evident completion.
- **Status-tag integrity** — every TODO backlog item in exactly one state-machine tag; **`#agent-implement` mis-tags are highest severity, list first**; stale greenlights (>3 sessions unconsumed); Inbox items carrying post-triage tags.

### Structure-aware extension checks

**J. Authority-catalogue integrity + root byte-budget** (`AGENTS.md §Doc architecture`)
- Every SSOT doc on disk appears as a catalogue row; every catalogue row points to a real file.
- The version/stamp cell matches the doc's actual stamp (header version, schema version, any generated counts).
- "Defers to / wins over" relationships are still coherent (no two docs each claiming to win the same domain).
- **Root byte-budget:** the root agent doc (`AGENTS.md`) stays under the agent tool's context-truncation wall, so its safety-critical rules always load. Concretely, keep `AGENTS.md` **< 32 KiB** — the default truncation limit for at least one common CLI agent (Codex's `project_doc_max_bytes`; target **≤ 24 KiB** for headroom) — **and keep the cross-tool safety rules (git path-scoping, decision-routing) within the first 32768 bytes**. *(`wc -c AGENTS.md`; `head -c 32768 AGENTS.md | grep` the safety lines.)* Every Conventions block relocated out of the root still resolves to a named on-demand home.

**K. Index ↔ doc ↔ archive consistency** (the three rosters — PLAN Features index · `issues.md` Issues index · `mini-plans.md` Mini-plans index)
- Every index row points at an existing doc; every doc under `features/`, `issues/` & `mini-plans/` (live, not `archive/`) has a row in its roster.
- **Status badge rollup matches**: the badge in the roster row == the badge in the doc's top banner == the STATUS `## Open Workfronts` line (if present). Reconcile to the doc — the doc badge is canonical; roster + hub *mirror* it and may lag (`pm-glossary.md` §6 honesty line (a)).
- A doc badged 🟢 SHIPPED / closed but still sitting *outside* `archive/` → flag for archival+tombstone (Phase 2). A doc in `archive/` still cited as live anywhere → flag.

**L. Hub ↔ sessions log ↔ journals** (the post-refresh shape — STATUS is a *thin hub*, not a journal)
- Every Open Workfront row points to a live (non-archived) doc and reflects work *actually in flight*. A workfront whose doc is shipped/closed → remove the row. A live feature being actively built with no workfront row → add one.
- **Session narration *in STATUS* is itself the finding.** The hub holds only `## Open Workfronts` + `## Next Session Pointers` + an "as of" stamp. Any lead-paragraph narrative, a `## Done This Session`, or an embedded `Recent sessions ledger` regrowing in STATUS → flag: that content belongs in the front's sibling `*-journal.md` (verbose) and `SESSIONS.md` (the one-line cross-front index). There should be no lead to densify.
- **`SESSIONS.md` ≤ ~20 session lines** with its header roll-off note present; older lines should have rolled off to the journals + git. An overgrown `SESSIONS.md` → trim the tail (Phase 3).
- **Every in-flight front has a sibling `*-journal.md`** carrying its narration; a winding-down / lazily-migrated front is exempt until next substantively touched (§5.2). *(This trio mirrors `feature-lifecycle.md` §8 checks 8–10 — run them once.)*

**M. System-map integrity** (`#todo` — only if the project has a `pm/architecture/system-map.md` or equivalent) — the AGENTS.md `pm-clean` system-map/catalogue check, propose-don't-automate:
- Every ✅/🟡-built subsystem has a **non-empty As-built cell**.
- **No ⛔ (not-built) row points to a doc file** — not-yet-built subsystems are map rows only, never aspirational as-built docs.
- Status/risk cells match the owning feature/issue doc's reality.

**N. Naming drift** (the project's naming authority is the authority — `#todo`)
- Forbidden aliases appearing as live terms anywhere in pm/ → flag (the naming authority wins; ripple the rename).
- A term renamed in the naming authority but not rippled to its dependent surfaces → flag the un-rippled surfaces.

**O. Off-taxonomy buckets** (`mini-plans/`, `research/`, `improvement/`, and any cross-project learnings doc)
These exist outside the base model and outside the features/issues split, so they accrete silently. For each:
- **`mini-plans/`** — mini-plans are **first-class** now (`mp##`, their own `mini-plans.md` roster, the `feature-lifecycle.md` §2.5 open/close ritual) — a vision-less execution container, *not* necessarily scratch for one feature. A mini-plan badged 🟢 DONE / BUILT with its work shipped is dross: close it per §2.5 (flip the badge, move the roster row to Archived, `git mv` to `mini-plans/archive/` with `-archive` suffix, drop its STATUS workfront) and confirm its outcomes landed in the owning feature/issue doc + DECISIONS first.
- **`research/`** — research whose question is closed (decision logged, feature built) → archive. Keep only open/feeding-active-work research live.
- **`improvement/` and any cross-project learnings doc** — mixed. Durable learnings docs: **leave live**, flag only if a learning is superseded or contradicts current code. But **`improvement/improve-log.md` is the self-improve *capture* log — actively *consolidate* it, don't just leave it** (check Q below); a growing improve-log that's never swept is itself the finding.
- Flag any of these referenced from nowhere (orphaned) **or** referencing a path that no longer exists.

**P. Keep-in-sync ripple spot-check** (light — deep schema reconciliation is its own task)
- If the project's schema source (`#todo` — e.g. a generated-params or config-schema file) changed recently (git), confirm its dependent surfaces (any generated counts/asserts, metadata tables, naming-authority forbidden-aliases) kept pace. Flag gaps; don't attempt the full regen here.

**Q. Improve-log consolidation** (`pm/improvement/improve-log.md` — the self-improve loop; lens = `pm/workflows/self-improve.md`)
This is the loop's Tier-2 **promotion** half (capture is wired into `/pm-stress-test` + `/pm-wrap --improve`; consolidation rides *this* deep pass). It is a judgement-bearing promotion action, **not** a greppable drift check — which is exactly why it lives here in the deep sweep and not in the `feature-lifecycle.md §8` fast scan. Skip cleanly if the project has no improve-log. Over the live log:
- **Dedup** near-duplicate lines (same `[area]` + same substance) into one, preserving the earliest date + every evidence anchor.
- **Apply the recurrence gate** — promote a line only when it has been captured **≥3×** (same area + substance) **or** is a single high-severity **tattoo-class** hazard (🪦: data-loss · schema/state corruption · a silently-shipping foot-gun). A 1×/2× routine line does **not** promote — it waits, or decays out.
- **Propose** each promotion, never silently apply — the candidate rule, its cited evidence, the **owner doc from the lens's routing table** (`self-improve.md §4b`: project tips doc · learnings doc · a `pm/workflows/*.md` or `AGENTS.md §Conventions` process doctrine · `pm/DECISIONS.md` reversal/new doctrine · **best of all → a test/lint/`pm-clean` check**, keeping the lesson out of prose), and the **specific line(s) it would prune** (every promotion is prune-paired — the fourth bar). Each proposal routes through Phase 4's gate as a guidance-doc edit.
- **Roll drained entries** (status `promoted` / `dismissed`) off to `pm/improvement/archive/improve-log-archive.md` (create the archive folder on first rollover) — a Phase-2 dross move that keeps the live log short by construction.
- **Decay, don't recency-bias** — weight by recency *and* relevance *and* reconfirmation; one fresh annoyance must not jump the gate.

---

## Phase 2 — Dross & supersession sweep

From the Phase-1 findings, assemble the **archive/delete** worklist. Apply the convention strictly:

- **Shipped feature/issue doc** → tombstone top + move to `features/archive/` or `issues/archive/` with `-archive` suffix; repoint inbound refs; flip its index row to closed/shipped; drop its STATUS workfront.
- **Completed mini-plan / closed research** → archive in place (`<bucket>/archive/`, `-archive` suffix); confirm outcomes captured in the owning doc/DECISIONS first.
- **Superseded standalone doc** → archive in place; repoint refs.
- **True duplicate / scratch** → propose deletion (gated).

Every move records its `from → to` for the report's move log. **Never archive something whose outcome hasn't landed in a durable doc** — archive is for *recorded* history, not for losing live facts.

---

## Phase 3 — Densification pass

Tighten repetitive or fluffy material. **Concision over grammar.** Targets, in priority order:

1. **`SESSIONS.md` tail-trim** — the rolling cross-front log's highest-yield maintenance: keep ≤ ~20 lines, roll the older ones off to the per-front journals + git. The hub `STATUS.md` is *already* thin — **don't re-bloat it**; if narration has crept back in, that's check L, not a densify target.
2. **Per-front journal accretion** — within a front's `*-journal.md`, collapse superseded prior-session narrative into terse one-line pointers (`session N: <one line> (commit)`); keep the "Current state" header + the latest session crisp. The verbose history below the fold is the archaeological record — trim repetition, don't gut it.
3. **Repetitive TODO / feature-doc prose** — fragments over sentences; drop hedging, throat-clearing, and re-explanation of things stated in the authority docs (link instead).
4. **Workflow/process-doc bloat** — redundant restatement across `workflows/` docs → keep the fact in its owner, replace the copy with a pointer.

**Off-limits for densification:** authority-doc normative content (rules, IDs, ranges, gestures, tokens), DECISIONS entries (append-only), and anything under `archive/`. When unsure whether a sentence is load-bearing, leave it and flag it for the report rather than cutting it.

---

## Phase 4 — Gate the risky classes

**Auto-apply (low-risk):** faithful moves/relocations, archiving-with-tombstone, orphan-ref fixes, badge-rollup reconciliation, STATUS/TODO/feature-doc densification, index↔doc↔STATUS sync.

**Gate for sponsor sign-off (one consolidated ask):**
- **Any deletion.**
- **Any edit to PRD / PLAN / VISION semantics** (not pointer/marker fixes — those are low-risk).
- **Any DECISIONS correction** (proposed as new dated entry text; never an in-place edit).
- **Authority-doc normative edits** (anything beyond trimming intro fluff).
- **Naming-drift ripples** that touch a control name or persisted ID (the naming authority owns the call).

Default offer: *"Apply all low-risk fixes — moves, archiving, orphan-ref + badge sync, densification; hold deletions, PRD/PLAN/VISION semantics, DECISIONS corrections, and authority-doc rule changes for your call?"*

---

## Phase 5 — Apply, then report

Apply the approved fixes faithfully (Phase 0 guardrails hold throughout). Then emit the report. **Two required parts:** an exec summary up front on the *notable* moves, and a complete-but-terse move listing at the end.

```
## pm-clean — YYYY-MM-DD

### Summary
<2–5 sentences: the most notable moves only — what changed shape, what got
archived, where the biggest densification landed, what's now gated on you.>

### Applied (N)
**Aligned**
- <file>: <one-line what> 
**Archived / moved**
- <from> → <to>
**Densified**
- <file>: <what collapsed> (~X lines → Y)
**Refs repointed**
- <file>: <old path> → <new path>

### Deferred — needs your call (N)
- <one-line ask> [delete | PRD/PLAN/VISION | DECISIONS correction | authority rule | naming]

### Clean (no findings)
- <checks that came back empty, comma-listed>
```

Keep both the Applied and Deferred listings **complete** — every move appears — but **terse** (one line each). The exec summary is for the sponsor scanning in five seconds; the listings are the audit trail.

---

## Phase 6 — Close

This is doc hygiene on `main` like everything else (trunk-based). Commit per the session convention — the wrap (`pm-wrap`) can carry it, or commit standalone as `pm(clean): <one-line summary>`. Don't bundle a clean with unrelated code changes; the move log *is* the commit's value.

---

## Quick reference

```
0  Ground      read spine (hub+SESSIONS, 3 rosters, glossary) + extras (adr/, journals) + git log; capture, don't fix
1  Align       base (A–I) + §8 regime scan (14) + structure-aware (J–P) + improve-log consolidation (Q)
2  Dross        archive/delete worklist; tombstone shipped, archive in place
3  Densify      SESSIONS tail-trim + journal accretion; hub stays thin; spare authority/archive
4  Gate         auto-apply low-risk; sponsor-gate delete/PRD/DECISIONS/rules/names
5  Apply+Report exec summary up front, complete-but-terse move log at end
6  Close        commit on main as pm(clean): <summary>
```
