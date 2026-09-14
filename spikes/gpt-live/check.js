// Syntax-check the inline page script and the manifest. Run: node spikes/gpt-live/check.js
const fs = require("fs");
const html = fs.readFileSync(`${__dirname}/index.html`, "utf8");
const src = html.match(/<script>([\s\S]*)<\/script>/)[1];
new Function(src);
JSON.parse(fs.readFileSync(`${__dirname}/manifest.webmanifest`, "utf8"));
console.log("gpt-live index.html script parses; manifest is valid JSON");
