// Temp test #3 — TV upcoming window sizing. Delete after run.
const TOKEN = process.env.TMDB_API_READ_ACCESS_TOKEN;
if (!TOKEN) { console.error("NO TOKEN"); process.exit(1); }
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
const hasChinese = (t) => /[\u4e00-\u9fff]/.test(t || "");
const ratingOk = (m) => !m.vote_average || m.vote_average >= 4;

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

// handleIntelTV upcoming filter: first_air >= today, titleCn||overviewCn, ratingOk, en||pop>=5
function filterTVCand(items) {
  return items
    .filter(s => s.first_air_date && s.first_air_date >= today)
    .filter(s => hasChinese(s.title || s.name) || hasChinese(s.overview))
    .filter(ratingOk)
    .filter(s => s.original_language === "en" || (s.popularity || 0) >= 5);
}

function dist(items) {
  const bins = { "0-7d": 0, "8-30d": 0, "31-60d": 0, "61-90d": 0, "91-180d": 0, "181d+": 0 };
  for (const m of items) {
    const d = Math.ceil((new Date(m.first_air_date) - new Date(today)) / 86400000);
    if (d <= 7) bins["0-7d"]++;
    else if (d <= 30) bins["8-30d"]++;
    else if (d <= 60) bins["31-60d"]++;
    else if (d <= 90) bins["61-90d"]++;
    else if (d <= 180) bins["91-180d"]++;
    else bins["181d+"]++;
  }
  return JSON.stringify(bins);
}

function show(label, items) {
  const cand = filterTVCand(items);
  const dates = cand.map(m => m.first_air_date).sort();
  console.log(`\n== ${label} == raw:${items.length} cand:${cand.length} range:${dates[0]||"-"}~${dates[dates.length-1]||"-"} dist:${dist(cand)}`);
  console.log("  " + cand.slice(0, 20).map(m => `${m.first_air_date}|${m.title || m.name}|pop:${Math.round(m.popularity||0)}`).join(" ; "));
  return cand;
}

(async () => {
  const plus = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });

  // Baseline: current tv.json upcoming (30d, 5 pages)
  const base = await fetchPages("/discover/tv", { "first_air_date.gte": today, "first_air_date.lte": plus(30), "sort_by": "popularity.desc" }, 5);
  const baseCand = show("A: discover/tv 30d x5p (CURRENT)", base);
  const baseIds = new Set(baseCand.map(m => m.id));

  // Window sweep at 10 pages
  for (const days of [60, 90, 120, 180]) {
    const items = await fetchPages("/discover/tv", { "first_air_date.gte": today, "first_air_date.lte": plus(days), "sort_by": "popularity.desc" }, 10);
    const cand = show(`B: discover/tv ${days}d x10p`, items);
    const newN = cand.filter(m => !baseIds.has(m.id)).length;
    console.log(`    >> vs current(30d): ${newN} NEW`);
  }

  // 90d window at different page counts
  for (const p of [5, 10]) {
    const items = await fetchPages("/discover/tv", { "first_air_date.gte": today, "first_air_date.lte": plus(90), "sort_by": "popularity.desc" }, p);
    const cand = show(`C: discover/tv 90d x${p}p`, items);
    console.log(`    >> vs current(30d): ${cand.filter(m => !baseIds.has(m.id)).length} NEW`);
  }

  // sort_by comparison for 90d window
  const byDate = await fetchPages("/discover/tv", { "first_air_date.gte": today, "first_air_date.lte": plus(90), "sort_by": "first_air_date.asc" }, 10);
  const dateCand = show("D: discover/tv 90d x10p sort=first_air_date.asc", byDate);
  console.log(`    >> vs current(30d): ${dateCand.filter(m => !baseIds.has(m.id)).length} NEW`);

  console.log("\n===== DONE =====");
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });
