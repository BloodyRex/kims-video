// Temp test #9 — page-count coverage for subrequest budget. Delete after run.
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

async function fetchPage(path, params = {}, page) {
  const d = await fetchTMDB(path, { ...params, page, language: "zh-CN" });
  return d.results || [];
}

const plus = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });

(async () => {
  // 1. on_the_air: cumulative candidates (pop>=80 + zh) by page
  console.log("== on_the_air cumulative (pop>=80 & zh title+overview) ==");
  let acc = [];
  for (let p = 1; p <= 4; p++) {
    const r = await fetchPage("/tv/on_the_air", {}, p);
    acc.push(...r);
    const cand = acc.filter(s => (s.popularity || 0) >= 80 && hasChinese(s.title) && hasChinese(s.overview));
    console.log(`  after page ${p}: raw ${acc.length}, pop>=80+zh ${cand.length}`);
  }
  // how many pop>=80 regardless of zh
  for (let p = 1; p <= 4; p++) {
    const r = await fetchPage("/tv/on_the_air", {}, p);
    const c = r.filter(s => (s.popularity || 0) >= 80);
    console.log(`  page ${p} alone: ${r.length} raw, ${c.length} pop>=80`);
  }

  // 2. discover/tv 90d: cumulative pop>=8 candidates by page
  console.log("\n== discover/tv 90d cumulative (pop>=8) ==");
  let acc2 = [];
  for (let p = 1; p <= 5; p++) {
    const r = await fetchPage("/discover/tv", { "first_air_date.gte": today, "first_air_date.lte": plus(90), "sort_by": "popularity.desc" }, p);
    acc2.push(...r);
    const cand = acc2.filter(s => (s.popularity || 0) >= 8);
    console.log(`  after page ${p}: raw ${acc2.length}, pop>=8 ${cand.length}`);
  }

  // 3. discover/movie 90d: cumulative pop>=15 by page
  console.log("\n== discover/movie 90d cumulative (pop>=15) ==");
  let acc3 = [];
  for (let p = 1; p <= 5; p++) {
    const r = await fetchPage("/discover/movie", { "primary_release_date.gte": today, "primary_release_date.lte": plus(90), "sort_by": "popularity.desc" }, p);
    acc3.push(...r);
    const cand = acc3.filter(m => (m.popularity || 0) >= 15);
    console.log(`  after page ${p}: raw ${acc3.length}, pop>=15 ${cand.length}`);
  }

  console.log("\n===== DONE =====");
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });
