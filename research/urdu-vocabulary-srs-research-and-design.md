# Urdu Vocabulary SRS: Research Findings and Final Design Recommendation

**Status:** Accepted design recommendation, **except the grade deltas**: the app keeps recognition −2/−1/0/+1/+2 and production −1/0/0/+1/+2 (DECISIONS 260918d). The tables in §1 and §4.3 below are superseded.  
**Audience:** implementation planning and technical design  
**Application context:** personal, single-user Urdu vocabulary app; primarily mobile; hundreds of vocabulary items; self-graded reviews

## 1. Executive summary

The app should retain **one shared scheduling state per vocabulary item**, rather than separate recognition and production schedules. Recognition (Urdu → English) and production (English → Urdu) remain distinct review modes and are logged separately, but both update the same ladder position and next-review timestamp.

The evidence supplied by the two directions is asymmetric:

- Failure to produce an Urdu word does not necessarily mean its Urdu form would not be recognized.
- Successful unprompted production is strong evidence of knowledge.
- Recognition success is weaker evidence of productive availability.

The accepted direction-specific mastery changes are therefore:

| Self-grade | Recognition: Urdu → English | Production: English → Urdu |
|---|---:|---:|
| Wrong | −2 | −1 |
| Partially correct | −1 | 0 |
| Hesitantly correct | 0 | 0 |
| Correct | 0 | +1 |
| Confidently correct | +1 | +2 |

Two-rung jumps are intentionally allowed.

The old seven-level ×5 ladder should be replaced by a configurable geometric ladder extending from hours to approximately ten years. Five presets should be offered, expressed as quarter-step powers of two:

| Preset | Exponent | Multiplier | Effective interval change for `+2` |
|---|---:|---:|---:|
| Dense | `2^1` | 2.000 | ×4.000 |
| Moderate | `2^1.25` | 2.378 | ×5.657 |
| Balanced | `2^1.5` | 2.828 | ×8.000 |
| Wide | `2^1.75` | 3.364 | ×11.314 |
| Very wide | `2^2` | 4.000 | ×16.000 |

**Default:** Moderate, `2^1.25 ≈ 2.378`.

All presets should use:

- a three-hour initial interval;
- an approximately ten-year maximum interval;
- exact canonical durations for scheduling;
- friendly rounded labels only for presentation;
- an immutable, versioned ladder definition;
- non-retroactive ladder changes by default.

The durable scheduling state should be the **actual scheduled interval and due timestamp**. A ladder step is a position within one version of a ladder, not a universal measure of mastery.

## 2. Starting point and design goals

The existing application has:

- one vocabulary item representing an Urdu–English association;
- recognition and production prompts;
- one shared mastery level and next-review date;
- direction recorded on every review event;
- a seven-level interval ladder of `0 / 1 / 5 / 25 / 125 / 625 / 3125 days`;
- grades `−2 / −1 / 0 / +1 / +2`.

The revised design should remain understandable without adopting a full probabilistic scheduler. It should also:

1. distinguish the strength of evidence supplied by recognition and production;
2. support same-day learning intervals;
3. avoid the volatility of combining ×5 spacing with two-level moves;
4. allow the learner to trade review load against forgetting risk;
5. survive a ladder-setting change without corrupting progress or creating an unexpected backlog;
6. integrate cleanly with future voice-tutor reviews.

## 3. Research findings

### 3.1 Recognition and production are related but not equivalent

