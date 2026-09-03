// Calibration harness for the Intelligence "upcoming TV" selection — A/B feasibility.
// Faithfully replicates handleIntelTV's upcoming logic (workers-1.4.js ~1735-1773) against
// the REAL TMDB discover pool, then re-scores under proposed A (weight rebalance) and
// B (popularity gate + popularity in score) configs. Run via throwaway GH workflow that
// borrows secrets.TMDB_API_READ_ACCESS_TOKEN. Prints plain stdout.
const TOKEN = process.env.TMDB_API_READ_ACCESS_TOKEN;
const base = "https://api.themoviedb.org/3";
const h = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

function today() { return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }); }
function daysAgo(n) { return new Date(Date.now() - n * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }); }

const hasZh = (t) => /[\u4e00-\u9fff]/.test(t || "");
const titleCn = (s) => hasZh(s.title ?? s.name);
const ovZh = (s) => hasZh(s.overview);
const intelRatingOk = (m) => !m.vote_average || m.vote_average >= 4;

async function discover(token, path, params) {
  const url = new URL(base + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  url.searchParams.set("language", "zh-CN");
  const r = await fetch(url, { headers: h });
  if (!r.ok) throw new Error(`TMDB ${path}: ${r.status}`);
  return (await r.json()).results || [];
}

const NOW = today();
const t905 = new Date(Date.now() + 90 * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });

// ── replicate: discoverUpcoming (future 90d, popularity.desc, page 1) + zh gate ──
const disc = await discover(TOKEN, "/discover/tv", {
  "first_air_date.gte": NOW,
  "first_air_date.lte": t905,
  "sort_by": "popularity.desc",
});
const candidates = disc
  .filter(s => s.first_air_date && s.first_air_date > NOW)
  .filter(intelRatingOk)
  .filter(s => titleCn(s) || ovZh(s)); // pipeline zh-visibility gate
// dedupe is page-1 only here (worker: 1 page); drop premieres exclusion (not topically relevant)

// ── popularity distribution of the eligible pool (for B floor) ──
candidates.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
const pops = candidates.map(c => c.popularity ? Math.round(c.popularity) : 0);
const n = pops.length;
const quant = (q) => pops.length ? pops[Math.floor(q * (pops.length - 1))] : 0;
console.log("=== UPCOMING TV ELIGIBLE POOL (future 90d, zh-visible) ===");
console.log(`total=${n}  pop min=${Math.min(...pops)}  p25=${quant(0.25)}  p50=${quant(0.5)}  p75=${quant(0.75)}  p90=${quant(0.9)}  max=${Math.max(...pops)}`);
console.log(`pop>=5: ${pops.filter(p => p >= 5).length}  >=10: ${pops.filter(p => p >= 10).length}  >=15: ${pops.filter(p => p >= 15).length}  >=20: ${pops.filter(p => p >= 20).length}  >=30: ${pops.filter(p => p >= 30).length}  >=50: ${pops.filter(p => p >= 50).length}`);
console.log("");

function score(s, wDate, wZh, wRating, unratedNeutral) {
  const d = Math.max(0, Math.ceil((new Date(s.first_air_date) - new Date(NOW)) / 864e5));
  const dateScore = d <= 30 ? 1 : Math.max(0, 1 - (d - 30) / 60);
  const zhScore = (titleCn(s) ? 0.5 : 0) + (ovZh(s) ? 0.5 : 0);
  const ratingScore = s.vote_average ? Math.min(1, s.vote_average / 10) : (unratedNeutral ?? 0.5);
  const popScore = s.popularity ? Math.min(1, s.popularity / 60) : 0.2; // popularity normalized (cap 60)
  return { d, dateScore, zhScore, ratingScore, popScore, pop: s.popularity || 0 };
}

function pick(cands, w, unratedNeutral, popGate, withPop) {
  let pool = cands;
  if (popGate != null) pool = pool.filter(c => (c.popularity || 0) >= popGate);
  return pool
    .map(c => {
      const o = score(c, w.wDate, w.wZh, w.wRating, unratedNeutral);
      let v = w.wDate * o.dateScore + w.wZh * o.zhScore + w.wRating * o.ratingScore;
      if (withPop) v += withPop * o.popScore;
      return { c, o, v };
    })
    .sort((a, b) => b.v - a.v)
    .slice(0, 8);
}

function fmt(tag, rows) {
  console.log(`\n### ${tag}  (top 8)`);
  rows.forEach((r, i) => {
    const s = r.c;
    console.log(
      `  ${i + 1}. ${(s.name || s.title)}  pop=${String(r.o.pop).padStart(5)} d=${String(r.o.d).padStart(2)} ` +
      `rate=${s.vote_average ?? "-"}  score=${r.v.toFixed(3)}  ${s.first_air_date}`
    );
  });
}

// ── A: current baseline (live defaults 0.6/0.1/0.3, unrated neutral 0.5) ──
fmt("A0 CURRENT  wDate.6/wZh.1/wRating.3  unrated=0.5", pick(candidates, { wDate: 0.6, wZh: 0.1, wRating: 0.3 }, 0.5));

// ── A variant: rebalance — raise rating, shrink date, penalize unrated more ──
fmt("A1  wDate.5/wZh.0.05/wRating.45  unrated=0.3", pick(candidates, { wDate: 0.5, wZh: 0.05, wRating: 0.45 }, 0.3));

// ── B variant 1: add popularity into score, no hard gate ──
fmt("B1  wDate.35/wPop.35/wRating.25/wZh.05  (pop normalized)  unrated=0.3",
  pick(candidates, { wDate: 0.35, wZh: 0.05, wRating: 0.25 }, 0.3, null, 0.35));

// ── B variant 2: popularity gate pop>=10 + B1 scoring ──
fmt("B2  gate pop>=10 + B1 scoring", pick(candidates, { wDate: 0.35, wZh: 0.05, wRating: 0.25 }, 0.3, 10, 0.35));

// ── B variant 3: popularity gate pop>=15 + B1 scoring (aligns w/ movie floor 15) ──
fmt("B3  gate pop>=15 + B1 scoring", pick(candidates, { wDate: 0.35, wZh: 0.05, wRating: 0.25 }, 0.3, 15, 0.35));

// ── cross-check: which of A0's picks would be dropped/bumped by B2 ──
const a0 = pick(candidates, { wDate: 0.6, wZh: 0.1, wRating: 0.3 }, 0.5).map(r => r.c.id);
const b2 = pick(candidates, { wDate: 0.35, wZh: 0.05, wRating: 0.25 }, 0.3, 10, 0.35).map(r => r.c.id);
console.log("\n=== ROADMAP (top-8 turnover) ===");
console.log(`A0 keeps: ${a0.map(id => candidates.find(c => c.id === id)?.name).join(" | ")}`);
console.log(`B2 keeps: ${b2.map(id => candidates.find(c => c.id === id)?.name).join(" | ")}`);