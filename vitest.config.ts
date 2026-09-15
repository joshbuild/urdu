import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import { TEST_UNLOCK_SECRET } from "./test/constants";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "shared",
          environment: "node",
          include: ["shared/**/*.test.ts"],
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
