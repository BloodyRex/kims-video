// Bilingual verification v2 — direct-call pattern proven by probe-digest.cjs
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
  const now = intelToday ? null : null; // placeholder, unused
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  const zh = renderDigestHtml(d, todayStr, "zh");
  const en = renderDigestHtml(d, todayStr, "en");
  const h2 = (html) => (html.match(/<h2[^>]*>([^<]*)<\/h2>/) || [])[1] || "";
  console.log("raw headlineEn:", JSON.stringify(d.dig.headlineEn));
  console.log("wall delta movies:", (d.wallDelta.movies || []).length, "| tv:", (d.tvWallDelta.shows || []).length);

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
    };
    if (!isEn) {
      c["h2 is zh"] = /[\u4e00-\u9fff]/.test(h2(html));
    } else {
      c["h2 is en"] = h2(html).length > 0 && !/[\u4e00-\u9fff]/.test(h2(html));
      c["en summary present"] = !!d.dig.summaryEn && html.includes(d.dig.summaryEn.slice(0, 40));
    }
    // Wall section: present iff live delta has entries
    const deltaCount = (d.wallDelta.movies || []).length + (d.tvWallDelta.shows || []).length;
    c[`wall section ${deltaCount > 0 ? "present" : "absent"} (delta=${deltaCount})`] =
      deltaCount > 0 ? html.includes(isEn ? "NEW ON THE WALL" : "影视墙今日新增")
                      : !html.includes("NEW ON THE WALL") && !html.includes("影视墙今日新增");
    let ok = true;
    console.log(`\n--- ${label} ---`);
    for (const [k, v] of Object.entries(c)) {
      console.log(`${v ? "PASS" : "FAIL"}  ${k}`);
      if (!v) ok = false;
    }
    return ok;
  };

  const a = checks("ZH", zh.html, false);
  const b = checks("EN", en.html, true);
  fs.writeFileSync("digest-preview.html", zh.html);
  fs.writeFileSync("digest-preview-en.html", en.html);
  console.log(a && b ? "\n=== ALL BILINGUAL CHECKS PASSED ===" : "\n=== FAILURES ===");
  process.exit(a && b ? 0 : 1);
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
