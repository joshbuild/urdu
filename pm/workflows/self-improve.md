# self-improve — the shared fold-in lens

**File Purpose**: The one reusable reference for the self-improvement loop — the single lens that **captures** process/dev observations and **promotes** the recurring ones into a durable rule, without ballooning the docs.
Each host skill (`/pm-stress-test`, `/pm-wrap --improve`, `/pm-clean`) **cites** this file and adds only its one-line framing (cite-don't-duplicate — the house pattern). It is **not** a sub-skill (skills don't compose) and **not** duplicated prose.

> **One lens, two acts.** *Capture* (Tier 1) appends a terse, evidence-grounded line to [`pm/improvement/improve-log.md`](../improvement/improve-log.md) — cheap, ungated, fires at a task boundary. *Promotion* (Tier 2) happens later, in `pm-clean`'s deep sweep: dedup, decay, apply the recurrence gate, and **propose** the survivors into exactly one owner doc, paired with a prune. Most boundaries capture nothing and most sweeps promote nothing — the cost is near-zero until the loop actually fires.

---

## 1. Trigger — when the lens fires

**At a boundary or after a real miss, never every turn.** The three hosts are good triggers because each is already a boundary the agent stands at anyway; the §4 table gives each its framing. Outside those hosts, do not run this — continuous self-reflection is the bloat-and-confabulation failure mode the loop exists to avoid.

## 2. Capture format (Tier 1 — the append)

Append one line to `improve-log.md` in its documented format (`- YYYY-MM-DD · [area] · observation. **Ev:** <ref>. **St:** open`). Two rules:

- **Ground it in the incident.** Every line names the specific evidence (commit / file:line / session) that produced it. An ungrounded "we should probably…" is the catastrophic-error seed — evidence-grounded extraction works; open-ended self-diagnosis confabulates. No evidence → no line.
- **Capture is ungated.** A Tier-1 line is low-stakes staging; append it without ceremony. The propose-only posture (§5) governs *promotion*, not the append.

## 3. The four bars — what a fold-in must clear to earn its lines

A captured line is promoted into a guidance doc only if it clears **all four**:

1. **Recurring** — it passes the recurrence gate (§4a). A single incident stays a Tier-1 note.
2. **Not better enforced by a tool** — if a test / lint / generated check / `pm-clean` check can carry it, put it *there*, not in prose (§4b routing — "best of all"). Write the invariant as a check, not a paragraph.
3. **Non-contradicting** — scan for an existing rule it conflicts with; **flag the contradiction, never silently overwrite** (a self-contradicting instruction file collapses adherence).
4. **Paired with a prune** — when proposing an addition, find a stale/superseded line to retire. Net line count is *allowed to fall*; an add-only fold-in is broken. Keep additions terse (semantic-line-break, one clause/line).

## 4. Promotion mechanics (Tier 2 — runs inside the pm-clean deep sweep)

### 4a. The recurrence gate

Promote when **either**:
- **Rule of three** — the same observation (same `[area]` + same substance) has been captured **≥3×**; or
- **Single high-severity tattoo-class hazard** — one observation whose recurrence would be expensive/irreversible (a 🪦-class trap: data-loss, schema/state corruption, a foot-gun that silently ships). One incident is enough when the cost of waiting for three is too high.

A 1×/2× routine observation does **not** promote — it waits, or decays out.

### 4b. Promotion-target routing — where a promoted lesson lands

One fact, one place (edit the owner doc first — the house discipline). Route by lesson class:

| Lesson class | Lands in |
|---|---|
| Shallow implementation gotcha (framework / build / tooling) | the project's own tips/notes doc under `docs/`, if it keeps one |
| Durable engineering pattern (reusable across fronts) | a project learnings doc (create one only when the third entry demands it) |
| Process / PM doctrine (how we work) | the relevant `pm/workflows/*.md` (decision-guide, feature-lifecycle, pm-clean…) **or** `AGENTS.md §Conventions` |
| A reversal or new project-wide doctrine | `pm/DECISIONS.md` (body length scaling with 🎩/💈/🪦) |
| **Best of all → an enforceable invariant** | a **test / lint / generated check / `pm-clean` check** — keep the lesson *out* of prose entirely |

The last row is preferred whenever the lesson *can* be mechanized: a drift-guard test plus a one-line comment beats a paragraph of guidance prose.

### 4c. Decay & archive

The sweep also decays: weight by recency **and** relevance **and** reconfirmation, not "newest wins" — one fresh annoyance does not jump the gate. Promoted and dismissed lines roll off to `pm/improvement/archive/improve-log-archive.md` (create the folder on first rollover), keeping the live log short by construction.

## 5. Propose-only posture

The lens **never silently edits a guidance doc.** When promotion fires it *surfaces* a proposal — the candidate rule, its cited evidence, the owner doc from §4b, and the specific line it would prune — for normal decision-routing / sponsor confirmation. Mirrors `pm-clean`'s "propose, don't over-automate." Capture (the Tier-1 append) is the only ungated act.

## 6. Per-host framing

Each host cites this lens and adds one line of framing:

| Host | Boundary | Framing question (what to reflect on) | Act |
|---|---|---|---|
| **`/pm-stress-test`** (final step, after Report) | a plan was just hardened | *Did this run reveal a recurring **planning-defect class**?* (e.g. scope-boundary ambiguity surfacing again) | **capture** — append a line if yes |
| **`/pm-wrap --improve`** (opt-in flag; default off) | session end | *What cost me time this session that a rule could prevent next time?* — scan the journal + decisions just written | **capture** — append candidate line(s) |
| **`/pm-clean`** (deep-sweep step — **not** a fast-scan drift check) | periodic hygiene sweep | *Do the captured lines cluster into a pattern the guidance should address?* | **consolidate** — dedup, decay, recurrence-gate, **propose** promotions + prunes, archive drained lines |

> **The split is deliberate.** Two hosts *capture* (cheap, frequent, ungated); one host *consolidates* (periodic, gated, propose-only). Capture without consolidation just grows the log; consolidation is where the loop closes and the docs actually improve.
