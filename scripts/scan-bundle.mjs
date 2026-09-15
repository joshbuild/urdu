// FR-B4 guard: fail if the built client bundle contains secret names or the local dev secret.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const clientDir = "dist/client";
const needles = ["UNLOCK_SECRET", "OPENAI_API_KEY", "COACH_TOKEN"];

try {
  const devVars = readFileSync(".dev.vars", "utf8");
  for (const line of devVars.split(/\r?\n/)) {
    const match = line.match(/^\s*[A-Z0-9_]+\s*=\s*"?([^"]+)"?\s*$/);
    if (match?.[1] && match[1].length >= 8) needles.push(match[1]);
  }
} catch {
  // No .dev.vars: scan for names only.
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

const hits = [];
for (const path of files(clientDir)) {
  const text = readFileSync(path, "latin1");
  needles.forEach((needle, i) => {
    if (text.includes(needle)) hits.push(`${path}: ${i < 3 ? needle : "a .dev.vars value"}`);
  });
}

if (hits.length) {
  console.error(`Secret scan failed:\n${hits.join("\n")}`);
  process.exit(1);
}
console.log(`Secret scan: clean (${clientDir})`);
