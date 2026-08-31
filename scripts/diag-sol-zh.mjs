// TMP: what does the WORKER actually receive for trending page2 under zh-CN?
// The real worker uses intelFetchTMDB with language=zh-CN as PRIMARY (en only for _titleEn/_overviewEn).
// So check: with language=zh-CN, does 207333 get a Chinese name/overview?
const token = process.env.TMDB;
const h = { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } };
const hasCn = (t) => /[\u4e00-\u9fff]/.test(t || "");
(async () => {
  // zh-CN primary fetch (mirrors worker)
  const r = await fetch("https://api.themoviedb.org/3/trending/tv/week?page=2&language=zh-CN", h);
  const d = await r.json();
  const item = (d.results || []).find(x => x.id === 207333);
  if (!item) { console.log("207333 NOT on page2 lang=zh-CN"); }
  else {
    console.log("=== 207333 @ trending/tv/week page2, language=zh-CN ===");
    console.log(`  name="${item.name}" | cnName=${hasCn(item.name)}`);
    console.log(`  original_name="${item.original_name}"`);
    console.log(`  overview="${(item.overview||"").slice(0,100)}" | cnOverview=${hasCn(item.overview||"")}`);
    console.log(`  lang=${item.original_language} | pop=${item.popularity} | rate=${item.vote_average}`);
    // cnFilter as worker uses: hasChinese(title) && hasChinese(overview)
    const cnT = hasCn(item.name); const cnO = hasCn(item.overview || "");
    console.log(`  => cnFilter(title&&overview) = ${cnT && cnO ? "PASS" : "FAIL"}`);
    console.log(`  => cnFilter_OR(title||overview) = ${cnT || cnO ? "PASS" : "FAIL"}`);
  }
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });