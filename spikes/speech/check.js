// Syntax-check the inline script and the manifest. Run: node check.js
const fs = require("fs");
const html = fs.readFileSync(`${__dirname}/index.html`, "utf8");
const src = html.match(/<script>([\s\S]*)<\/script>/)[1];
new Function(src);
JSON.parse(fs.readFileSync(`${__dirname}/manifest.webmanifest`, "utf8"));
console.log("index.html script parses; manifest is valid JSON");
