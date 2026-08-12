// Temp test #7 — scoring + absolute pop floor. Delete after run.
// Design: score = wPop*S_pop + wZh*S_zh; only items with popularity >= floor qualify;
// show top 15 (or fewer). Find floors that yield ~10-15 movies / ~5-15 TV.
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
const zhScore = (it) => (hasChinese(it.title || it.name) ? 50 : 0) + (hasChinese(it.overview) ? 50 : 0);

function select(items, floor, wPop, wZh, cap = 15) {
  const qual = items.filter(m => (m.popularity || 0) >= floor);
  const maxPop = Math.max(...qual.map(m => m.popularity || 0), 1);
  const minPop = Math.min(...qual.map(m => m.popularity || 0), 0);
  const popRange = Math.max(maxPop - minPop, 1);
  const scored = qual.map(m => {
    const S_pop = Math.min(100, Math.max(0, ((m.popularity || 0) - minPop) / popRange * 100));
    const S_zh = zhScore(m);
    return { m, score: (wPop * S_pop + wZh * S_zh) / 100 };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, cap);
}

function report(label, cand, floor, wPop, wZh) {
  const top = select(cand, floor, wPop, wZh);
  const zhT = top.filter(x => hasChinese(x.m.title || x.m.name)).length;
  const fullZh = top.filter(x => hasChinese(x.m.title || x.m.name) && hasChinese(x.m.overview)).length;
  const avgPop = top.reduce((s, x) => s + (x.m.popularity || 0), 0) / Math.max(top.length, 1);
  console.log(`[${label}] floor=${floor} → shown ${top.length} | zhTitle ${zhT} | fullZh ${fullZh} | avgPop ${avgPop.toFixed(1)}`);
  if (floor >= 0 && (label.includes("MOVIE floor=15") || label.includes("MOVIE floor=20") || label.includes("TV floor=5") || label.includes("TV floor=8"))) {
    console.log("   " + top.map(x => `${(x.m.release_date || x.m.first_air_date || "")}|${x.m.title || x.m.name}|pop:${Math.round(x.m.popularity || 0)}|zh:${zhScore(x.m)}`).join(" ; "));
  }
}

(async () => {
  const mRaw = await fetchPages("/discover/movie", { "primary_release_date.gte": today, "primary_release_date.lte": plus(90), "sort_by": "popularity.desc" }, 10);
  const mCand = mRaw.filter(m => m.release_date && m.release_date >= today);
  const tRaw = await fetchPages("/discover/tv", { "first_air_date.gte": today, "first_air_date.lte": plus(90), "sort_by": "popularity.desc" }, 5);
  const tCand = tRaw.filter(s => s.first_air_date && s.first_air_date >= today);
  console.log(`raw candidates: movies ${mCand.length}, tv ${tCand.length}`);

  console.log("\n===== MOVIES: floor sweep (wPop=0.6 wZh=0.4) =====");
  for (const f of [0, 5, 10, 15, 20, 25, 30]) report("MOVIE", mCand, f, 0.6, 0.4);
  console.log("\n===== MOVIES: floor 15, weight variants =====");
  for (const [wp, wz] of [[0.7, 0.3], [0.6, 0.4], [0.5, 0.5]]) report("MOVIE floor=15", mCand, 15, wp, wz);

  console.log("\n===== TV: floor sweep (wPop=0.6 wZh=0.4) =====");
  for (const f of [0, 3, 5, 8, 10, 12]) report("TV", tCand, f, 0.6, 0.4);
  console.log("\n===== TV: floor 5, weight variants =====");
  for (const [wp, wz] of [[0.7, 0.3], [0.6, 0.4], [0.5, 0.5]]) report("TV floor=5", tCand, 5, wp, wz);

  console.log("\n===== DONE =====");
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });
