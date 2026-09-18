# VISION.md

# Urdu Learning App — Vision

## 1. Purpose

Build a small, personal Urdu learning web app focused on **reading, listening, vocabulary acquisition, and spaced review of everyday Pakistani Urdu**.

The app should make it frictionless to take real Urdu text from anywhere, read it comfortably in Nastaliq, hear words and phrases spoken aloud, inspect unfamiliar language, and turn useful words or phrases into durable vocabulary.

This is a **single-user personal tool**, not a SaaS product. Its architecture, UX, and feature choices should optimize for:

- speed of use;
- low maintenance;
- mobile and desktop usability;
- durable cloud-backed data;
- easy iteration with coding agents;
- minimal infrastructure and authentication burden.

The initial release is intentionally small. It should establish a clean foundation that can grow without requiring an early rewrite.

---

## 2. Product Idea

The core loop is:

1. Paste Urdu text into the app.
2. Read it in a clear Nastaliq presentation.
3. Tap or click a word to hear it spoken.
4. Select a phrase and play it aloud.
5. Long-press or right-click a word or selection to act on it.
6. Define unfamiliar language or add useful words/phrases to vocabulary.
7. Review due vocabulary over time.
8. Let mastery determine how soon each item returns.

The app should feel more like a **personal reading and vocabulary instrument** than a course, textbook, or gamified language-learning platform.

---

## 3. Audience and Language Philosophy

The only intended user in v0 is the app owner.

The language target is **Urdu as commonly spoken in Pakistan**.

Where language assistance or generated content is added, it should prefer:

- natural, everyday Pakistani Urdu;
- useful spoken vocabulary;
- practical Roman Urdu transliteration when helpful;
- concise English explanations;
- awareness of register when relevant.

Formal, literary, archaic, Punjabi-influenced, and English-influenced forms may be identified when useful, but the default should remain ordinary contemporary Pakistani usage.

The app should not over-police harmless linguistic variation. Meaning, pronunciation, grammar, and naturalness matter more than prescriptive purity.

---

## 4. Experience Principles

### 4.1 Reading first

The pasted Urdu text is the central object in the app.

It should be visually calm, readable, and pleasant enough for sustained reading. Urdu should be rendered using a high-quality **Nastaliq font** with appropriate sizing, line height, RTL layout, and selection behaviour.

The interface around the text should stay subordinate to the text itself.

### 4.2 Interaction should be immediate

Common actions should require almost no ceremony.

Examples:

- click/tap a word → speak it;
- highlight a phrase → make phrase-level actions available;
- right-click/long-press → contextual actions;
- add to vocabulary → minimal or no form filling.

The app should infer obvious metadata rather than repeatedly asking for it.

### 4.3 Mobile is a first-class environment

The app will regularly be used as an installed PWA on a phone, not merely as a desktop website squeezed onto a small screen.

Touch interaction, long-press behaviour, text selection, comfortable hit targets, RTL rendering, and audio playback must therefore be designed deliberately.

Desktop browser use is equally important.

### 4.4 Personal utility over product polish

The app should feel coherent and pleasant, but it does not need:

- onboarding funnels;
- account-management screens;
- social features;
- billing;
- multi-user administration;
- analytics infrastructure;
- engagement mechanics.

A small amount of roughness is acceptable when it materially reduces implementation or maintenance complexity.

---

## 5. V0 Scope

### 5.1 Urdu text workspace

The user can paste Urdu text into a reading workspace.

The app should:

- preserve paragraph structure reasonably well;
- display Urdu RTL in Nastaliq;
- make individual words interactable;
- support normal browser text selection for phrases;
- retain the current text at least for the active session;
- ideally retain recent or saved texts once persistence is introduced cleanly.

The system should not require the pasted material to conform to a special lesson format.

### 5.2 Speech

Clicking or tapping an Urdu word should speak that word aloud.

Selecting a phrase and invoking speech should speak the selected phrase.

The speech implementation is not fixed by this vision. Browser speech synthesis, a hosted speech API, or another lightweight approach may be used.

The desired outcome is:

- understandable Urdu pronunciation;
- low interaction latency;
- usable behaviour on both desktop and installed mobile PWA;
- preference for a Pakistani Urdu voice when practical.

