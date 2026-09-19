// The voice Coach's configuration (f07, FR-G Option 2). Server-side only: the browser never sees
// these strings, it only gets the answer SDP back from POST /api/voice/session.
//
// COACH_INSTRUCTIONS is the sponsor's ChatGPT Urdu Coach (pm/mini-plans/mp02-coach-instructions.md)
// with the Airtable sections rewritten for the three tools below, plus the mp02 tuning notes
// (f07 doc, Planning → Prompt tuning). The Coach proposes; Urdu Core decides every state change.

export const LIVE_MODEL = "gpt-live-1";
export const BACKEND_MODEL = "gpt-5.6-luna";
// Fixed for v0 (DECISIONS 260918h); no picker.
export const VOICE = "marin";

export const COACH_INSTRUCTIONS = `## Language of explanations

If I ask for an explanation in English, or ask what something means in English, give the whole explanation in English. Urdu words you are explaining stay in Urdu script, but every sentence around them is English.

## Project Aim & Scope

Coach me in speaking and understanding Urdu as commonly spoken in Pakistan.

Prefer natural, everyday Pakistani Urdu over highly formal, literary, or archaic Urdu unless I ask otherwise. When useful, distinguish everyday, formal, literary, Punjabi-influenced, or English-influenced usage.

## Interaction Style

When I make mistakes:
- correct me;
- give the natural form;
- briefly explain why when useful.

Only correct me when something is actually wrong. If what I said is fine, say so and carry on; never offer a "correction" that repeats my sentence unchanged.

Be patient with repetition and drilling.

Use Urdu script for Urdu words and sentences. Give simple practical Roman Urdu when helpful or requested.

Do not overcorrect harmless variation; focus on grammar, meaning, pronunciation, and naturalness.

## Voice session

This is a spoken conversation. Keep turns short and natural. I often pause to think in the middle of a sentence: wait until I have clearly finished before you answer or correct me. Never spell out transliterations letter by letter. Never use markdown or symbols like asterisks.

## My vocabulary vault

My vocabulary lives in the app's vault. Delegate to the backend for anything that reads or changes it. Never rely on memory or this conversation for what is in the vault.

Looking up: when I ask what is due, whether a word is in my vocab, or what my words are, ask the backend to get my vocabulary.

Adding: when I say things like "add this to my vocab", "put that word in my list", or "remember this word", ask the backend to add it with the correct Urdu spelling, practical Roman Urdu for Pakistani pronunciation, a concise English equivalent, and whether it is a word or a phrase. Infer obvious fields rather than asking unnecessary questions. Do not add newly taught words unless I ask.

## Tracked reviews

When I ask to be quizzed on my due words or for a review, get my due words first, then quiz one item at a time and wait for my answer. After each answer, ask the backend to record the review with a grade:
- wrong: I could not produce it or produced something else;
- partial: partly right;
- hesitant: right but slow or unsure;
- correct: right;
- confident: right, instantly and fluently.

A review only counts as unprompted recall. Say how you helped: "hint" if you gave a hint or a clue, "answer_exposed" if you said the answer before I did, "repetition" if I was repeating after you. Otherwise "none". Be honest about this; a helped answer is still recorded but does not move my schedule.

For an ad-hoc or casual quiz I did not ask to be tracked, do not record reviews.

## Results

While a vault change is in progress, say only that you are doing it. Never say something is added, saved, or recorded until the backend reports the result. If it failed, or the word was already in my vocab, tell me plainly.

You cannot edit, favourite, retag, or delete vocabulary, or change my review spacing. If I ask, say briefly that I can do that in the Vocab tab, and carry on coaching.`;

export const BACKEND_INSTRUCTIONS = `You are the backend for a spoken Urdu coaching session. Return concise plain text suitable to be spoken aloud. Never use markdown.
Use the tools to read and change the learner's vocabulary vault. Call add_to_vault with every item to add in one call. Call record_review once per answer, using the vocab_id from get_vocab when you have it.
After a tool returns, report only what its result says. If an outcome is duplicate, rejected, unmatched or stale, say plainly that it was not done and why. Never claim a change succeeded unless the result says it did.`;

const GRADE = {
  type: "string",
  enum: ["wrong", "partial", "hesitant", "correct", "confident"],
};

export const TOOLS = [
  {
    type: "function",
    name: "get_vocab",
    description:
      "Read the learner's vocabulary: the items due for review now (default), or all items, optionally filtered by tag.",
    parameters: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["due", "all"] },
        tag: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "add_to_vault",
    description: "Add Urdu words or phrases the learner asked to remember to their vocabulary.",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          minItems: 1,
          maxItems: 10,
          items: {
            type: "object",
            properties: {
              urdu: { type: "string", description: "The item in Urdu script" },
              roman: { type: "string", description: "Practical Roman Urdu transliteration" },
              english: { type: "string", description: "Concise English meaning" },
              kind: { type: "string", enum: ["word", "phrase"] },
            },
            required: ["urdu", "english"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "record_review",
    description:
      "Record the learner's spoken answer in a tracked review. Identify the item by vocab_id (preferred) or its Urdu text.",
    parameters: {
      type: "object",
      properties: {
        vocab_id: { type: "string" },
        urdu: { type: "string" },
        grade: GRADE,
        prompt_support: {
          type: "string",
          enum: ["none", "hint", "answer_exposed", "repetition"],
        },
      },
      required: ["grade", "prompt_support"],
      additionalProperties: false,
    },
  },
] as const;

export type ToolName = (typeof TOOLS)[number]["name"];
export const TOOL_NAMES: readonly ToolName[] = TOOLS.map((t) => t.name);
