# f18 topic-coverage — journal

**Current state (2026-10-06):** 🟡 opened, planning. The sponsor reviews the topic and quota table in the doc, then `/pm-stress-test`, then s01.

## 261006a — plan and open

The sponsor brought a 45-category tag list from the ChatGPT coach and asked for a home and a review. It was saved verbatim as `prompts/vocab-tags.md`. The review found overlaps (weather in nature and weather, quantity in three places, frequency in time and adverbs, money in work and shopping, possibility in cause and negation) and gaps that matter for Pakistani Urdu: compound verbs, forms of address, idioms, interjections, perception verbs and possession. It proposed slugs and grouped sections.

The sponsor then asked how many words per category would reach B1. Answer: about 2,500–2,600 in all (European-language CEFR estimates; no Urdu list exists), with quotas varying by topic. Numbers 1–100 are irregular and need about 110 slots, and compound verbs get a large topic of their own. The sponsor asked for per-level quotas and for less labour in the 8-step ChatGPT intake loop.

An Explore agent mapped the current pipeline:
- tags are free strings, auto-created, not case-folded, and absent from the review card;
- the check flow never touches tags;
- there is no CEFR field anywhere;
- the export holds the full vault, but no compact word list.

Grill (4 questions): ChatGPT paste rather than Worker API generation (avoid cost, fewest round trips); the check step dropped from the batch flow and kept as an audit; one topic plus 0–2 secondary slugs; existing words classified by a thin check mode at 100 per round trip.

Opened as f18 with 50 topics and draft quotas (A1 685, A2 955, B1 935; 2,575 in all), five slices and DECISIONS 261006a (`151be27`, `pnpm check` green). No code yet.
