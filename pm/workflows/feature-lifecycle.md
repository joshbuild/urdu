# Workflow — Feature Lifecycle
*v0.1 | 2026-06-18*

> **Read this when** you are *opening* a feature for build (flipping its status to building) or *closing* a finished one (status flip, archive, tombstone). It is the step-by-step procedure behind the ambient practices in `AGENTS.md` § Trunk-based Development — that section tells you the *hazards* to keep in mind every session; this doc tells you the *moves* to make at the two lifecycle moments.
>
> Tool-neutral — applies to any agent (Claude Code, Codex) and to humans. Lives in `pm/workflows/` alongside future workflow docs (release, hotfix, …). *(The project-local `pm-*` skills — `pm-open`/`pm-close` for the lifecycle moments, `pm-resume`/`pm-wrap` for the session rhythm — wrap this doc rather than duplicating it: they cite the steps here, they don't restate them. The generic predecessor PM skills are **not used in this project**.)*
>
> **This project is trunk-based — all work commits directly to `main`.** The branch/worktree/PR machinery is a rare escape hatch (§Escape hatch + `git-feature-closeout.md`), not the default path.

---

## 1. Git policy — commit directly to `main`

Trunk-based. There is no per-feature branch by default.

- **All work lands on `main`.** Features, issues, fixes, doc edits — commit straight to the trunk. The commit is the rollback unit and the review surface, so keep each one **small, atomic, well-described, and coherent** (it leaves the tree working) — but **commit often**: a feature is built as a *sequence* of small commits on `main`, each landed as its coherent step finishes, not a branch merged at the end and not one big commit at session's end. Verification scales with risk (§ next bullet) — a routine small change doesn't gate on a full build/test cycle, so "not fully verified yet" is never a reason to batch up uncommitted work.
- **Why no branches.** At this team size (the sponsor + one agent, working serially on a solo trunk) a feature branch bought a clean rollback boundary and a PR but cost recurring merge-conflict friction: the global pm docs (`STATUS.md`, `PLAN.md`, `DECISIONS.md`, `TODO.md`) churn constantly, so every branch had to merge `main` back in and resolve conflicts that serial work on `main` never generates. The boundary wasn't worth the friction.
- **The discipline that replaces the branch boundary.** Without a branch as the rollback line, *the commit is*. So: one logical change per commit; descriptive messages (what + why); don't commit broken intermediate states to the shared trunk; verify (build/tests/smoke as applicable) before committing anything risky. If you want a clean point to revert to, make a commit there.
- **Path-scope every commit to what this session touched.** Stage explicit paths, or commit with an explicit pathspec (`git commit -m "…" -- <path>…`); **never** `git add -A` / `git add .` / `git commit -am` when `git status` shows files you don't recognise from this session (the session-start git snapshot is your baseline for "mine"). **Why:** on a shared `main`, a blanket add sweeps any *other* in-flight work in the tree — including a concurrent agent's staged-but-uncommitted changes — into your commit, mis-attributing it and decoupling its narration from its code. **Benign exception:** the shared PM logs (`STATUS` / `SESSIONS` / `DECISIONS` / `CHANGELOG` / `TODO`) are co-edited by every session and merge clean (prepend + semantic line breaks) — don't surgically exclude them; the rule that matters is *don't sweep up another session's code or work-item files.* This path-scoping **is** the discipline that makes shared-`main` concurrency tolerable (§Escape hatch) — each agent commits only its own touched files, so disjoint work never collides at commit time.

## 2. Planning lands on `main` like everything else

Feature/issue micro-project docs are **planning artifacts, not branch artifacts**. A feature doc (`pm/features/f##-<slug>.md`) is just more commits on `main` — write it, commit it, build against it, all on the trunk. The old "base-branch rule" (keep a plan reachable from its build branch; never strand it on a sibling) is **moot now** — there are no sibling branches to strand it on. Everything is on `main`.

## 2.5 Issues and mini-plans follow the same ritual

This doc is written feature-first, but **issues and mini-plans use the same open/close/archive moves** — only the roster and home folder differ:

| Type | Doc | Roster | Archive folder |
|---|---|---|---|
| Feature | `pm/features/f##-<slug>.md` | `pm/PLAN.md` Features Index | `pm/features/archive/` |
| Issue | `pm/issues/i##-<slug>.md` | `pm/issues.md` | `pm/issues/archive/` |
| **Mini-plan** | `pm/mini-plans/mp##-<slug>.md` | `pm/mini-plans.md` | `pm/mini-plans/archive/` |

> **The handle leads every work-item filename — mandatory, no un-prefixed form** (`pm/pm-glossary.md` §4). **Assign the handle first, then name the file:** take the next number from the roster *before* you copy the template or type a path. A slug chosen before a handle is the one that gets written without one. Width is natural, two-digit minimum (`f01` … `mp108`); existing handles are never re-padded.

**Opening a mini-plan:** assign the next `mp##` handle from `pm/mini-plans.md` **first**, then copy `pm/templates/mini-plan-{xyz}-template.md` → `pm/mini-plans/mp##-<slug>.md`, add the roster row (status mirrors the doc badge), and — for in-flight work — list it under `STATUS.md` `## Open Workfronts`. A mini-plan is the right container for **N bundled tasks worth sequencing with no single vision** (vs a feature, which owns one); see `pm/pm-glossary.md` §1.

**Closing a mini-plan:** flip the doc badge → 🟢 DONE, update the `pm/mini-plans.md` row (move it to the Archived table), `git mv` the doc to `pm/mini-plans/archive/mp##-<slug>-archive.md` (the `-archive` suffix per the AGENTS.md archive-in-place convention), repoint any references, and remove the STATUS workfront. Mini-plans tied to a feature/issue may forgo a full as-shipped tombstone — a one-line "done; folded into `<feature>`" digest at the top suffices. Promote anything cross-cutting to `pm/DECISIONS.md` / `pm/TODO.md`.

## 3. Opening a feature

Default ritual: **no branch cut.** Run these in order when a feature graduates from planning to build.

1. **Gate check — confirm it's actually cleared to build.** Read the feature doc's Status line and §Next Steps:
   - Is any **build-order deferral** still in force? (A feature can be "planning in parallel" while its *build* is deferred behind another track.) If so, the deferral must be lifted (sponsor call) before you start building.
   - Are the feature's own **phase gates** satisfied? (e.g. spikes/decisions a phase says "must close before Phase N opens.") The first buildable phase is whatever those gates allow — don't open a gated phase.
2. **Confirm the feature doc exists and is current on `main`.** `git cat-file -e HEAD:pm/features/f##-<slug>.md`. If you're *creating* it fresh, copy the template (see the note below) and commit it to `main` first.
3. **Flip status to building.** Update, in the feature doc: the **Status line** (→ 🟡 IN PROGRESS with the now-open phase) and **§Next Steps** (the immediate next action). Update the corresponding row in the **Features index** (`pm/PLAN.md`) or the **Issues index** (`pm/issues.md`): Status + Phase column → the open phase. In `STATUS.md`, list the workfront under `## Open Workfronts` for as long as it's actively being worked. Feature-local detail stays in the feature doc; the index row and the STATUS pointer are one-liners.
4. **Begin** the first cleared phase — committing increments directly to `main`.

> If you're *creating* the feature doc fresh (not opening one that was already planned): **assign the next `f##` handle from `pm/PLAN.md`'s Features index first**, then copy `pm/templates/feature-{xyz}-template.md` → `pm/features/f##-<slug>.md` (handle-first, then slug; the `features/` directory already encodes the type, so drop the `feature-` and `-template` infixes — the issue and mini-plan sides are identical: `i##-<slug>.md`, `mp##-<slug>.md`). Register the new doc as a row in the Features index (use `pm/issues.md` for a new issue). **There is no un-prefixed form** — see `pm/pm-glossary.md` §4.

## 4. Push within the session

Push `main` to its remote before `pm-wrap`. Sessions can end abruptly (context limit, crashed terminal, machine swap); a local-only commit is one disk failure away from gone. `git push` (the trunk tracks `origin/main`). When switching machines, `git pull` / `git push` explicitly at both ends (CLAUDE.local.md cross-machine note).

## 5. Closing a feature

When the feature is shipped and verified (its feature-doc "Done When" gate is met):

1. **It's already on `main`.** No merge step — the final increment was committed straight to the trunk. Just make sure everything is committed and pushed.
2. **Flip status to shipped; archive the doc in place.** Feature doc Status line → 🟢 SHIPPED (dated). Update the row in `pm/PLAN.md` (Features index) or `pm/issues.md` (Issues index) → shipped/closed, and **remove** the workfront from `STATUS.md`'s `## Open Workfronts` list. **Shipped feature docs land in `pm/features/archive/`** — rename with the `-archive` suffix and move into the local `archive/` folder per the AGENTS.md archiving convention, then repoint any docs that referenced the old path. Don't delete it. **Tombstone the top** with a concise *as-shipped* digest — status, what shipped, and pointers to the authority docs (`#todo` list this project's authority docs / `DECISIONS.md` / the code) where the live truth now lives. The phased execution journal stays below the fold, unmaintained, as the archaeological record.
3. **Tombstone the research memos this work consumed.** A feeder `pm/research/` memo (cited from this doc's Companions / Inputs) is a **point-in-time survey** — the moment the code it described ships, its "as-built / today" sections rot. On close, archive each consumed memo (`pm/research/archive/`, `-archive` suffix) with a tombstone pointing at the as-built + `DECISIONS.md`, and repoint its citations — **unless** it holds durable design rationale still cited elsewhere (then leave it live).
4. **Promote anything cross-cutting** that hasn't already graduated: project-wide decisions → `pm/DECISIONS.md`; still-open backlog → `pm/TODO.md`. The feature doc owned the feature; the global docs own the project.

## 6. Quick reference

```
# Open (trunk-based — no branch)
git cat-file -e HEAD:pm/features/f##-<slug>.md       # plan is committed on main? (handle-first name)
#   then: flip feature-doc Status + §Next Steps, and STATUS.md workfront row
#   then: build, committing increments directly to main

# Each increment — path-scope to THIS session's files (§1); never blanket `git add -A`
git commit -m "<slug>: <small atomic change>" -- <path>…   # or: git add <path>… && git commit -m "…"
git push                                              # keep the trunk current

# Close: flip Status → 🟢 SHIPPED, archive+tombstone the feature doc,
#        update index row, remove STATUS workfront, promote cross-cutting bits
```

## 7. Session wrap / resume — the journal ritual

*Distinct from the feature open/close moves above: this is the **per-session** rhythm. The hub (`STATUS.md`) orients; each front's sibling `*-journal.md` carries the narration; `pm/SESSIONS.md` is the rolling cross-front index. Full worldview: `pm-approach.md` §1.5; vocabulary: `pm/pm-glossary.md` §3.*

**Resume (start of session):**
1. Read the **hub** — `STATUS.md` `## Open Workfronts` + `## Next Session Pointers`.
2. Skim **`pm/SESSIONS.md`** (last ~20) for what just happened across fronts.
3. Open the **journal(s)** of the front(s) you're picking up (`<dir>/<handle>-<slug>-journal.md`) — the verbose detail lives there, not in the hub.

**Wrap (end of session):**
1. **Write the touched front's journal** — prepend the session line (what landed, tests/build state, doc ripple) and refresh its "Current state" header. A front with no journal yet gets one created lazily (per `pm/pm-glossary.md` §5.2) when it next carries real narration.
2. **Prepend one terse line to `pm/SESSIONS.md`** (date/label — front — one-line → journal pointer) and **trim the tail** past ~20.
3. **Update the hub only if** a status badge changed or a next-action shifted — keep this edit minimal; it's the contended write surface.
4. **Promote** cross-cutting decisions → `DECISIONS.md`; user-facing changes → `CHANGELOG.md` `[Unreleased]` (root, Keep-a-Changelog — user-facing only); still-open backlog → `TODO.md`.
   - **The DECISIONS-body split (enforce at write time, not paid back later).** A `DECISIONS.md` Log body carries **only**: the decision, its rationale, the rejected alternatives, the `DT / 🎩💈🪦` trailer, and the sanctioned `Ripples:` trailer (the touched files — per the file header). It **must not** carry the session's *execution narration* — test/build-green tails, `file:line` catalogues, byte-counts, or status words (`not yet wired` / `owed` / pending). **That detail is the journal's job (step 1).** Rule of thumb: if a sentence would read as *false or stale* once the next session lands, it belongs in the journal, not the decision body. *(This is the write-time half of `pm-clean` check 1, which only catches regrowth after the fact — don't regrow it.)*
   - **Body length scales with reversibility — the `🎩💈🪦` class *is* the budget.** The cost of reversing a decision sets how much rationale must endure, so the reversibility class caps the body length: a **🎩 hat** (cheap to reverse — most surface/cosmetic/tuning tweaks) gets **1–2 sentences** (the decision + the one-line *why*; skip the Rejected paragraph unless a rejection is itself a reusable lesson); a **💈 haircut** (grows back) gets **a short paragraph** (decision · rationale · the key rejected alternative); a **🪦 tattoo** (permanent — schema/identifier freezes, durable doctrine) earns the **full treatment** (decision · rationale · *all* rejected alternatives), because the reasoning has to outlive everyone who remembers it. The failure mode this fixes is a long defence of a trivially-revertable hat: if it's a 🎩, the commit + journal hold the detail — the decision body is a one-liner. *(A 🎩 body running past ~3 sentences is the smell `pm-clean` check 1 also looks for.)*
5. **(Opt-in — `--improve` only)** Self-improve capture per the shared lens `pm/workflows/self-improve.md`: scan the journal + decisions just written for friction a rule could prevent, and append evidence-grounded line(s) to `pm/improvement/improve-log.md`. Default off — plain wraps skip this entirely.
6. **Stage + commit** (and push — see §4).

> The `pm-*` skills (`pm-resume` / `pm-wrap`) **encode** this ritual — reach for them rather than running it by hand. They cite this section; they don't replace it, so this remains the canonical procedure when you need the detail or are running it manually.

### Doc-update timing — which doc class updates *when*

"Update docs as we go" spans three classes with three different correct moments. Collapsing them all into the wrap (or the close) is the trap — by wrap, the trunk has already carried commits whose docs disagree with their code.

| Doc class | Examples | Updates *when* |
|---|---|---|
| **Authority / spec** (+ its ripple surfaces) | this project's authority/spec docs (`#todo` — schema-source, UI/control, persisted-state, project glossary), plus their keep-in-sync ripple targets including any **downstream user-facing copy** surfaces (`#todo` — tooltip/help strings, user manual) | **Edit-first, in the *same atomic commit* as the code change.** Owner doc first, then ripple (`pm-approach.md` §3.2). On a trunk where the commit is the rollback/review unit, deferring these leaves an internally-inconsistent commit on shared `main`. |
| **Decisions / changelog** | `DECISIONS.md` (material/cross-cutting), `CHANGELOG.md [Unreleased]` (user-facing) | **When the decision is made / the change lands.** Wrap step 4 *promotes/catches* these — it should not be the first time they're written. |
| **Narration / handoff** | the front's `*-journal.md`, `SESSIONS.md`, the `STATUS.md` hub (only if a badge/next-action changed) | **At `pm-wrap`** — these *are* the wrap's job (steps 1–3 above). |

Retirement (roster badge flip + archive) is a fourth moment, owned by **`pm-close`** — only when the work item is actually finished (gate-check → flip+date → tombstone → `git mv` to `archive/`). The failure mode this table guards against: hoarding spec edits for wrap.

## Escape hatch — when a branch *is* warranted

Branches and worktrees still exist for the rare cases trunk-based doesn't serve:

- **Isolated rollback boundary for high-risk work.** A change big and risky enough that you want a clean line to abandon wholesale, or a real PR review before it touches `main`. Cut `git switch -c feat/<slug>`, build, then integrate via `git-feature-closeout.md` (PR or direct-FF) and tear the branch down.
- **Genuinely concurrent multi-agent runs.** Two agents working *simultaneously* on different scopes: **prefer keeping both on `main` with non-overlapping work scoping.** The pm-doc separation (per-front journals + the thin hub) plus disjoint *code* scopes plus the **path-scoped-commit discipline (§1)** make this tolerable — the marginal merge "wildness" is cheaper to negotiate *early* (small, in-flight, while you still hold the context) than a worktree is to untangle *late*. If you want a clean rollback boundary, cut a **branch** (`git switch -c feat/<slug>`) in the main checkout. **Worktrees are a genuine last resort** — `git worktree add ../<repo>-<slug> -b feat/<slug> main` (each needs its own build-output dir and its own dependency install in the new tree; tear down with `git worktree remove`, see `git-feature-closeout.md` § Path C) — reach for one only when simultaneous *builds* truly can't share a tree. Hard-won: parallel worktree work has repeatedly cost more to untangle than it saved.

In all cases the same close-out doc moves from §5 apply once the work lands. The git command moves (in-session push, PR vs direct-FF, post-merge teardown) live in **`git-feature-closeout.md`**. **When in doubt, stay on `main`** — the escape hatch is for the exception, not the norm, and the *worktree* corner of it is the rarest exception of all.

## 8. The `pm-clean` alignment check-list

*The periodic PM-doc alignment audit (run when drift is suspected, or on demand).
Each check below is **mechanically runnable** — a grep or a single-doc visual scan — so the **`pm-clean`** skill can encode this list verbatim as its body.
Propose fixes; don't over-automate destructive edits. Companion to the system-map spine check in `AGENTS.md` §Doc architecture → Maintenance (that one guards the authority catalogue + the as-built spine; this one guards the work-item / hub / journal / identifier regime) — the `pm-clean` skill encodes **both**.*

**Decision log:**
1. **No build-narration regrown in `DECISIONS.md` bodies** — spot-check the newest ~10 Log bodies for test counts / "not yet wired" / file lists; that detail belongs in the workfront journal, not the decision body. *(grep `green\|not yet wired\|tests` across recent bodies.)*
2. **Every ADR is catalogued and back-links an Index row** — each `pm/adr/NNNN-*.md` appears in the `AGENTS.md` authority catalogue, and its `DECISIONS.md` Index row carries `→ pm/adr/NNNN-slug`. *(cross-check `pm/adr/` ↔ `DECISIONS.md` Index ↔ `AGENTS.md`.)*
3. **The dated Index never has a hole** — every `DECISIONS.md <date>` citation greppable repo-wide resolves to an Index row (the load-bearing invariant). *(grep `DECISIONS\.md\s+20\d\d-\d\d-\d\d[a-z]?` → confirm each date is an Index row.)* **This invariant is what makes the check-13 rollover safe** — the Index rows stay live even after the bodies move, so citations keep resolving.

**Work-item regime:**
4. **Every mini-plan has a `pm/mini-plans.md` row** — no live `pm/mini-plans/mp*.md` (non-archive) without a roster row + `mp##` handle; likewise features ↔ PLAN Features index, issues ↔ `issues.md`.
5. **The three work-item templates haven't structurally diverged from the shared spine** — `feature-{xyz}` / `issue-{xyz}` / `mini-plan-{xyz}` templates each still carry the shared-spine sections (`pm-glossary.md` §5) **and** their type-specific sections (feature `Vision`/`Scope` · issue `Symptom`/`Diagnosis` · mini-plan `Stages`/`Slices`). Spine present in all three; type-specific present where expected; no forced section-name uniformity.
6. **Doc-local identifiers don't leak unqualified** — a `C1`/`F5`/`R3`-style label invented in one doc is either scoped to it or qualified at the cross-reference with the owning front's handle (`f08 F5`). *(scan for bare capital-letter+digit tokens in STATUS / SESSIONS / rosters.)*
7. **No bare feature-internal `Phase N` in a newly-authored or just-touched doc** — should be `Stage N` (`pm-glossary.md` §2 K1). **Forward-only**: historical "Phase N" in untouched docs is expected and is *not* a finding (the lazy-migration rule §5.2 + honesty line (c)); flag only docs edited this cycle. PLAN's global-roadmap Phases are never a finding.

**Hub / journals:**
8. **`STATUS.md` holds no session narration and no embedded sessions log** — only `## Open Workfronts` (one line per front) + `## Next Session Pointers` + an "as of" stamp. *(visual scan: no `## Done This Session`, no lead-paragraph narration, no `Recent sessions ledger`.)*
9. **`pm/SESSIONS.md` is ≤ ~20 lines of session entries** — older lines rolled off to the per-front journals + git; the header roll-off note is present.
10. **Every in-flight front has a sibling `*-journal.md`** — each front listed in STATUS `## Open Workfronts` has a `<dir>/<handle>-<slug>-journal.md` carrying its narration. Winding-down / lazily-migrated fronts are exempt until next substantively touched (§5.2).

**Skills suite:**
11. **The `pm-*` suite hasn't drifted from the documented rituals** — `.claude/skills/pm-resume` / `pm-wrap` match §7; `pm-open` / `pm-close` match §2/§2.5/§5; `pm-clean` encodes *this* list; `pm-triage` / `pm-release` match their referenced rituals. Each `SKILL.md` still **cites** the regime docs rather than duplicating them (terse-and-cite, not fork-and-drift).

**Consumed research memos:**
12. **No live `pm/research/` memo whose consuming work item has already shipped** — a memo cited from an *archived* feature/issue/mini-plan doc (its Companions/Inputs) should itself be archived (`pm/research/archive/`, tombstoned), unless it carries durable design rationale still cited from a live doc. *(cross-check: for each `pm/research/*.md` not in `archive/`, grep its filename repo-wide — if the only citers are archived work-item docs, it's a tombstone candidate.)* **Propose, don't auto-move** — a memo may legitimately outlive its feature as standing rationale. (The close-ritual companion to §5 step 3.)

**Decision log, continued:**
13. **The live `DECISIONS.md` Log isn't overdue for a month-rollover** — when the live Log's oldest *body* is more than **~2 full months** behind the newest (or the file exceeds **~500 KB / ~120 live bodies**), **propose** rolling the oldest whole month(s) of bodies into `pm/archive/DECISIONS-YYYY-MM-archive.md`, keeping every Index row live in `DECISIONS.md` under an archived-bodies banner so citations keep resolving (check 3). Always **propose, never auto-apply** — it's a large, citation-sensitive move; verify the split is lossless against `HEAD` before committing. *(grep the live Log for its oldest `^20\d\d-\d\d` date; `wc -c pm/DECISIONS.md`.)* Because entries are newest-first, the oldest month is a **contiguous tail block** of the Log, so the move is a single tail-split → write the dated archive → extend the archived-bodies banner prose by hand.

**Handle-prefix integrity:**
14. **Every live work-item file leads with its handle** — no non-archive file under `pm/features/`, `pm/issues/`, or `pm/mini-plans/` whose name fails to start with `f`/`i`/`mp` + digits + `-`. This catches the legacy pre-reform names (`feature-<slug>.md`, `issue-<slug>.md`, `mini-plan-<slug>.md`) and the plain-slug form, both of which an agent produces by naming the file before assigning the handle (`pm-glossary.md` §4). Journals count too — a live `<handle>-<slug>.md` with a sibling `<slug>-journal.md` is a finding. *(For each of the three dirs: list non-`archive/` `*.md` and flag any not matching `^(f|i|mp)[0-9]+-`.)*
   **Scoped to live files only — never flag anything under an `archive/` folder or carrying the `-archive` suffix.** Historical names are a faithful record of what files were called then; renaming them would falsify it. The fix for a live finding is `git mv` to the handle-first name (the handle comes from the roster row, which already has it) + repoint inbound refs; **propose, don't auto-apply** — a rename ripples through rosters, hub, journals, and cross-doc citations.
