// Temp test #2 — window sizing for the upcoming slot. Delete after run.
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

// Worker-style filter: release>=today, titleCn OR overviewCn (relaxed), ratingOk
function filterCand(items) {
  return items
    .filter(m => m.release_date && m.release_date >= today)
    .filter(m => hasChinese(m.title) || hasChinese(m.overview))
    .filter(ratingOk);
}

function dist(items) {
  const bins = { "0-7d": 0, "8-30d": 0, "31-60d": 0, "61-90d": 0, "91d+": 0 };
  for (const m of items) {
    const d = Math.ceil((new Date(m.release_date) - new Date(today)) / 86400000);
    if (d <= 7) bins["0-7d"]++;
    else if (d <= 30) bins["8-30d"]++;
    else if (d <= 60) bins["31-60d"]++;
    else if (d <= 90) bins["61-90d"]++;
    else bins["91d+"]++;
  }
  return JSON.stringify(bins);
}

function show(label, items) {
  const cand = filterCand(items);
  const dates = cand.map(m => m.release_date).sort();
  console.log(`\n== ${label} == raw:${items.length} cand:${cand.length} range:${dates[0]||"-"}~${dates[dates.length-1]||"-"} dist:${dist(cand)}`);
  console.log("  " + cand.slice(0, 20).map(m => `${m.release_date}|${m.title}`).join(" ; "));
  return cand;
}

(async () => {
  const cur = await fetchPages("/movie/upcoming", {}, 4);
  const curCand = show("A: upcoming 4p (CURRENT)", cur);
  const curIds = new Set(curCand.map(m => m.id));

  const plus = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });

  // Windows: 60 / 90 / 120 days
  const w60 = show("2: discover 60d", await fetchPages("/discover/movie", { "primary_release_date.gte": today, "primary_release_date.lte": plus(60), "sort_by": "popularity.desc" }, 10));
  const w90 = show("3: discover 90d", await fetchPages("/discover/movie", { "primary_release_date.gte": today, "primary_release_date.lte": plus(90), "sort_by": "popularity.desc" }, 10));
  const w120 = show("4: discover 120d", await fetchPages("/discover/movie", { "primary_release_date.gte": today, "primary_release_date.lte": plus(120), "sort_by": "popularity.desc" }, 10));

  // Hybrid: upcoming 4p + discover 90d merged
  const hybrid = [...cur, ...w90];
  const merged = [...new Map(hybrid.map(m => [m.id, m])).values()];
  const hybridCand = show("5: HYBRID upcoming4p + discover90d (dedup)", merged);
  console.log(`  hybrid vs current: ${hybridCand.filter(m => !curIds.has(m.id)).length} NEW`);

  // Simulate "next day" change: drop today-released, add tomorrow window (rough estimate)
  console.log("\n-- daily change estimate for 90d window --");
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  const tmrWindow = await fetchPages("/discover/movie", { "primary_release_date.gte": tomorrow, "primary_release_date.lte": plus(91), "sort_by": "popularity.desc" }, 10);
  const tmrCand = filterCand(tmrWindow);
  const todayIds = new Set(w90Cand().map(m => m.id));
  function w90Cand() { return filterCand(w90); }
  const dropped = [...w90Cand()].filter(m => m.release_date === today);
  const newIn = tmrCand.filter(m => !todayIds.has(m.id));
  console.log(`  today's window: ${w90Cand().length}; tomorrow: releases today drop (~${dropped.length}), new entries: ${newIn.length}`);

  console.log("\n===== DONE =====");
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });
