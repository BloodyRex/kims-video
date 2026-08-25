// Verify bilingual digest rendering: extract fetchDigestData + renderDigestHtml + buildDigestHTML
const fs = require("fs");
const src = fs.readFileSync("workers-1.4.js", "utf-8");

const intelToday = src.match(/function intelToday\(\) \{[^\r\n]+\}/)[0];
const withTimeoutFn = src.match(/\/\/ Timeout wrapper[\s\S]*?\nasync function withTimeout[\s\S]*?\n\}\r?\n/);
const start = src.indexOf("async function fetchDigestData");
const end = src.indexOf("async function handleSendDigest");
const body = src.slice(start, end);

const fn = new Function("fetch", `${intelToday}\n${withTimeoutFn ? withTimeoutFn[0] : ""}\n${body}\nreturn { buildDigestHTML };`);
const { buildDigestHTML } = fn(fetch);

(async () => {
  const r = await buildDigestHTML({}, "2026-08-25");
  console.log("=== build OK ===");
  console.log("date:", r.date, "| headline zh:", r.headline, "| en:", r.headlineEn);

  const checks = (label, html, isEn) => {
    const c = {
      "header lang": html.includes(isEn ? "Daily Entertainment Digest" : "每日影音情报摘要"),
      "digest title": html.includes(isEn ? "📰 DAILY DIGEST" : "📰 每日摘要"),
      "calendar title": html.includes(isEn ? "RELEASE CALENDAR" : "排片日历"),
      "movie picks title": html.includes(isEn ? "TODAY'S MOVIE PICKS" : "今日电影推荐"),
      "tv picks title": html.includes(isEn ? "TODAY'S TV PICKS" : "今日剧集推荐"),
      "music title": html.includes(isEn ? "THIS WEEK'S MUSIC" : "本周音乐精选"),
      "CTA text": html.includes(isEn ? "FULL INTELLIGENCE" : "查看完整情报"),
      "unsub text": html.includes(isEn ? ">Unsubscribe<" : ">取消订阅<"),
      "detail link": /from=digest&r=\d+/.test(html),
      "UTM": html.includes("utm_source=digest"),
      "wall section absent when delta=0": !html.includes("NEW ON THE WALL") && !html.includes("影视墙今日新增"),
    };
    if (!isEn) c["en headline not leaked into zh"] = !html.includes(r.headlineEn) || r.headlineEn === r.headline;
    else {
      c["en headline present"] = html.includes(r.headlineEn);
      c["no zh-only headline"] = !(r.headline !== r.headlineEn && html.includes(`>${r.headline}<`));
    }
    let ok = true;
    console.log(`\n--- ${label} ---`);
    for (const [k, v] of Object.entries(c)) {
      console.log(`${v ? "PASS" : "FAIL"}  ${k}`);
      if (!v) ok = false;
    }
    return ok;
  };

  const a = checks("ZH version", r.html, false);
  const b = checks("EN version", r.htmlEn, true);
  fs.writeFileSync("digest-preview.html", r.html);
  fs.writeFileSync("digest-preview-en.html", r.htmlEn);
  console.log(a && b ? "\n=== ALL BILINGUAL CHECKS PASSED ===" : "\n=== FAILURES ===");
  process.exit(a && b ? 0 : 1);
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