Speech quality and platform support should be tested early because mobile browser/PWA behaviour may constrain the implementation.

### 5.3 Context actions

A right-click on desktop or long-press on mobile should expose context-appropriate actions for a word or selected phrase.

Initial actions should include:

- **Speak**
- **Add to vocab**
- **Define**

Additional actions may later include:

- transliterate;
- show usage notes;
- show examples;
- favourite;
- copy;
- add tag;
- ask about grammar or phrase structure.

The contextual menu should remain short. Secondary actions can live elsewhere.

### 5.4 Definition

The user should be able to request a definition of a word or phrase from the reading workspace.

A useful definition may include:

- concise English equivalent;
- practical meaning and nuance;
- Roman Urdu transliteration;
- register or usage distinction when useful;
- a natural example.

Definition generation/provider is an implementation decision for the PRD and technical design.

The experience should favour concise, useful explanations over dictionary-style exhaustiveness.

### 5.5 Vocabulary

The app maintains a persistent vocabulary collection.

Vocabulary entries may be either:

- a single Urdu word; or
- a multi-word Urdu phrase.

Phrases are first-class vocabulary items rather than annotations attached to individual words.

Each vocabulary item should be capable of holding at least the conceptual equivalent of:

- Urdu term;
- transliteration;
- concise English equivalent;
- fuller meaning / usage notes;
- example;
- tags;
- date added;
- mastery level;
- favourite state;
- last reviewed date;
- next review date.

The exact schema is deferred to the PRD/data design.

Before adding a term, the app should attempt to avoid obvious duplicates or equivalent entries.

Adding vocabulary from the reading view should be fast. The system should infer obvious fields where possible and allow later editing.

---

## 6. Mastery and Spaced Review

The app began with the Urdu Coach project's seven-level ladder (0/1/5/25/125/625/3125 days). In 2026-09 it moved to versioned geometric ladders (DECISIONS 260918c/e, f09; design in `research/urdu-vocabulary-srs-research-and-design.md`), because two-rung moves on a ×5 ladder made ×25 scheduling commitments.

### 6.1 Review ladders

A ladder is a list of review intervals. Five presets start at 3 hours and end at 10 years, each rung a fixed multiple of the last: Dense ×2, **Moderate ×2.38 (default)**, Balanced ×2.83, Wide ×3.36, Very wide ×4. The learner picks one in Settings. Every ladder version is immutable and has an id; a changed ladder is a new version. The old seven-level ladder survives as the legacy version that migrated items sit on.

The ladders have a **single source of truth** in the application (`shared/ladders.ts`) rather than being duplicated across UI and business logic.

"Mastery" is shown as a band derived from the item's current interval, keeping the old names: New, Learning, Basic, Firm, Strong, Stable, Permanent.

### 6.2 Scheduling principle

Each item has one schedule: its ladder, its rung, the interval actually scheduled, and a due time.

`Due = Last Reviewed + interval of the item's rung`, to the second, not the day.

An item that has never been reviewed is due immediately.

Changing the ladder setting moves no due time. Each item joins the new ladder at its next review, at the rung whose interval is multiplicatively closest to its current one, and the grade then applies from there.

The implementation should make this relationship deterministic and easy to inspect.

### 6.3 Review grading

For tracked spaced-repetition reviews:

| Recall | Rung change |
|---|---:|
| Wrong | -2 rungs |
| Partially correct | -1 rung |
| Hesitantly correct | no change |
| Correct | +1 rung |
| Confidently correct | +2 rungs |

