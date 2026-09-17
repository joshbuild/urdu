# AGENTS.md | Urdu PWA

## Primary Agent Instructions

## Shared project guidance

All agents: read `CLAUDE.md` for architecture, invariants and development
commands. Read `pm/VISION.md`, `pm/PRD.md`, and `pm/PLAN.md` before design or
implementation. PRD wins on scope; VISION owns intent. Code and verified
checks establish what is actually built. Current work lives in `pm/STATUS.md`.

## PM workflow (Claude Code and Codex)

Use `pm-resume` at session start, `pm-open` to open work, `pm-close` only
after Done When gates pass, and `pm-wrap` at session end. Use `pm-triage`,
`pm-stress-test`, `pm-clean`, and `pm-release` for their named operations.
An orientation request does not itself start the next product slice.

Canonical skills on this machine:
`C:/Users/jlock/.claude/skills/pm-<name>/SKILL.md`.
Codex adapters at `C:/Users/jlock/.codex/skills/pm-<name>/SKILL.md` read those
originals. If discovery has not refreshed, read the canonical file directly.
Resolve skill-relative references from the original directory. Treat slash
commands, dollar mentions and natural-language requests as skill invocations.
Map Claude-specific tool names to available equivalents; its permission
settings do not configure Codex. Do not fork the PM procedures per agent.

Read `pm/workflows/pm-approach.md` for the model,
`pm/workflows/feature-lifecycle.md` for lifecycle/git rituals,
`pm/pm-glossary.md` for terms and information homes, and
`pm/workflows/decision-guide-part-1.md` for decision routing (part 2 as needed).

Work directly on `main` in small coherent commits scoped to session-owned
paths; preserve unrelated work. Run `pnpm check` before each commit.
Resume from STATUS, recent SESSIONS, then the active front's doc/journal.
Keep narration in journals, session one-liners in SESSIONS, and STATUS thin.
Feature decisions stay with the feature; cross-cutting decisions go in
DECISIONS. Archive completed fronts in their sibling archive directory,
retaining the handle and adding `-archive`; update live references.

## Execution notes

Use the sponsor runbook in the active f01 doc for production secrets,
remote migrations, deployment and phone verification. Local checks do not
establish production readiness. Never print `.dev.vars` secret values.

If Windows reports `spawn EPERM`, distinguish tool execution restrictions
from application failures. Use the permitted execution mode and report
remaining limitations; do not weaken checks to manufacture a green result.

