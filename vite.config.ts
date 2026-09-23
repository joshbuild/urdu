import { execSync } from "node:child_process";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The commit a build came from, shown under Settings › About so a deployed app can be matched
// against the repo. Empty when git is unavailable.
function git(args: string): string {
  try {
    return execSync(`git ${args}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

const build = {
  commit: git("rev-parse --short HEAD") || "unknown",
  committedAt: git("log -1 --format=%cI"),
  dirty: git("status --porcelain") !== "",
  builtAt: new Date().toISOString(),
};

export default defineConfig({
  plugins: [react(), cloudflare()],
  define: { __BUILD__: JSON.stringify(build) },
});
