// Topics and coverage quotas (f18, DECISIONS 261006a): the single source of truth for the fixed
// topic list. Every vocab item has at most one `topic` from here and a CEFR level; `tags` holds
// 0–2 secondary slugs from the same list. The Worker validates against it, the client shows it,
// and the prompts quote its scope lines. Order is display order; the slug is the identity, so
// topics can be reordered freely, but renaming a slug needs a migration of `vocab.topic`.
//
// Quotas are coverage targets per level (not cumulative), not a curriculum: about 2,575 words to
// B1, after the usual 2,500–3,000 for European languages (no CEFR list exists for Urdu).

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

// Levels that carry quotas; B2 and above are counted but have no target yet.
export const QUOTA_LEVELS = ["A1", "A2", "B1"] as const;
export type QuotaLevel = (typeof QUOTA_LEVELS)[number];

export type TopicSectionId = (typeof TOPIC_SECTIONS)[number]["id"];

export type Topic = {
  slug: string;
  label: string;
  section: TopicSectionId;
  // What belongs here, quoted in prompts.
  scope: string;
  quota: Readonly<Record<QuotaLevel, number>>;
};

export const TOPIC_SECTIONS = [
  { id: "grammar", label: "Grammar & function words" },
  { id: "talking", label: "Talking" },
  { id: "people", label: "People & self" },
  { id: "daily", label: "Daily life" },
  { id: "time", label: "Time, space & quantity" },
  { id: "society", label: "Society & world" },
  { id: "describing", label: "Describing & reasoning" },
] as const;

