import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import { TEST_UNLOCK_SECRET } from "./test/constants";

export default defineConfig({
  test: {
    // Bounded worker pool: Vitest otherwise defaults to all 16 logical cores, and
    // several agents running the suite at once saturated the workstation.
    // Keep this in the config (not a CLI flag) so every invocation is capped.
    maxWorkers: 2,
    projects: [
      {
        test: {
          name: "shared",
          environment: "node",
          include: ["shared/**/*.test.ts"],
        },
      },
      {
        // Node-side scripts: the Airtable CSV mapping is pure and needs no Workers runtime,
        // so it runs here rather than paying the pool's startup cost.
        test: {
          name: "scripts",
          environment: "node",
          include: ["scripts/**/*.test.ts"],
        },
      },
      {
        plugins: [
          cloudflareTest(async () => ({
            wrangler: { configPath: "./wrangler.jsonc" },
            miniflare: {
              bindings: {
                TEST_MIGRATIONS: await readD1Migrations("./migrations"),
                // Overrides .dev.vars; test/auth.test.ts asserts the override took effect.
                UNLOCK_SECRET: TEST_UNLOCK_SECRET,
              },
            },
          })),
        ],
        test: {
          name: "worker",
          include: ["test/**/*.test.ts"],
          setupFiles: ["./test/apply-migrations.ts"],
        },
      },
    ],
  },
});