L2 vocabulary knowledge is not a single binary state. Laufer and Goldstein tested four increasingly demanding knowledge modes—passive recognition, active recognition, passive recall and active recall—and found the proposed difficulty hierarchy in their learner data. They also found different growth patterns across modalities. This supports treating recognition and production outcomes as different evidence, even if the application chooses to maintain one combined scheduling state. [Laufer & Goldstein, 2004](https://doi.org/10.1111/j.0023-8333.2004.00260.x)

Anki's documentation makes the same practical distinction: a foreign-language-to-native-language card tests recognition, while the reverse tests production. Anki creates separate cards because tracking the two performances together can lead to mistimed reviews. This is a documented product choice, not proof that separate schedules are always superior for every application. [Anki Manual: Notes, fields and card types](https://docs.ankiweb.net/getting-started.html#notes--fields)

**Inference for this app:** production failure is weaker negative evidence about the shared association than recognition failure, while successful production is stronger positive evidence than successful recognition. That inference motivates the asymmetric scoring table in Section 5.

### 3.2 There is no universal optimal interval multiplier

Established schedulers use materially different approaches:

| Scheduler | Documented interval behavior |
|---|---|
| SuperMemo SM-0 | Approximately constant ×2 intervals for the author's English-vocabulary material |
| SuperMemo SM-2 | First successful intervals of 1 and 6 days, followed by multiplication by an item-specific easiness factor; historically about 1.3–2.5 |
| Anki legacy | Default Good interval approximately ×2.5; Easy adds a default ×1.3 bonus to Good; Hard uses ×1.2 |
| FSRS | No fixed multiplier; models stability, difficulty and retrievability and schedules for a requested retention probability |
| Duolingo HLR | No fixed multiplier; estimates a learner-word memory half-life from history and features |
| Pimsleur | Uses graduated recall with progressively increasing intervals within a structured audio course |
| Leitner variants | Longer intervals for higher boxes, but no single canonical numeric ratio |

SuperMemo's SM-2 description says that successful intervals multiply by an item-specific easiness factor. It reports an approximate factor of two for the earlier SM-0 English vocabulary schedule, while SM-2 allowed factors from roughly 1.3 to 2.5. [SuperMemo: SM-2 algorithm](https://super-memory.com/english/ol/sm2.htm)

Anki's legacy defaults similarly use approximately ×2.5 for Good, ×3.25 for Easy and ×1.2 for Hard. Its modern FSRS option instead learns memory parameters from review history and uses desired retention—90% by default—as the principal learner setting. [Anki Manual: Deck options](https://docs.ankiweb.net/deck-options.html)

FSRS defines stability as the interval at which retrievability reaches 90%. Successful-review stability growth depends on existing stability, item difficulty, retrievability and grade; it is not a constant ratio. In particular, stability becomes harder to increase as it grows. [FSRS algorithm](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm)

Duolingo's published half-life regression model predicts recall as a function of time relative to an estimated learner-word half-life. It uses correct and incorrect history and lexical features rather than a fixed expansion factor. In Duolingo's historical-log evaluation, HLR predicted recall better than the tested fixed Pimsleur and Leitner baselines; that result concerns predictive accuracy and should not be overstated as a universal retention comparison. [Settles & Meeder, 2016](https://research.duolingo.com/papers/settles.acl16.pdf)

Pimsleur officially describes gradually increasing recall intervals embedded in listening and speaking lessons. Its instructional environment includes active anticipation, contextual conversation and repeated encounters; it should not be treated as direct evidence that a fixed ×5 daily flashcard ladder is optimal. [The Pimsleur Method](https://www.pimsleur.com/the-pimsleur-method/)

Research on spacing likewise indicates that an effective gap depends on the intended retention horizon. Cepeda and colleagues found that the optimal gap increased with the final test delay, while the gap's proportion of that delay decreased for longer horizons. This argues against treating any one multiplier as cognitively universal. [Cepeda et al., 2008](https://pubmed.ncbi.nlm.nih.gov/19076480/)

### 3.3 Why the old ×5 ladder was problematic

The problem was not simply that five is larger than common SM-2-style factors. The decisive issue was the interaction with two-rung grading:

| Mastery movement | Effective interval multiplier under the old ladder |
|---|---:|
| `+1` | ×5 |
| `+2` | ×25 |
| `−1` | ÷5 |
| `−2` | ÷25 |

For example, a confident production review could move an item from 25 days directly to 625 days, or from 125 days to 3,125 days. A single outcome therefore made a very large scheduling commitment.

The accepted design keeps two-rung moves but pulls in the ordinary multiplier and makes the chosen aggressiveness explicit.

### 3.4 Product-design patterns

Products broadly fall into two patterns:

1. **Card-centric SRS products**, such as Anki, normally give each generated direction its own scheduling state. Reverse cards are siblings, and Anki can bury related siblings until the next day to avoid immediate answer leakage. [Anki Manual: Burying](https://docs.ankiweb.net/deck-options.html#burying)
2. **Guided language products** commonly expose a word, sentence or course-level mastery concept while mixing several exercise types. Public documentation usually does not specify whether every direction has an independent internal schedule, so conclusions about their storage models are often inference rather than documented fact.

No direct controlled evidence was identified showing that two independent directional schedulers necessarily outperform a well-designed shared or hybrid scheduler for this particular single-user use case. Separate schedules model the distinction more explicitly, but they also increase review volume and implementation complexity.

**Design conclusion:** one shared schedule is a reasonable deliberate simplification for a personal application with hundreds rather than tens of thousands of items, provided direction-specific evidence is weighted asymmetrically and direction-level statistics remain available.

## 4. Final scheduling model

### 4.1 Shared item state

Each vocabulary item owns exactly one active scheduling state:

- scheduled interval;
- due timestamp;
- ladder version and step;
- last review timestamp.

Recognition and production are prompt modalities, not separately scheduled cards.

The application should nevertheless retain lightweight direction-level observations, such as:

- last review timestamp by direction;
- last grade by direction;
- recent success/failure counts or a rolling success rate;
- whether production is stale relative to recognition.

These fields influence **which direction is selected**, not when the vocabulary item is due.

### 4.2 Direction selection

When an item becomes due:

1. Prefer production if production is weak, recently failed or materially staler than recognition.
2. Otherwise mix the two directions, with production receiving sufficient exposure to match the goal of usable spoken Urdu.
3. Do not normally present both directions for the same item in the same session or day. The first presentation exposes the answer and contaminates the second retrieval attempt.

The selection policy should remain independently configurable and testable; it is not part of the interval ladder itself.

### 4.3 Grade mapping

Use the following exact mastery deltas:

```text
recognition: [-2, -1,  0,  0, +1]
production:  [-1,  0,  0, +1, +2]
```

The array order is:

```text
Wrong, Partially correct, Hesitantly correct, Correct, Confidently correct
```

Rationale:

- Recognition failure strongly contradicts the shared mastery state.
- Production failure is expected to occur sooner than recognition failure and therefore has a smaller penalty.
- Merely recognizing a word does not strongly justify a longer production interval.
- Correct production advances the item.
- Confident production supplies the strongest evidence and may advance two rungs.

### 4.4 Ladder presets

Represent multiplier choices as quarter-step exponents rather than stored decimal identities:

```text
multiplier = 2 ^ (exponent_quarters / 4)
```

| Preset | `exponent_quarters` | Exact expression | Approximate multiplier |
|---|---:|---:|---:|
| Dense | 4 | `2^(4/4)` | 2.000000 |
| Moderate | 5 | `2^(5/4)` | 2.378414 |
| Balanced | 6 | `2^(6/4)` | 2.828427 |
| Wide | 7 | `2^(7/4)` | 3.363586 |
| Very wide | 8 | `2^(8/4)` | 4.000000 |

The global defaults are:

```text
base_interval_seconds = 10_800       # 3 hours
maximum_interval_seconds ≈ 10 years
exponent_quarters = 5                # Moderate
```

The default ladder's uncapped approximate durations are:

```text
3 h
7.1 h
17 h
1.7 d
4.0 d
9.5 d
22.6 d
53.8 d
128 d
304 d
724 d
1,722 d
4,096 d  -> capped to approximately 10 years
```

Friendly UI labels might be:

```text
3 hours, 7 hours, 17 hours, 2 days, 4 days, 10 days,
3 weeks, 2 months, 4 months, 10 months, 2 years,
4.7 years, 10 years
```

The labels are not scheduling inputs. In particular, avoid two distinct canonical intervals both displaying simply as “1 year.” Use a more precise label such as “9 months,” “1.4 years,” or an approximate marker.

### 4.5 Ladder generation

Conceptual generation:

```text
interval[0] = base_interval

while interval[last] < maximum_interval:
    candidate = base_interval * multiplier^(last + 1)
    interval.append(min(candidate, maximum_interval))

stop after appending maximum_interval once
```

Requirements:

- Generate with sufficient numeric precision.
- Convert to an integer canonical duration using one documented rounding rule.
- Enforce strictly increasing intervals before the cap.
- Include the maximum interval exactly once.
- Snapshot the generated intervals in an immutable ladder version.
- Never regenerate an existing version using changed code or rounding rules.

### 4.6 Review transition

For an item already on the active ladder:

```text
delta = grade_delta(direction, grade)
new_step = clamp(old_step + delta, 0, ladder.max_step)
new_interval = ladder.intervals[new_step]
new_due_at = reviewed_at + new_interval
```

At the final rung, positive results keep the item at the maximum interval. At the first rung, negative results keep it at the first rung. Same-session relearning, if desired, should be modeled separately rather than inventing negative ladder indices.

## 5. Data model recommendation

The names below are conceptual; they can be adapted to the application's conventions.

### 5.1 `ladder_version`

```text
id                          UUID or stable integer primary key
name                        text
exponent_quarters           integer
base_interval_seconds       integer
maximum_interval_seconds    integer
intervals_seconds           integer array or child rows
rounding_policy             text/version identifier
created_at                  timestamp
```

Ladder versions are immutable after use. Changing a preset definition creates a new version.

If portability or relational querying matters, use a child table:

```text
ladder_step
-----------
ladder_version_id
step_index
interval_seconds
primary key (ladder_version_id, step_index)
```

### 5.2 `item_schedule`

```text
item_id                     foreign key / primary key
ladder_version_id           foreign key
ladder_step                 integer
scheduled_interval_seconds  integer
due_at                      timestamp
last_reviewed_at            timestamp, nullable
updated_at                  timestamp
```

Store both the step and exact interval. The duplication is intentional: it improves auditability, permits integrity checks and protects historical interpretation.

Because the ladder starts in hours, replace a date-only due field with a timestamp. Store timestamps in UTC and use the learner's timezone for display, notifications and daily queue grouping.

### 5.3 `review_event`

```text
id
item_id
reviewed_at
direction                   recognition | production
grade                       wrong | partial | hesitant | correct | confident
applied_delta               integer
ladder_version_id
previous_step
new_step
previous_interval_seconds
new_interval_seconds
previous_due_at
new_due_at
source                      flashcard | voice_tutor | other
prompt_support              none | hint | answer_exposed | repetition
```

The event should record what actually happened rather than depend on reconstructing behavior from today's settings.

### 5.4 Direction statistics

These may be stored columns, a separate table or derived aggregates:

```text
item_direction_state
--------------------
item_id
direction
last_reviewed_at
last_grade
recent_attempt_count
recent_success_count
```

Do not let these become a second hidden scheduler unless that is a future intentional redesign.

## 6. Changing ladder settings mid-course

### 6.1 Default: non-retroactive transition

Changing the selected ladder must not immediately rewrite all due dates. Existing items retain the due time and interval under which they were scheduled. Each item moves to the new ladder when it is next reviewed.

At review time:

1. If the item's ladder version is current, use its stored step.
2. Otherwise, map its stored scheduled interval to the logarithmically closest interval in the active ladder.
3. Apply the direction-specific grade delta.
4. Store the resulting step, interval, ladder version and due timestamp.

Logarithmic mapping:

```text
base_step = argmin_i(abs(log(new_ladder[i] / old_interval)))
```

This correctly treats multiplicative distance: 10→20 days is comparable to 100→200 days. If two steps are equally close, choose the shorter interval as the conservative tie-breaker.

Pseudocode:

```text
active = settings.active_ladder_version

if item.ladder_version_id == active.id:
    base_step = item.ladder_step
else:
    base_step = closest_step_logarithmically(
        active.intervals,
        item.scheduled_interval_seconds,
        tie_break = SHORTER
    )

delta = grade_delta(direction, grade)
new_step = clamp(base_step + delta, 0, active.max_step)
new_interval = active.intervals[new_step]
new_due_at = reviewed_at + seconds(new_interval)
```

### 6.2 Optional immediate remapping

An advanced “apply immediately” action may be added later:

```text
mapped_interval = closest_interval(new_ladder, old_interval)
new_due_at = last_reviewed_at + mapped_interval
```

This can make many items immediately overdue or defer them substantially. It should not be the default and should show a preview of resulting due counts before confirmation.

## 7. Migration from the legacy ×5 ladder

Create an immutable legacy ladder version:

```text
0 d / 1 d / 5 d / 25 d / 125 d / 625 d / 3125 d
```

Migration steps:

1. Add the versioned ladder and timestamp-capable scheduling schema.
2. For every item, translate its current mastery level into the corresponding legacy scheduled interval.
3. Attach the legacy ladder version and matching step.
4. Preserve its existing due value. Convert a date to the application's chosen local due time, then store the result in UTC.
5. Set the active global ladder to Moderate (`exponent_quarters = 5`).
6. Move each item to the new ladder only when it is next reviewed, using logarithmic interval matching.

The legacy zero-day level requires an explicit rule because the new long-term ladder begins at three hours. Recommended interpretation:

- If already due, preserve it as due now.
- At its next review, treat its base position as the first rung of the active ladder before applying the grade.

Do not replay review history to alter existing mastery during this migration. Historical events may be used to initialize direction statistics, but the authoritative interval and due time should remain unchanged until the next review.

## 8. Voice tutor integration

A voice interaction may update the shared schedule only when it constitutes a genuine retrieval attempt.

Count as production evidence when:

- the learner is given an English meaning or suitable communicative prompt;
- the Urdu answer has not yet been supplied;
- the learner attempts an answer from memory;
- grading evaluates lexical retrieval, not merely pronunciation quality.

Do not treat the following as successful production recall:

- repeating Urdu immediately after hearing it;
- reading a displayed answer aloud;
- responding after the decisive lexical hint;
- pronunciation imitation without lexical retrieval.

Record `source` and `prompt_support` on the review event. Pronunciation quality may be tracked separately from vocabulary mastery.

## 9. Operational metrics and validation

The selected multiplier is a policy choice, not a scientifically universal constant. Validate it using the learner's actual outcomes.

Track by direction, previous interval band and ladder version:

- due reviews;
- successful recall rate;
- distribution of grades;
- lapse rate;
- actual delay versus scheduled delay;
- reviews per day and time per day;
- transitions caused by `+2` and `−2`;
- items repeatedly oscillating between the same steps.

Initial interpretation bands:

| Due-time success | Likely interpretation |
|---:|---|
| Above 95% | Probably reviewing more often than necessary |
| About 85–92% | Broadly reasonable starting region |
| Below 80% | Ladder, direction policy or grading calibration is probably too aggressive |

These bands are operational heuristics, not universal retention targets. FSRS uses 90% as its default desired retention and notes that workload rises sharply at very high desired retention. [Anki Manual: FSRS desired retention](https://docs.ankiweb.net/deck-options.html#desired-retention)

Because this is a single-user app, favor visible analytics and manual preset selection over premature model training. Reconsider an adaptive scheduler only after enough review history exists to demonstrate a persistent limitation of the fixed ladder.

## 10. Acceptance criteria for implementation planning

1. The application exposes five ladder-spread presets and defaults to Moderate (`2^1.25`).
2. All presets begin at three hours and terminate at the configured maximum interval exactly once.
3. Exact durations—not UI labels—drive scheduling.
4. Recognition and production use the accepted distinct delta mappings.
5. `+2` and `−2` moves may cross two rungs and clamp safely at ladder boundaries.
6. Each vocabulary item has one due timestamp and one scheduling state.
7. Review events retain direction, grade, applied delta, source, ladder version and before/after scheduling values.
8. Changing the active ladder does not rewrite outstanding due timestamps by default.
9. At the next review, an item on an old ladder maps to the logarithmically closest rung of the active ladder before its grade is applied.
10. Legacy items migrate without changing their existing due time.
11. Same-item opposite-direction prompts are normally prevented within the same day/session.
12. Voice-tutor repetition or prompted imitation does not count as unassisted production recall.
13. The app can report due-time success and workload by direction, interval band and ladder version.

## 11. Decisions intentionally deferred

- Exact recognition-versus-production prompt-selection percentages.
- Whether a failed first-rung card receives an immediate same-session relearning step.
- Whether the ten-year cap uses a fixed day count or calendar-aware duration.
- Whether the advanced immediate-remapping option is worth exposing.
- Whether future data justifies separate directional schedules or an FSRS-like adaptive model.

These do not block implementation of the accepted shared-state, configurable-ladder architecture.

## 12. Principal references

- Anki. [Getting Started: cards, notes and card types](https://docs.ankiweb.net/getting-started.html).
- Anki. [Deck Options: burying, legacy multipliers and FSRS](https://docs.ankiweb.net/deck-options.html).
- Cepeda, N. J., et al. (2008). [Spacing effects in learning: a temporal ridgeline of optimal retention](https://pubmed.ncbi.nlm.nih.gov/19076480/).
- Laufer, B., & Goldstein, Z. (2004). [Testing Vocabulary Knowledge: Size, Strength, and Computer Adaptiveness](https://doi.org/10.1111/j.0023-8333.2004.00260.x).
- Open Spaced Repetition. [FSRS algorithm](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm).
- Pimsleur. [The Pimsleur Method](https://www.pimsleur.com/the-pimsleur-method/).
- Settles, B., & Meeder, B. (2016). [A Trainable Spaced Repetition Model for Language Learning](https://research.duolingo.com/papers/settles.acl16.pdf).
- Wozniak, P. A. [SuperMemo 2 algorithm](https://super-memory.com/english/ol/sm2.htm).

