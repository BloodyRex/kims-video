// Calibration harness — ① expansion test: discover/upcoming 1 page (current) vs 3 pages.
// Faithfully replicates handleIntelTV upcoming logic (workers-1.4.js ~1735-1773) against the
// REAL TMDB pool. Pool(P1) = current 1-page pool; Pool(P3) = expanded 3-page pool. Then re-score
// both A0 (live weights 0.6/0.1/0.3, unrated 0.5) and A1 (proposed rebalance 0.5/0.05/0.45,
// unrated 0.3) to test whether a weight rebalance becomes meaningful once the pool is deep enough
// to actually compete. Run via throwaway GH workflow borrowing secrets.TMDB_API_READ_ACCESS_TOKEN.
const TOKEN = process.env.TMDB_API_READ_ACCESS_TOKEN;
const base = "https://api.themoviedb.org/3";
const h = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

function today() { return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }); }
const hasZh = (t) => /[\u4e00-\u9fff]/.test(t || "");
const titleCn = (s) => hasZh(s.title ?? s.name);
const ovZh = (s) => hasZh(s.overview);
const intelRatingOk = (m) => !m.vote_average || m.vote_average >= 4;

async function discoverPages(token, path, params, pages) {
  const all = []; const seen = new Set();
  for (let p = 1; p <= pages; p++) {
    const url = new URL(base + path);
    Object.entries({ ...params, page: p }).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    url.searchParams.set("language", "zh-CN");
    const r = await fetch(url, { headers: h });
    if (!r.ok) throw new Error(`TMDB ${path} p${p}: ${r.status}`);
    const res = (await r.json()).results || [];
    if (!res.length) break;
    for (const it of res) if (!seen.has(it.id)) { seen.add(it.id); all.push(it); }
  }
  return all;
}

const NOW = today();
const t905 = new Date(Date.now() + 90 * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
const disc3 = await discoverPages(TOKEN, "/discover/tv", {
  "first_air_date.gte": NOW, "first_air_date.lte": t905, "sort_by": "popularity.desc",
}, 3);

// Gate once up front (worker passes all 3 pages through the same filter)
const gatedAll = disc3.filter(s => s.first_air_date && s.first_air_date > NOW).filter(intelRatingOk).filter(s => titleCn(s) || ovZh(s));
// Pool(P1): current 1-page behavior ≈ the first ~7 zh-visible gated items (live observed = 7).
// Pool(P3): expanded 3-page pool. Keep discover's NATURAL page order (worker does NOT re-sort
// the gated pool by popularity — scoreUpcoming only sorts by score, ties preserve page order).
const pool1 = gatedAll.slice(0, 7);
const pool3 = gatedAll;

function score(s, w, unratedNeutral) {
  const d = Math.max(0, Math.ceil((new Date(s.first_air_date) - new Date(NOW)) / 864e5));
  const dateScore = d <= 30 ? 1 : Math.max(0, 1 - (d - 30) / 60);
  const zhScore = (titleCn(s) ? 0.5 : 0) + (ovZh(s) ? 0.5 : 0);
  const ratingScore = s.vote_average ? Math.min(1, s.vote_average / 10) : (unratedNeutral ?? 0.5);
  return { d, dateScore, zhScore, ratingScore, pop: s.popularity || 0 };
}
function pick(cands, w, unratedNeutral, tie = "pop") {
  const rows = cands.map(c => {
    const o = score(c, w, unratedNeutral);
    const v = w.wDate * o.dateScore + w.wZh * o.zhScore + w.wRating * o.ratingScore;
    return { c, o, v };
  });
  // tie="score": current worker behavior (pure score, unstable order → insertion order on ties)
  // tie="pop": deterministic — on equal score, higher popularity wins (keeps potential hits over cold junk)
  if (tie === "pop") rows.sort((a, b) => (b.v - a.v) || (b.o.pop - a.o.pop));
  else rows.sort((a, b) => b.v - a.v);
  return rows.slice(0, 8);
}
function fmt(tag, rows) {
  console.log(`\n### ${tag}  (top 8)`);
  rows.forEach((r, i) => {
    const s = r.c;
    console.log(`  ${i + 1}. ${(s.name ?? s.title)}  pop=${String(r.o.pop).padStart(5)} d=${String(r.o.d).padStart(2)} rate=${s.vote_average ?? "-"}  score=${r.v.toFixed(3)}  ${s.first_air_date}`);
  });
}

console.log(`=== EXPANSION: 1-page vs 3-page eligible pool ===`);
console.log(`P1 pool size = ${pool1.length}  |  P3 pool size = ${pool3.length}, pop min=${Math.min(...pool3.map(c => c.popularity || 0))} max=${Math.max(...pool3.map(c => c.popularity || 0))}`);

const A0 = { wDate: 0.6, wZh: 0.1, wRating: 0.3 };
const A1 = { wDate: 0.5, wZh: 0.05, wRating: 0.45 };

fmt("P1 · A0 current", pick(pool1, A0, 0.5));
fmt("P3 · A0 current (insertion order)", pick(pool3, A0, 0.5, "score"));
fmt("P3 · A0 + pop tiebreak", pick(pool3, A0, 0.5, "pop"));
fmt("P3 · A1 + pop tiebreak", pick(pool3, A1, 0.3, "pop"));

// turnover: does tiebreak change the pick once the pool is rich?
const p3a0 = pick(pool3, A0, 0.5, "score").map(r => r.c.id);
const p3tb = pick(pool3, A0, 0.5, "pop").map(r => r.c.id);
console.log("\n=== ①+TIE ROADMAP (P3) ===");
const nameOf = (id) => pool3.find(c => c.id === id)?.name ?? id;
console.log(`insn keeps: ${p3a0.map(nameOf).join(" | ")}`);
console.log(`tie  keeps: ${p3tb.map(nameOf).join(" | ")}`);
console.log(`insn→dropped: ${p3a0.filter(id => !p3tb.includes(id)).map(nameOf).join(" | ") || "none"}`);
console.log(`tie→added:    ${p3tb.filter(id => !p3a0.includes(id)).map(nameOf).join(" | ") || "none"}`);