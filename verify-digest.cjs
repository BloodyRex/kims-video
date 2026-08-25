// Local verification: extract buildDigestHTML from workers-1.4.js and render the new template
const fs = require("fs");
const src = fs.readFileSync("workers-1.4.js", "utf-8");

// Extract intelToday + buildDigestHTML (self-contained: only uses fetch + intelToday)
const intelToday = src.match(/function intelToday\(\) \{[^\r\n]+\}/)[0];
const fnStart = src.indexOf("async function buildDigestHTML");
const fnEnd = src.indexOf("async function handleSendDigest");
const buildFn = src.slice(fnStart, fnEnd);

// Sandbox-eval both
const sandbox = {};
const fn = new Function("fetch", `${intelToday}\n${buildFn}\nreturn buildDigestHTML;`);
const buildDigestHTML = fn(fetch);

(async () => {
  const result = await buildDigestHTML({}, "2026-08-25");
  console.log("=== buildDigestHTML OK ===");
  console.log("date:", result.date);
  console.log("headline:", result.headline);
  console.log("html length:", result.html.length);
  // Checks
  const checks = {
    "w185 poster (URL-encoded via poster-proxy)": result.html.includes("%2Fw185%2F"),
    "industry highlights present": result.html.includes("<li style=\"font-size:11px;color:#aaa"),
    "movie detail link (from=digest&r=)": /from=digest&r=\d+/.test(result.html),
    "tv detail link (type=tv)": /from=digest&r=\d+&type=tv/.test(result.html),
    "UTM on coming": result.html.includes("intelligence/coming?utm_source=digest"),
    "UTM on movies": result.html.includes("intelligence/movies?utm_source=digest"),
    "UTM on tv": result.html.includes("intelligence/tv?utm_source=digest"),
    "UTM on music": result.html.includes("intelligence/music?utm_source=digest"),
    "UTM on CTA": result.html.includes("/intelligence?utm_source=digest"),
    "header shows send date 2026-08-25": result.html.includes("KIM'S VIDEO · 2026-08-25"),
    "subtitle data-until (shown when data day != send day)": result.html.includes("数据截至") || result.date === "2026-08-25",
    "92px poster card": result.html.includes("width:92px;height:138px"),
  };
  let allOk = true;
  for (const [k, v] of Object.entries(checks)) {
    console.log(`${v ? "PASS" : "FAIL"}  ${k}`);
    if (!v) allOk = false;
  }
  // Save rendered HTML for preview
  fs.writeFileSync("digest-preview.html", result.html);
  console.log(allOk ? "\n=== ALL CHECKS PASSED ===" : "\n=== SOME CHECKS FAILED ===");
  console.log("Preview saved: digest-preview.html");
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