export const TOPICS: readonly Topic[] = [
  {
    slug: "pronouns",
    label: "Pronouns & reference",
    section: "grammar",
    scope: "I/you/he, this/that, someone, possessives, apna, khud",
    quota: { A1: 20, A2: 12, B1: 8 },
  },
  {
    slug: "questions",
    label: "Question words",
    section: "grammar",
    scope: "kya, kaun, kahan, kab, kyun, kaise, kitna",
    quota: { A1: 14, A2: 4, B1: 2 },
  },
  {
    slug: "postpositions",
    label: "Postpositions",
    section: "grammar",
    scope: "mein, par, se, tak, ke liye, ka/ki/ke, ke paas, ke andar, ke baad",
    quota: { A1: 15, A2: 20, B1: 15 },
  },
  {
    slug: "connectors",
    label: "Connectors",
    section: "grammar",
    scope: "aur, lekin, ya, kyunke, agar, to, halanke, warna",
    quota: { A1: 10, A2: 15, B1: 15 },
  },
  {
    slug: "modals",
    label: "Modals & auxiliaries",
    section: "grammar",
    scope: "sakna, chahiye, parna, chahna, lagna, hona",
    quota: { A1: 8, A2: 10, B1: 7 },
  },
  {
    slug: "compound-verbs",
    label: "Compound verbs",
    section: "grammar",
    scope: "vector verbs (kha lena, ho jana) and noun + karna/hona",
    quota: { A1: 10, A2: 30, B1: 40 },
  },
  {
    slug: "negation",
    label: "Negation & certainty",
    section: "grammar",
    scope: "nahin, mat, kabhi nahin, zaroor, shayad, yaqeenan",
    quota: { A1: 8, A2: 10, B1: 12 },
  },
  {
    slug: "adverbs",
    label: "Frequency, degree & manner",
    section: "grammar",
    scope: "hamesha, aksar, kabhi kabhi, bohat, kaafi, taqreeban",
    quota: { A1: 12, A2: 18, B1: 20 },
  },
  {
    slug: "quantifiers",
    label: "Comparison & scope",
    section: "grammar",
    scope: "zyada, kam, kaafi, sab, har, sirf, bhi, wahi, mukhtalif",
    quota: { A1: 12, A2: 13, B1: 10 },
  },
  {
    slug: "discourse",
    label: "Discourse & interjections",
    section: "grammar",
    scope: "achha, to, waise, asal mein, arey, wah, uff, haan/ji",
    quota: { A1: 10, A2: 15, B1: 15 },
  },
  {
    slug: "patterns",
    label: "Sentence patterns",
    section: "grammar",
    scope: "mujhe … chahiye, mera khayal hai, kya aap … sakte hain",
    quota: { A1: 15, A2: 15, B1: 10 },
  },
  {
    slug: "social",
    label: "Social phrases & address",
    section: "talking",
    scope: "greetings, thanks, apologies, invitations, aap/tum, ji, sahib, bhai, baji",
    quota: { A1: 25, A2: 20, B1: 15 },
  },
  {
    slug: "communication",
    label: "Speaking & language",
    section: "talking",
    scope: "bolna, poochna, samjhana, batana, maanna, behes karna",
    quota: { A1: 12, A2: 20, B1: 18 },
  },
  {
    slug: "idioms",
    label: "Idioms & proverbs",
    section: "talking",
    scope: "muhavare and common sayings",
    quota: { A1: 0, A2: 10, B1: 30 },
  },
  {
    slug: "family",
    label: "Family & kinship",
    section: "people",
    scope: "ammi, abbu, chacha, mamu, khala, phuppo, susral",
    quota: { A1: 25, A2: 20, B1: 15 },
  },
  {
    slug: "people",
    label: "People & roles",
    section: "people",
    scope: "friends, neighbours, strangers, professions, ages",
    quota: { A1: 15, A2: 25, B1: 20 },
  },
  {
    slug: "body",
    label: "Body & appearance",
    section: "people",
    scope: "body parts, looks",
    quota: { A1: 20, A2: 15, B1: 15 },
  },
  {
    slug: "health",
    label: "Health & medicine",
    section: "people",
    scope: "illness, symptoms, doctor, medicine, recovery",
    quota: { A1: 10, A2: 25, B1: 25 },
  },
  {
    slug: "feelings",
    label: "Feelings",
    section: "people",
    scope: "khush, naraz, dar, sharmindagi, pyar",
    quota: { A1: 12, A2: 23, B1: 25 },
  },
  {
    slug: "personality",
    label: "Personality & character",
    section: "people",
    scope: "honest, stubborn, generous, clever, rude",
    quota: { A1: 6, A2: 19, B1: 25 },
  },
  {
    slug: "mind",
    label: "Mind & perception",
    section: "people",
    scope: "think, remember, know, decide; see, hear, feel, notice",
    quota: { A1: 12, A2: 18, B1: 20 },
  },
  {
    slug: "actions",
    label: "Everyday actions",
    section: "daily",
    scope: "lena, dena, rakhna, kholna, intezaar karna, uthana",
    quota: { A1: 40, A2: 35, B1: 25 },
  },
  {
    slug: "motion",
    label: "Movement",
    section: "daily",
    scope: "jana, aana, baithna, khara hona, bhaagna, girna",
    quota: { A1: 20, A2: 18, B1: 12 },
  },
  {
    slug: "home",
    label: "Home & household",
    section: "daily",
    scope: "rooms, furniture, chores, household objects",
    quota: { A1: 20, A2: 30, B1: 20 },
  },
  {
    slug: "food",
    label: "Food & drink",
    section: "daily",
    scope: "ingredients, dishes, cooking, taste, eating out",
    quota: { A1: 35, A2: 35, B1: 30 },
  },
  {
    slug: "clothing",
    label: "Clothing & personal items",
    section: "daily",
    scope: "clothes, shoes, bags, jewellery, toiletries",
    quota: { A1: 15, A2: 20, B1: 15 },
  },
  {
    slug: "money",
    label: "Money & shopping",
    section: "daily",
    scope: "buying, prices, bargaining, salary, bank, rent",
    quota: { A1: 15, A2: 30, B1: 25 },
  },
  {
    slug: "travel",
    label: "Travel & transport",
    section: "daily",
    scope: "vehicles, stations, tickets, hotels, journeys",
    quota: { A1: 10, A2: 25, B1: 25 },
  },
  {
    slug: "tech",
    label: "Technology & media",
    section: "daily",
    scope: "phone, internet, TV, social media",
    quota: { A1: 8, A2: 17, B1: 15 },
  },
  {
    slug: "time",
    label: "Time & calendar",
    section: "time",
    scope: "days, months, parts of day, duration, early/late, abhi, pehle, baad mein, abhi tak",
    quota: { A1: 35, A2: 25, B1: 20 },
  },
  {
    slug: "numbers",
    label: "Numbers",
    section: "time",
    scope: "1–100 (each irregular), sau, hazaar, lakh, crore, ordinals, sava/derh/dhai/paune",
    quota: { A1: 50, A2: 45, B1: 15 },
  },
  {
    slug: "measurement",
    label: "Measurement",
    section: "time",
    scope: "weight, length, distance, volume, units",
    quota: { A1: 5, A2: 12, B1: 13 },
  },
  {
    slug: "places",
    label: "Places & getting around",
    section: "time",
    scope: "city, village, buildings, countries, asking the way",
    quota: { A1: 20, A2: 25, B1: 25 },
  },
  {
    slug: "space",
    label: "Space & position",
    section: "time",
    scope: "near/far, left/right, above/below, inside/outside",
    quota: { A1: 15, A2: 10, B1: 5 },
  },
  {
    slug: "work",
    label: "Work",
    section: "society",
    scope: "jobs, office, meetings, colleagues",
    quota: { A1: 10, A2: 25, B1: 25 },
  },
  {
    slug: "school",
    label: "School & learning",
    section: "society",
    scope: "studying, teaching, subjects, exams",
    quota: { A1: 12, A2: 20, B1: 18 },
  },
  {
    slug: "science",
    label: "Science",
    section: "society",
    scope: "matter, energy, experiments, everyday science",
    quota: { A1: 0, A2: 5, B1: 15 },
  },
  {
    slug: "nature",
    label: "Nature & animals",
    section: "society",
    scope: "land, water, plants, animals (no weather)",
    quota: { A1: 15, A2: 30, B1: 25 },
  },
  {
    slug: "weather",
    label: "Weather & seasons",
    section: "society",
    scope: "rain, heat, clouds, seasons, storms",
    quota: { A1: 8, A2: 12, B1: 10 },
  },
  {
    slug: "society",
    label: "Society & customs",
    section: "society",
    scope: "customs, weddings, hospitality, community, social issues",
    quota: { A1: 5, A2: 20, B1: 25 },
  },
  {
    slug: "government",
    label: "Government & law",
    section: "society",
    scope: "government, elections, rights, police, courts",
    quota: { A1: 0, A2: 12, B1: 28 },
  },
  {
    slug: "religion",
    label: "Religion",
    section: "society",
    scope: "prayer, belief, inshallah, mashallah, festivals of faith",
    quota: { A1: 12, A2: 18, B1: 20 },
  },
  {
    slug: "culture",
    label: "Culture & arts",
    section: "society",
    scope: "music, books, films, art, festivals",
    quota: { A1: 5, A2: 15, B1: 20 },
  },
  {
    slug: "sports",
    label: "Sports & hobbies",
    section: "society",
    scope: "games, exercise, hobbies, outdoors",
    quota: { A1: 8, A2: 17, B1: 15 },
  },
  {
    slug: "conflict",
    label: "Conflict & danger",
    section: "society",
    scope: "fighting, accidents, safety, emergencies",
    quota: { A1: 3, A2: 15, B1: 22 },
  },
  {
    slug: "qualities",
    label: "Physical qualities",
    section: "describing",
    scope: "colours, shapes, size, texture, condition",
    quota: { A1: 25, A2: 25, B1: 20 },
  },
  {
    slug: "opinions",
    label: "Opinions & judgement",
    section: "describing",
    scope: "achha/bura, zaroori, ajeeb, saaf zahir",
    quota: { A1: 15, A2: 20, B1: 25 },
  },
  {
    slug: "change",
    label: "Change & processes",
    section: "describing",
    scope: "begin, end, become, improve, break",
    quota: { A1: 5, A2: 15, B1: 20 },
  },
  {
    slug: "cause",
    label: "Cause & purpose",
    section: "describing",
    scope: "wajah, nateeja, maqsad, is liye",
    quota: { A1: 3, A2: 10, B1: 12 },
  },
  {
    slug: "abstract",
    label: "Abstract ideas",
    section: "describing",
    scope: "freedom, truth, luck, responsibility (only when nothing above fits)",
    quota: { A1: 0, A2: 12, B1: 28 },
  },
];

// Where words that could sit in two topics go; the prompts state these.
export const TOPIC_BOUNDARIES =
  "Frequency words go to adverbs; time words (already, still, yet, soon) to time; size to " +
  "qualities; money of any kind to money; weather never to nature; spatial relations to space, " +
  "places themselves to places; set social formulas to social; fillers and interjections to " +
  "discourse; verbs of speaking to communication.";

const BY_SLUG: ReadonlyMap<string, Topic> = new Map(TOPICS.map((t) => [t.slug, t]));

export function isTopic(value: unknown): value is string {
  return typeof value === "string" && BY_SLUG.has(value);
}

export function topicBySlug(slug: string): Topic | undefined {
  return BY_SLUG.get(slug);
}

// A known slug after trimming and folding case, else null.
export function topicSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim().toLowerCase();
  return BY_SLUG.has(slug) ? slug : null;
}

// A CEFR level after trimming and upper-casing, else null.
export function cefrLevel(value: unknown): CefrLevel | null {
  if (typeof value !== "string") return null;
  const level = value.trim().toUpperCase();
  return (CEFR_LEVELS as readonly string[]).includes(level) ? (level as CefrLevel) : null;
}

export function quotaTotals(): Record<QuotaLevel, number> {
  const totals = { A1: 0, A2: 0, B1: 0 };
  for (const t of TOPICS) for (const level of QUOTA_LEVELS) totals[level] += t.quota[level];
  return totals;
}
