// Temp test #6 — scoring-based selection for movies+TV upcoming (pop + zh bonus).
// Delete after run. Simulates: score = w_pop*S_pop + w_zh*S_zh, take top 15.
const TOKEN = process.env.TMDB_API_READ_ACCESS_TOKEN;
if (!TOKEN) { console.error("NO TOKEN"); process.exit(1); }
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
const hasChinese = (t) => /[\u4e00-\u9fff]/.test(t || "");

async function fetchTMDB(path, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const r = await fetch(url, { headers: H });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}

async function fetchPages(path, params = {}, pages) {
  const all = [], seen = new Set();
  for (let p = 1; p <= pages; p++) {
    const d = await fetchTMDB(path, { ...params, page: p, language: "zh-CN" });
    const results = d.results || [];
    if (!results.length) break;
    for (const it of results) if (!seen.has(it.id)) { seen.add(it.id); all.push(it); }
    if (results.length < 20) break;
  }
  return all;
}

const plus = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });

// zh score: title +50 if Chinese, overview +50 if Chinese (0-100)
const zhScore = (it) => (hasChinese(it.title || it.name) ? 50 : 0) + (hasChinese(it.overview) ? 50 : 0);

function selectByScore(items, wPop, wZh, cap = 15) {
  const maxPop = Math.max(...items.map(m => m.popularity || 0), 1);
  const minPop = Math.min(...items.map(m => m.popularity || 0), 0);
  const popRange = Math.max(maxPop - minPop, 1);
  const scored = items.map(m => {
    const S_pop = Math.min(100, Math.max(0, ((m.popularity || 0) - minPop) / popRange * 100));
    const S_zh = zhScore(m);
    const score = (wPop * S_pop + wZh * S_zh) / 100;
    return { m, score, S_pop, S_zh };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, cap);
}

function report(label, cand, wPop, wZh) {
  const top = selectByScore(cand, wPop, wZh);
  const zhT = top.filter(x => hasChinese(x.m.title || x.m.name)).length;
  const zhO = top.filter(x => hasChinese(x.m.overview)).length;
  const fullZh = top.filter(x => hasChinese(x.m.title || x.m.name) && hasChinese(x.m.overview)).length;
  const avgPop = top.reduce((s, x) => s + (x.m.popularity || 0), 0) / top.length;
  console.log(`\n[${label}] wPop=${wPop} wZh=${wZh} → shown ${top.length} | zhTitle ${zhT} | zhOverview ${zhO} | fullZh ${fullZh} | avgPop ${avgPop.toFixed(1)}`);
  console.log("  " + top.map(x => `${(x.m.release_date || x.m.first_air_date || "")}|${x.m.title || x.m.name}|pop:${Math.round(x.m.popularity || 0)}|zh:${x.S_zh}`).join(" ; "));
  return top;
}

(async () => {
  // ── MOVIES: 90d 10p, NO zh filter (scoring replaces it) ──
  const mRaw = await fetchPages("/discover/movie", { "primary_release_date.gte": today, "primary_release_date.lte": plus(90), "sort_by": "popularity.desc" }, 10);
  const mCand = mRaw.filter(m => m.release_date && m.release_date >= today);
  console.log(`MOVIES candidates (no zh filter): ${mCand.length} | zhTitle ${mCand.filter(m => hasChinese(m.title)).length} | zhOverview ${mCand.filter(m => hasChinese(m.overview)).length}`);

  // ── TV: 90d 5p, NO zh/en filter (scoring replaces it) ──
  const tRaw = await fetchPages("/discover/tv", { "first_air_date.gte": today, "first_air_date.lte": plus(90), "sort_by": "popularity.desc" }, 5);
  const tCand = tRaw.filter(s => s.first_air_date && s.first_air_date >= today);
  console.log(`TV candidates (no zh filter): ${tCand.length} | zhTitle ${tCand.filter(s => hasChinese(s.title || s.name)).length} | zhOverview ${tCand.filter(s => hasChinese(s.overview)).length}`);

  // ── Score weight sweep (cap 15) ──
  console.log("\n===== MOVIE weight sweep =====");
  for (const [wp, wz] of [[0.7, 0.3], [0.6, 0.4], [0.5, 0.5], [0.4, 0.6]]) {
    report("MOVIES", mCand, wp, wz);
  }
  console.log("\n===== TV weight sweep =====");
  for (const [wp, wz] of [[0.7, 0.3], [0.6, 0.4], [0.5, 0.5], [0.4, 0.6]]) {
    report("TV", tCand, wp, wz);
  }

  // ── Full candidate popularity distribution (for threshold context) ──
  const mp = mCand.map(m => m.popularity || 0).sort((a, b) => b - a);
  const tp = tCand.map(m => m.popularity || 0).sort((a, b) => b - a);
  console.log("\nmovie pop: top5", mp.slice(0, 5).map(x => x.toFixed(1)).join(","), "| median", mp[Math.floor(mp.length / 2)].toFixed(1), "| p25", mp[Math.floor(mp.length * 0.25)].toFixed(1));
  console.log("tv    pop: top5", tp.slice(0, 5).map(x => x.toFixed(1)).join(","), "| median", tp[Math.floor(tp.length / 2)].toFixed(1), "| p25", tp[Math.floor(tp.length * 0.25)].toFixed(1));
  console.log("\n===== DONE =====");
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });
