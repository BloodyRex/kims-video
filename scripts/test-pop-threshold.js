// Temp test #5 — popularity thresholds for movies+TV upcoming. Delete after run.
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

const plus = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });

function popDist(items, label) {
  const pops = items.map(m => m.popularity || 0).sort((a, b) => b - a);
  console.log(`\n== ${label} == n=${items.length}`);
  console.log("  top10 pop:", pops.slice(0, 10).map(p => p.toFixed(1)).join(", "));
  console.log("  median:", pops[Math.floor(pops.length / 2)]?.toFixed(1), "| p25:", pops[Math.floor(pops.length * 0.25)]?.toFixed(1));
  for (const thr of [0, 5, 10, 15, 20, 30, 50, 80]) {
    console.log(`  pop>=${thr}: ${items.filter(m => (m.popularity || 0) >= thr).length}`);
  }
  // distribution by vote_count (unreleased films usually have 0 votes)
  const vc = items.filter(m => (m.vote_count || 0) > 0).length;
  console.log(`  with vote_count>0: ${vc}`);
}

(async () => {
  // ── MOVIES: current worker logic (90d discover 10p, zh title/overview, ratingOk) ──
  const mRaw = await fetchPages("/discover/movie", { "primary_release_date.gte": today, "primary_release_date.lte": plus(90), "sort_by": "popularity.desc" }, 10);
  const mCand = mRaw
    .filter(m => m.release_date && m.release_date >= today)
    .filter(m => hasChinese(m.title) || hasChinese(m.overview))
    .filter(ratingOk);
  popDist(mCand, "MOVIES 90d 10p (current)");

  // ── TV: current worker logic (90d discover 5p, en||zh, pop>=5 for non-en) ──
  const tRaw = await fetchPages("/discover/tv", { "first_air_date.gte": today, "first_air_date.lte": plus(90), "sort_by": "popularity.desc" }, 5);
  const tCand = tRaw
    .filter(s => s.first_air_date && s.first_air_date >= today)
    .filter(intelTVFilter);
  function intelTVFilter(s) {
    if (s.original_language !== "en" && !(hasChinese(s.title || s.name) || hasChinese(s.overview))) return false;
    if (s.original_language !== "en" && (s.popularity || 0) < 5) return false;
    return ratingOk(s);
  }
  popDist(tCand, "TV 90d 5p (current)");

  // ── What the current slot renders: intelSelectDiverse count=20 (all if <20) ──
  console.log("\n===== Current final slot sizes =====");
  console.log(`movies: ${Math.min(mCand.length, 20)} (candidates ${mCand.length})`);
  console.log(`tv: ${Math.min(tCand.length, 20)} (candidates ${tCand.length})`);

  // ── Proposed: combined threshold pop>=X → how many make the final 20-slot? ──
  console.log("\n===== Final slot size after pop threshold (capped at 20) =====");
  for (const thr of [10, 15, 20, 30]) {
    const m = mCand.filter(x => (x.popularity || 0) >= thr);
    const t = tCand.filter(x => (x.popularity || 0) >= thr);
    console.log(`pop>=${thr}: movies final=${Math.min(m.length, 20)} (cand ${m.length}), tv final=${Math.min(t.length, 20)} (cand ${t.length})`);
  }
  console.log("\n===== DONE =====");
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });
