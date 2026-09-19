// Shared by vitest.config.ts (as a binding) and the Worker tests, so tests never depend on
// whatever is in .dev.vars.
export const TEST_UNLOCK_SECRET = "test-unlock-secret-not-for-real-use-0123";

// Stands in for OPENAI_API_KEY; the voice tests stub fetch, so it never reaches OpenAI.
export const TEST_OPENAI_KEY = "sk-test-openai-key-not-for-real-use";
