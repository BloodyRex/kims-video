// Temporary strategy test — compare upcoming-movie data sources for the "即将上映" slot.
// Run ONLY via the test-upcoming-strategies.yml workflow (has TMDB_API_READ_ACCESS_TOKEN).
// Delete this file + the workflow after the test.
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
  const perPage = [];
  for (let p = 1; p <= pages; p++) {
    const d = await fetchTMDB(path, { ...params, page: p, language: "zh-CN" });
    const results = d.results || [];
    if (!results.length) break;
    let added = 0;
    for (const it of results) {
      if (!seen.has(it.id)) { seen.add(it.id); all.push(it); added++; }
    }
    perPage.push({ page: p, raw: results.length, addedNew: added, totalSoFar: all.length });
    if (results.length < 20) break; // last page
  }
  return { all, perPage };
}

// Simulate Worker upcoming filter: release>=today, title has Chinese, ratingOk
function filterUpcoming(items) {
  return items
    .filter(m => m.release_date && m.release_date >= today)
    .filter(m => hasChinese(m.title))
    .filter(ratingOk);
}

function summarize(label, { all, perPage }, extraFilter = null) {
  const cand = filterUpcoming(all);
  const withOv = cand.filter(m => hasChinese(m.overview)); // pipeline-level: title OR overview
  const dates = cand.map(m => m.release_date).sort();
  console.log(`\n===== ${label} =====`);
  console.log("pages:", JSON.stringify(perPage));
  console.log(`raw total: ${all.length}`);
  console.log(`filtered (release>=today + titleCn + ratingOk): ${cand.length}`);
  console.log(`  of which overview also Chinese: ${withOv.length}`);
  console.log(`release range: ${dates[0] || "-"} ~ ${dates[dates.length - 1] || "-"}`);
  console.log("titles:", cand.slice(0, 25).map(m => `${m.release_date}|${m.title}|${m.vote_average ?? "-"}`).join(" ; "));
  return cand;
}

(async () => {
  // ── Strategy A: current production (4 pages) — baseline ──
  const cur = await fetchPages("/movie/upcoming", {}, 4);
  const curCand = summarize("A: /movie/upcoming 4 pages (CURRENT)", cur);
  const curIds = new Set(curCand.map(m => m.id));

  // ── Strategy 2: /movie/upcoming 10 pages ──
  const s2 = await fetchPages("/movie/upcoming", {}, 10);
  const s2Cand = summarize("2: /movie/upcoming 10 pages", s2);
  const s2New = s2Cand.filter(m => !curIds.has(m.id));
  console.log(`  >> vs current: ${s2New.length} NEW titles not in 4-page result`);

  // ── Strategy 3a: /discover/movie primary_release_date.gte=today, no upper bound ──
  const s3a = await fetchPages("/discover/movie", { "primary_release_date.gte": today, "sort_by": "popularity.desc" }, 10);
  const s3aCand = summarize("3a: /discover/movie gte=today (unbounded) 10 pages", s3a);
  const s3aNew = s3aCand.filter(m => !curIds.has(m.id));
  console.log(`  >> vs current: ${s3aNew.length} NEW; vs strategy2: ${s3aCand.filter(m => !new Set(s2Cand.map(x=>x.id)).has(m.id)).length} NEW`);

  // ── Strategy 3b: /discover/movie + lte=today+180d window ──
  const plus180 = new Date(Date.now() + 180 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  const s3b = await fetchPages("/discover/movie", { "primary_release_date.gte": today, "primary_release_date.lte": plus180, "sort_by": "popularity.desc" }, 10);
  const s3bCand = summarize("3b: /discover/movie 180d window 10 pages", s3b);
  const s3bNew = s3bCand.filter(m => !curIds.has(m.id));
  console.log(`  >> vs current: ${s3bNew.length} NEW`);

  console.log("\n===== DONE =====");
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });
