// Probe: what does the live digest.json contain, and what do both renders produce?
const fs = require("fs");
const src = fs.readFileSync("workers-1.4.js", "utf-8");

const intelToday = src.match(/function intelToday\(\) \{[^\r\n]+\}/)[0];
const wtMatch = src.match(/async function withTimeout[\s\S]*?\n\}\r?\n/);
const start = src.indexOf("async function fetchDigestData");
const end = src.indexOf("async function handleSendDigest");
const body = src.slice(start, end);

const fn = new Function("fetch", `${intelToday}\n${wtMatch ? wtMatch[0] : ""}\n${body}\nreturn { fetchDigestData, renderDigestHtml };`);
const { fetchDigestData, renderDigestHtml } = fn(fetch);

(async () => {
  const d = await fetchDigestData();
  console.log("digest keys:", Object.keys(d.dig));
  console.log("raw headline:", JSON.stringify(d.dig.headline));
  console.log("raw headlineEn:", JSON.stringify(d.dig.headlineEn));
  const zh = renderDigestHtml(d, "2026-08-25", "zh");
  const en = renderDigestHtml(d, "2026-08-25", "en");
  const h2 = (html) => (html.match(/<h2[^>]*>([^<]*)<\/h2>/) || [])[1] || "(no h2)";
  console.log("zh render h2:", h2(zh.html));
  console.log("en render h2:", h2(en.html));
})();