These deltas apply to recognition (Urdu → English). Production reviews (English → Urdu, and spoken Coach answers) soften misses: Wrong −1, Partially correct and Hesitantly correct no change, Correct +1, Confidently correct +2. Failing to produce a word is weak evidence it has been forgotten (amended 2026-09-18, DECISIONS 260918b). Both directions share one schedule (DECISIONS 260918d kept these deltas over the research report's table).

The rung is clamped to the ladder's first and last rung.

After a tracked review:

1. move to the new rung (joining the active ladder first if needed);
2. set `Last Reviewed` to the review instant;
3. set the due time to the review instant plus the new rung's interval;
4. record a review event with the direction, grade, delta, and the schedule before and after.

Ad-hoc viewing, speaking, definitions, or quizzes should **not silently alter mastery**.

### 6.4 Review experience

The first review experience can be simple.

It should:

- surface vocabulary that is due;
- present one item at a time;
- support useful directions such as Urdu → English and English → Urdu;
- let the user self-grade using the five recall grades;
- update mastery and scheduling immediately.

More elaborate quiz modes can come later.

---

## 7. Data Ownership and Persistence

The app should use **non-local, cloud-backed storage** as its canonical data store so the same vocabulary and learning state are available from phone, desktop, and future connected coaching tools.

The current architectural direction is **Cloudflare D1**, providing a managed SQLite-style database without operating a database server.

For this system, D1 should become the **canonical source of truth for vocabulary and learning state**.

The existing Airtable-based Urdu Coach project is a reference model and migration source, not the intended long-term runtime database. Importing the existing Airtable vocabulary into D1 is expected to be useful, but the new system should not depend on Airtable once the D1-backed workflow is established.

Important data should be exportable in a straightforward, portable format such as JSON and/or CSV.

The data model should preserve useful history rather than only current state. In particular, tracked reviews should eventually be representable as review events as well as reflected in the current mastery state.

---

## 8. Early Macro Architecture

The intended system has four primary components.

### 8.1 Vocab Vault — D1

**D1 is the persistent vault.**

It stores canonical learning state such as:

- vocabulary terms and phrases;
- transliteration, meanings, examples, tags, and favourites;
- mastery state;
- last/next review information;
- review-event history;
- saved reading material and related app state where appropriate.

D1 should be treated as persistence, not as the place where application rules live.

### 8.2 Urdu Core — Cloudflare Worker

The Cloudflare Worker is the **domain and integration layer** for the system.

It sits between clients and D1 and should own rules such as:

- authentication;
- vocabulary validation;
- normalization;
- duplicate detection and reconciliation;
- mastery transitions;
- review scheduling;
- vocabulary CRUD;
- due-vocabulary selection;
- Coach handoff import;
- AI-assisted language enrichment where useful.

Neither the PWA nor the Coach should need direct knowledge of D1 tables or SQL.

Conceptually:

`client → Urdu Core → D1`

The Worker API should expose meaningful learning operations rather than generic database access.

Examples might eventually include:

- get due vocabulary;
- search vocabulary;
- get a vocabulary item;
- propose/add/update vocabulary;
- record a review result;
- import a Coach handoff.

The exact API is deferred to the PRD and technical design.

### 8.3 Coach — ChatGPT Urdu Coach

The existing ChatGPT Urdu Coach remains the preferred environment for:

- Live Voice conversation;
- listening and speaking practice;
- adaptive oral testing;
- natural correction;
- semantic judgment of answers;
- fluid coaching that benefits from conversational context.

The PWA is **not intended to replace the Coach**.

The Coach and PWA are complementary interfaces over the same broader learning system.

Where tool use is available in ordinary ChatGPT chat, the long-term direction is for the Coach to retrieve vocabulary through Urdu Core rather than through Airtable.

A useful early workflow is:

1. in ordinary text chat, ask the Coach to fetch due or otherwise selected vocabulary through a tool connected to Urdu Core;
2. enter Live Voice with that vocabulary already available in the conversation context;
3. conduct the oral quiz or coaching session in Voice;
4. when the session is complete, have the Coach produce a structured handoff containing review results and/or proposed new vocabulary;
5. paste/import that handoff into the PWA;
6. let Urdu Core validate and apply the changes to current D1 state.

This accommodates current differences between normal chat/tool use and Live Voice without coupling the architecture to those limitations.

As ChatGPT tool support evolves, the transport may later become direct:

`Coach → Urdu Core → D1`

without changing the underlying domain contract.

### 8.4 Reader / Vocabulary UI — PWA

The PWA is the **direct-manipulation learning workspace**.

It owns the interaction patterns that are awkward or impossible in the conversational Coach:

- paste and read Urdu text;
- Nastaliq display;
- click/tap to hear a word;
- select and hear a phrase;
- long-press/right-click actions;
- fast vocabulary creation and editing;
- browsing/searching/filtering vocabulary;
- visual review;
- importing Coach handoffs;
- reconciling proposed changes;
- saved passages and reading-related state.

It should communicate with Urdu Core through HTTP/API operations and should not directly manipulate D1.

The PWA should remain useful even when no LLM call is involved.

---

## 9. Division of Responsibility: Deterministic Logic vs AI

The system should deliberately separate **semantic judgment** from **canonical state transitions**.

### 9.1 Deterministic application logic should own

- mastery-level transitions;
- review intervals;
- next-review calculation;
- timestamps;
- IDs;
- validation;
- exact data mutations;
- persistence;
- whether a handoff has already been imported;
- enforcement of allowed values and invariants.

For example:

`Correct → promote one mastery level`

is application logic, not an LLM decision.

### 9.2 AI may help with

- whether a free-form oral answer was wrong, partially correct, hesitant, correct, or confidently correct;
- defining a word or phrase in context;
- identifying a useful lemma/canonical form;
- transliteration;
- usage nuance and register;
- generating natural Pakistani Urdu examples;
- fuzzy duplicate/equivalence suggestions;
- explaining grammar or phrase structure;
- proposing vocabulary metadata.

AI should generally **interpret and propose**.

Urdu Core should **validate and commit**.

A useful guiding principle is:

> AI may propose semantic interpretation; deterministic application code owns canonical state transitions.

---

## 10. Coach Handoff Protocol

The initial bridge from Live Voice back into the persistent system may be a deliberately simple **structured JSON handoff** carried by the user via clipboard.

This is not merely a temporary formatting trick. It should be treated as an early version of a stable integration contract.

A handoff may contain:

- tracked quiz results;
- proposed new vocabulary;
- session identity / timestamp metadata.

The Coach should send **events and proposals rather than overwriting database state**.

For example, a quiz result should communicate:

- the vocabulary item or canonical identifier where available;
- the semantic grade, such as `correct` or `partially_correct`;

rather than an absolute new mastery score.

Urdu Core then:

1. resolves the current canonical vocabulary record;
2. reads its current mastery state;
3. applies the deterministic mastery rule;
4. records the review event;
5. calculates the next review date;
6. rejects or flags ambiguous/unmatched items rather than guessing.

Likewise, proposed vocabulary should be treated as a candidate. Urdu Core/PWA should check for an existing or equivalent term before creating a new record.

The handoff should include a session or handoff identifier so accidental repeat imports can be detected.

The initial transport may be:

`Coach → JSON → clipboard → PWA → Urdu Core`

A later transport may be:

`Coach → tool/action → Urdu Core`

The semantic contract should remain substantially the same.

---

## 11. Deployment and Technical Direction

The current preferred direction is:

- **TypeScript**
- **Vite**
- a lightweight responsive web UI, likely React
- **Cloudflare Workers** for deployment, API logic, and the Urdu Core domain layer
- **Cloudflare D1** for canonical persistent data
- PWA manifest / installability
- Git-based local development
- Codex and/or Claude Code as primary coding agents
- a small ChatGPT-side integration/tool for Urdu Core where practical

These choices are directional, not immutable.

The project should prefer boring, widely understood components over clever infrastructure.

A major goal is that this app becomes the first proving ground for a reusable pattern for other small personal apps.

---

## 12. Authentication and Privacy

This is a single-user personal app containing no particularly sensitive or confidential information.

V0 should therefore avoid conventional account systems, OAuth, password resets, identity providers, and user administration.

Instead, use a **single strong personal secret** as the authentication credential for the PWA.

The intended security shape is:

1. user visits the app;
2. if no valid session exists, the app asks for the personal secret;
3. the secret is submitted securely to server-side Worker logic;
4. server-side logic validates it against a secret that is never exposed in browser code;
5. a long-lived secure session is established for that device.

The raw secret must not be:

- compiled into frontend JavaScript;
- stored in the repository;
- placed in a URL;
- persisted in readable browser storage.

The resulting experience should be close to "unlock once per device, then forget about it."

Coach/tool authentication to Urdu Core should be separate from the human PWA unlock mechanism and scoped as narrowly as practical.

This is intentionally lightweight authentication, appropriate to the app's personal and low-sensitivity nature.

---

## 13. URL and Deployment Identity

The intended Cloudflare Workers namespace is:

`umber-amber.workers.dev`

The initial app is expected to be deployed at:

`urdu.umber-amber.workers.dev`

A custom purchased domain is not required for v0.

---

## 14. PWA Behaviour

The app should be installable to the phone home screen as a Progressive Web App.

At minimum, it should have:

- a web app manifest;
- appropriate icons;
- standalone display behaviour where supported;
- responsive layouts;
- sensible mobile navigation;
- reliable reopening into the app.

Full offline operation is **not** a v0 requirement.

Local caching may be used opportunistically, but cloud data remains canonical.

---

## 15. Relationship to Urdu Coach

The existing Urdu Coach project provides both important learning conventions and a complementary interaction surface.

Its useful conventions include:

- everyday Pakistani Urdu as the language target;
- practical transliteration;
- concise English explanation;
- vocabulary as durable structured data;
- duplicate avoidance;
- tags and favourites;
- mastery-based spaced repetition;
- review scheduling driven by mastery;
- tracked reviews that update mastery;
- ad-hoc interactions that do not silently affect mastery.

Its continuing product role is different from the PWA:

**Urdu Coach**
- conversation;
- oral comprehension;
- speaking practice;
- verbal quizzes;
- correction and adaptive coaching.

**PWA**
- reading;
- hearing selected text;
- direct vocabulary manipulation;
- browsing/editing vocabulary;
- durable review state;
- visual interaction with Urdu text.

The new web app should preserve the useful learning conventions while moving canonical vocabulary state into D1 and exposing that state through Urdu Core.

The PWA does **not** need to reproduce every capability of Urdu Coach.

---

## 16. Explicit Non-Goals for V0

V0 is not intended to be:

- a replacement for ChatGPT Live Voice;
- a full language curriculum;
- an Anki replacement;
- a multi-user application;
- a public vocabulary-sharing service;
- an Urdu dictionary;
- a grammar textbook;
- a social learning platform;
- an AI chatbot wrapped in a website;
- a complex content-management system;
- an offline-first application;
- a production SaaS architecture.

Avoid implementing infrastructure merely because a future version might conceivably need it.

In particular, do not build a custom realtime conversational voice tutor when ChatGPT Voice already provides that experience well.

---

## 17. Likely Later Directions

The architecture should leave room for useful extensions such as:

- direct Coach → Urdu Core tool calls for both reads and writes;
- removal of the clipboard handoff when direct Voice/tool integration becomes suitable;
- saved reading passages;
- recent reading history;
- richer definitions;
- generated examples;
- phrase breakdowns;
- word-by-word glosses;
- transliteration toggle;
- grammar explanations;
- audio replay controls;
- vocabulary search/filtering;
- tag management;
- favourites;
- review statistics;
- importing the existing Airtable Urdu vocabulary;
- exporting the complete vocabulary database;
- additional quiz directions;
- contextual AI assistance;
- highlighting known vs unknown vocabulary within pasted text.

These are possibilities, not commitments.

---

## 18. What Success Looks Like

V0 succeeds if the following reading workflow feels natural enough to use regularly:

> Paste some Urdu → read it comfortably → tap unfamiliar language → hear it → understand it → save useful terms → encounter them again at sensible intervals.

It also succeeds if the two learning surfaces complement each other naturally:

> Coach verbally → fetch/use canonical vocab → speak and test in Live Voice → hand review results back to the PWA → maintain one durable vocabulary state.

The strongest success criterion is not feature count. It is whether the system reduces friction between:

- encountering Urdu in the real world;
- understanding and saving useful language;
- practising it conversationally;
- maintaining an accurate long-term model of vocabulary mastery.

Technically, v0 succeeds if it also proves a reusable personal-app pattern:

- local Git repo;
- coding-agent-friendly project structure;
- simple Cloudflare deployment;
- persistent D1 storage;
- Worker-owned domain logic;
- lightweight personal authentication;
- clean external-tool integration;
- phone + desktop usability;
- very little ongoing infrastructure maintenance.

If that pattern works well, the Urdu app can become the template for a broader family of small personal productivity applications.
