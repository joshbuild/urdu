# Decision Guide Part 1 — CORE (the hot path)

*v0.06 | 2026-05-26*



**File Purpose**: Routes planning/implementation decisions so **Sponsor attention is reserved for what Sponsor cares about** (product behavior, strategy, visuals, maintainability & code elegance) and **Agent decides everything else** against an agreed rubric.

> **Agents: read Part 1 every time. Part 1 is the whole procedure.** Pull Part 2 (Reference) only when a call is genuinely ambiguous — a type you can't place, a DT4/DT5 boundary you're unsure of, or a DT5 where the options actually tie. Most decisions never leave Part 1.

> **Lineage (for humans).** This guide is a DACI decision-rights matrix (Agent = *Driver*, Sponsor = *Approver*) crossed with Bezos's reversibility test and Nygard-style decision logging. If a section feels familiar, that's why.

---



## The procedure

Run this on every non-trivial decision. It is five steps and it short-circuits early.

1. **Classify** the decision: DT1 Product · DT2 Strategy · DT3 Aesthetic · DT4 Architectural · DT5 Technical. Straddle → take the **higher-attention** bucket. *(Definitions: Part 2 Types.)*
2. **Filter** the options. Drop anything that hits a **disqualifier** (below) before comparing. Compare only survivors.
3. **Triage reversibility** — *hat, haircut, or tattoo?* (below). This is the gate that decides most calls. Tattoo → escalate. Haircut → usually escalate if material. Hat → proceed if the decision is yours.
4. **Route** by the matrix:
   - **DT4** → always Propose, never act. (No "minor" DT4 — see Part 2.)
   - **DT1 / DT2 / DT3** → Escalate if **material**; **decide** only if it clears **all** minor-impact gates (Part 2 §Minor).
   - **DT5** → **you decide.** If the call is obvious, just make it. If options genuinely tie, run the adjudication rubric (Part 2 §Adjudication).
   - **Friction cost.** Over-escalation is the failure mode this guide exists to prevent. Sponsor cycles are the scarce resource — escalate on doubt about *reversibility* or *materiality*, not on doubt itself.
5. **Log** per cadence (below), present-tense. Material / cross-cutting calls are logged *after* Sponsor confirms.

## The matrix

| Type                  | Sponsor                                                      | Agent                                                        |
| --------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| **DT1 Product**       | **Decides** material                                         | Proposes material; decides minor; never silently decides material |
| **DT2 Strategy**      | **Decides** material                                         | Proposes material; decides minor; never silently decides material |
| **DT3 Aesthetic**     | **Decides** material                                         | Proposes material; decides minor; never silently decides material. Respects the project's visual/UI authority doc (`#todo`). |
| **DT4 Architectural** | **Decides**                                                  | Proposes; never silently changes a boundary. **No minor threshold — DT4 is material by definition.** |
| **DT5 Technical**     | **Informed** on net-new patterns / things widely copied (new dependency, new reusable pattern). | **Decides** via rubric. Logs non-trivial calls; graduates cross-cutting ones to `pm/DECISIONS.md`. |

**Agent proposals always carry:** situation · options · tradeoffs · notable risks · a clear recommendation — depth scaled to the stakes.

**Decisions lock in: Sponsor-decided at Sponsor's confirmation; Agent-decided at the commit** (the code is both the record and the closer). Once locked, do not relitigate — re-open only on genuinely new information.

## Reversibility triage — hats, haircuts, tattoos

James Clear's framing allows for applying fast intuition *before* the formal gates — it's right far more often than not:

- **🎩 Hat** — try it, hate it, swap it. Cheap and instant to reverse. *One commit, no schema change, no migration.* → If it's yours to decide, **just decide.** Don't deliberate a hat.
- **💈 Haircut** — reversible, but not free and slightly awkward in the meantime. *A refactor, a default others have started relying on.* → Decide if clearly minor; **flag or escalate** if it sits near a boundary.
- **🪦 Tattoo** — a one-way door. Persisted-schema shape, a public/serialized contract, anything that locks out a Backlog item or forces a schema-version bump. → **Escalate. Always.** Tattoos get scrutiny regardless of which type or owner they fall under.

The expensive mistake is treating hats like tattoos — burning Sponsor cycles (friction!) on trivially reversible calls. The other expensive mistake is treating a tattoo like a hat. **"When in doubt about *reversibility*, escalate"** — that is the doubt that earns escalation, not every doubt.

## Disqualifiers (filter first, then compare)

Some options are off the table before any rubric runs:

- Violations of an existing entry in `pm/DECISIONS.md`.
- Changes that break the project's persisted-state invariants or a public/serialized contract.
- **Bypassing an authority doc's owner** — hand-rolling something an authority doc owns instead of editing that doc first; introducing a new primitive/term/token/gesture without registering it in its authority doc. Full catalogue: `AGENTS.md §Doc architecture`.

> `#todo` list this project's disqualifiers: e.g. persisted-schema changes, public API/contract changes, performance-critical-path violations, prior DECISIONS reversals.

## Escalation triggers (ask, don't decide — regardless of type)

New third-party dependency · public API / serialized-state shape change · anything forcing a schema-version bump beyond the planned one · a choice that locks out a Backlog item · a tie the rubric can't break.

## Logging cadence

- **Trivial DT5** → no log; the code is the record.
- **Non-trivial DT5** (chose A over B with a real tradeoff) → one bullet in the feature doc's §Decisions.
- **DT1 / DT2 / DT3** → always logged (feature doc for local, `pm/DECISIONS.md` for cross-cutting).
- **Cross-cutting / doctrine-setting** → one dated line in `pm/DECISIONS.md`, *after* Sponsor confirms.
