// Test-only bindings added in vitest.config.ts.
declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
    // Scratch D1 for the 0001 → 0002 migration test; never migrated by setup.
    MIGRATION_DB: D1Database;
  }
}
