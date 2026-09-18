// FR-B4 guard: fail if the build output leaks a secret.
//
// Two halves of the build, two different rules, because the risk differs:
//
//   dist/client — the assets Cloudflare serves to the browser. Neither a secret VALUE nor
//     a secret NAME belongs here: a name in client JS means the frontend is reaching for a
//     binding it must never see.
//   dist/urdu — the Worker bundle. Secret NAMES are expected (the Worker reads
//     `c.env.UNLOCK_SECRET`); only a baked-in VALUE is a leak.
//
// Exempt: dist/urdu/.dev.vars, the local-development sidecar the Vite plugin copies beside
// the bundle so `wrangler dev` can read it. It holds the dev secret by design and is not
// uploaded — the 2026-09-17 deploy uploaded only the dist/client assets.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SECRET_NAMES = ["UNLOCK_SECRET", "OPENAI_API_KEY", "COACH_TOKEN"];

const targets = [
  { dir: "dist/client", names: true },
  { dir: "dist/urdu", names: false, skip: new Set([join("dist", "urdu", ".dev.vars")]) },
];

const secretValues = [];
try {
  const devVars = readFileSync(".dev.vars", "utf8");
  for (const line of devVars.split(/\r?\n/)) {
    const match = line.match(/^\s*[A-Z0-9_]+\s*=\s*"?([^"]+)"?\s*$/);
    if (match?.[1] && match[1].length >= 8) secretValues.push(match[1]);
  }
} catch {
  // No .dev.vars: names only. A value scan needs a value to look for.
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

const hits = [];
const scanned = [];
for (const target of targets) {
  if (!existsSync(target.dir)) continue;
  scanned.push(target.dir);
  for (const path of files(target.dir)) {
    if (target.skip?.has(path)) continue;
    const text = readFileSync(path, "latin1");
    for (const value of secretValues) {
      if (text.includes(value)) hits.push(`${path}: a .dev.vars value`);
    }
    if (!target.names) continue;
    for (const name of SECRET_NAMES) {
      if (text.includes(name)) hits.push(`${path}: ${name}`);
    }
  }
}

if (hits.length) {
  console.error(`Secret scan failed:\n${hits.join("\n")}`);
  process.exit(1);
}
console.log(`Secret scan: clean (${scanned.join(", ")})`);
