// Temp test #4 — TV filter-order hypothesis: does en||pop>=5 actually work?
// handleIntelTV applies Chinese filter FIRST, then en||pop>=5 — so EN shows without
// Chinese titles get killed before the exemption can save them. Verify.
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

function show(label, cand) {
  const dates = cand.map(m => m.first_air_date).sort();
  console.log(`\n== ${label} == cand:${cand.length} range:${dates[0]||"-"}~${dates[dates.length-1]||"-"}`);
  console.log("  " + cand.slice(0, 25).map(m => `${m.first_air_date}|${m.title || m.name}|lang:${m.original_language}|pop:${Math.round(m.popularity||0)}`).join(" ; "));
  return cand;
}

(async () => {
  const raw90 = await fetchPages("/discover/tv", { "first_air_date.gte": today, "first_air_date.lte": plus(90), "sort_by": "popularity.desc" }, 10);
  const future = raw90.filter(s => s.first_air_date && s.first_air_date >= today);

  // 1. CURRENT worker logic: zh-filter first, then en||pop>=5
  const cur = future
    .filter(s => hasChinese(s.title || s.name) || hasChinese(s.overview))
    .filter(ratingOk)
    .filter(s => s.original_language === "en" || (s.popularity || 0) >= 5);
  show("1: current (zh first, en exemption dead)", cur);

  // 2. FIXED order: en||pop>=5 exemption BEFORE zh filter (or combined)
  const fixed = future
    .filter(ratingOk)
    .filter(s => s.original_language === "en" || (s.popularity || 0) >= 5)
    .filter(s => hasChinese(s.title || s.name) || hasChinese(s.overview) || s.original_language === "en");
  show("2: exemption-first (EN auto-pass, zh required only for non-EN)", fixed);

  // 3. Same as 2 but require zh ONLY for non-EN (equivalent simplified)
  const fixed2 = future
    .filter(ratingOk)
    .filter(s => s.original_language === "en" || (s.popularity || 0) >= 5)
    .filter(s => s.original_language === "en" || hasChinese(s.title || s.name) || hasChinese(s.overview));
  show("3: en OR (zh title/overview), pop>=5 for non-en low-pop", fixed2);

  // 4. Popularity threshold variants for non-EN (pop>=5 vs pop>=20 vs any)
  for (const thr of [0, 5, 20]) {
    const v = future
      .filter(ratingOk)
      .filter(s => s.original_language === "en" || (s.popularity || 0) >= thr)
      .filter(s => s.original_language === "en" || hasChinese(s.title || s.name) || hasChinese(s.overview));
    show(`4: en OR (zh + pop>=${thr} for non-en)`, v);
  }

  // 5. language breakdown of the raw pool (why so few)
  const langCount = {};
  for (const s of future) {
    const l = s.original_language || "?";
    langCount[l] = (langCount[l] || 0) + 1;
  }
  console.log("\nraw future-TV language breakdown (90d x10p):", JSON.stringify(langCount));
  const zhTitle = future.filter(s => hasChinese(s.title || s.name)).length;
  const zhOv = future.filter(s => hasChinese(s.overview)).length;
  console.log(`raw:${future.length} zhTitle:${zhTitle} zhOverview:${zhOv}`);

  console.log("\n===== DONE =====");
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });
