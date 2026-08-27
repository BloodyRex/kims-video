// TEMPORARY diagnostic #3 — validate 方案A (air_date window catches just-concluded
// whole-season drops) and simulate the ongoing selection end-to-end, plus 方案B formula.
const B = "https://api.themoviedb.org/3";
const AUTH = { Authorization: `Bearer ${process.env.TMDB_KEY}` };
const get = async (path) => {
  const r = await fetch(`${B}${path}`, { headers: AUTH });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};

// Beijing-date helpers (mirror workers-1.4.js)
const intelToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
const intelDaysAgo = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

// Mirror workers-1.4.js scoring exactly
function intelComputeScore(item, opts, today, batchMinPop, batchMaxPop) {
  const { w_pop = 0.25, w_date = 0.55, w_qual = 0.20, hlFuture = 14, hlPast = 7 } = opts || {};
  const pop = item.popularity || 0;
  const popRange = Math.max(batchMaxPop - batchMinPop, 1);
  const S_pop = Math.min(100, Math.max(0, ((pop - batchMinPop) / popRange) * 100));
  let S_qual;
  const rawQual = item.vote_average;
  if (rawQual != null && rawQual > 0) S_qual = Math.min(100, Math.max(0, (rawQual / 10) * 100));
  else if ((item.vote_count || 0) > 0) S_qual = 50;
  else S_qual = 40;
  const dateStr = item.first_air_date;
  let S_date = 0;
  if (dateStr) {
    const now = new Date(today + "T00:00:00");
    const release = new Date(dateStr + "T00:00:00");
    const daysUntil = (release - now) / 86400000;
    const halfLife = daysUntil >= 0 ? hlFuture : hlPast;
    S_date = 100 * Math.exp(-Math.LN2 / halfLife * Math.abs(daysUntil));
  }
  const composite = (w_pop * S_pop + w_date * S_date + w_qual * S_qual) / 100;
  return { score: composite, S_pop, S_date, S_qual };
}

// S_date variant that uses last_episode air date when it's the stronger recency signal
function intelComputeScoreDateFromLastAir(item, opts, today, batchMinPop, batchMaxPop) {
  const s = intelComputeScore(item, opts, today, batchMinPop, batchMaxPop);
  const lastAir = item.last_episode_to_air?.air_date;
  if (lastAir) {
    const now = new Date(today + "T00:00:00");
    const la = new Date(lastAir + "T00:00:00");
    const days = (now - la) / 86400000;
    if (days >= 0) {
      const S_date2 = 100 * Math.exp(-Math.LN2 / 7 * days);
      const { w_date } = opts || {};
      s.S_date = Math.max(s.S_date, S_date2);
      s.score = (0.25 * s.S_pop + (w_date ?? 0.55) * s.S_date + 0.30 * s.S_qual) / 100;
    }
  }
  return s;
}

function classifyRegion(item) {
  const lang = (item.original_language || "en").toLowerCase();
  if (lang === "zh") { const c = item.origin_country || []; if (c.includes("CN")) return "cn"; if (["TW","HK","MO"].some(x => c.includes(x))) return "hmt"; return "zh"; }
  if (["ja","ko","th","vi","id"].includes(lang)) return lang;
  return "other";
}
function intelSelectDiverse(items, count, reserved, opts, today, scoreFn) {
  if (items.length <= count) return items;
  const maxPop = Math.max(...items.map(m => m.popularity || 0), 0);
  const minPop = Math.min(...items.map(m => m.popularity || 0), 0);
  const scored = items.map(m => {
    const score = scoreFn ? scoreFn(m, opts, today, minPop, maxPop).score : intelComputeScore(m, opts, today, minPop, maxPop).score;
    return { item: m, region: classifyRegion(m), score, mainGenre: (m.genre_ids || [])[0] };
  });
  scored.sort((a, b) => b.score - a.score);
  const reservedItems = {}; const pool = [];
  for (const s of scored) { const region = s.region; const slots = reserved[region] || 0; if (slots > 0 && !reservedItems[region]) reservedItems[region] = []; if (slots > 0 && reservedItems[region].length < slots) { reservedItems[region].push(s); continue; } pool.push(s); }
  const result = []; for (const r of Object.values(reservedItems)) result.push(...r);
  const genreCount = {};
  for (const s of pool) { if (result.length >= count) break; const g = s.mainGenre; if (g && (genreCount[g] || 0) >= 4) continue; genreCount[g] = (genreCount[g] || 0) + 1; result.push(s); }
  return result.sort((a, b) => b.score - a.score).slice(0, count).map(s => s.item);
}

const SCORE_OPTS_TV = { w_pop: 0.25, w_date: 0.45, w_qual: 0.30, hlFuture: 14, hlPast: 7 };

async function main() {
  const today = intelToday();
  const thirtyDaysAgo = intelDaysAgo(30);
  const weekAgo = intelDaysAgo(7);
  const hasChinese = (t) => /[一-鿿]/.test(t || "");
  const cnFilter = (s) => hasChinese(s.name) && hasChinese(s.overview);
  const intelRatingOk = (m) => !m.vote_average || m.vote_average >= 4;

  console.log("today:", today);

  // ── A1: Does discover/tv air_date window surface just-concluded drops? ──
  console.log("\n===== A1) discover/tv air_date.gte=30d window (pop desc) =====");
  const airPool = [];
  for (let p = 1; p <= 5; p++) {
    const d = await get(`/discover/tv?air_date.gte=${thirtyDaysAgo}&air_date.lte=${today}&sort_by=popularity.desc&page=${p}&language=zh-CN`);
    const results = d.results || [];
    if (!results.length) break;
    const hits207333 = results.filter(x => x.id === 207333);
    for (const h of hits207333) {
      console.log(`  FOUND 207333 in air_date discover page ${p}: pop=${h.popularity} va=${h.vote_average} first_air=${h.first_air_date} last_ep=${JSON.stringify(h.last_episode_to_air?.air_date || null)}`);
    }
    airPool.push(...results);
  }
  console.log("  airPool size:", airPool.length);

  // ── A2: Build the AUGMENTED ongoing candidate pool (on_the_air ∪ air_date window) ──
  console.log("\n===== A2) Simulate ongoing selection with AUGMENTED pool =====");
  const onAirPool = [];
  for (let p = 1; p <= 2; p++) { const d = await get(`/tv/on_the_air?page=${p}&language=zh-CN`); onAirPool.push(...(d.results || [])); }
  console.log("  onAirPool size:", onAirPool.length);

  const pool = [];
  const seenIds = new Set();
  for (const s of [...onAirPool, ...airPool]) {
    if (seenIds.has(s.id)) continue;
    seenIds.add(s.id);
    if (!hasChinese(s.name)) continue;       // zh title required
    if (!intelRatingOk(s)) continue;
    if (Number((s.first_air_date || "").slice(0, 4)) < 2010) continue;
    if ((s.popularity || 0) < 30) continue;
    pool.push(s);
  }
  console.log("  qualified ongoing pool size:", pool.length);

  // tier1 = recent: last episode in 30d OR premiered in 180d
  const hundredEightyDaysAgo = intelDaysAgo(180);
  const tier1 = pool.filter(s => {
    const lastAir = s.last_episode_to_air?.air_date || "";
    return (lastAir && lastAir >= thirtyDaysAgo) || ((s.first_air_date || "") >= hundredEightyDaysAgo);
  });
  const tier2 = pool.filter(s => !tier1.includes(s));
  console.log("  tier1 size:", tier1.length, "tier2 size:", tier2.length);
  console.log("  207333 in tier1?", tier1.some(s => s.id === 207333));

  // current scoring (first_air_date based)
  const selectedOld = [
    ...intelSelectDiverse(tier1, 10, { cn: 1, hmt: 1, jp: 1, kr: 1 }, SCORE_OPTS_TV, today, null),
    ...intelSelectDiverse(tier2, 5, { cn: 1, hmt: 1, jp: 1, kr: 1 }, SCORE_OPTS_TV, today, null),
  ].slice(0, 15);
  console.log("  [CURRENT scoring] 207333 selected?", selectedOld.some(s => s.id === 207333));
  console.log("  [CURRENT] top10 names:", selectedOld.slice(0, 10).map(s => s.name));

  // proposed scoring: use last_episode air date for S_date (recency-weighted)
  const selectedNew = [
    ...intelSelectDiverse(tier1, 10, { cn: 1, hmt: 1, jp: 1, kr: 1 }, SCORE_OPTS_TV, today, intelComputeScoreDateFromLastAir),
    ...intelSelectDiverse(tier2, 5, { cn: 1, hmt: 1, jp: 1, kr: 1 }, SCORE_OPTS_TV, today, intelComputeScoreDateFromLastAir),
  ].slice(0, 15);
  console.log("  [NEW scoring] 207333 selected?", selectedNew.some(s => s.id === 207333));
  if (selectedNew.some(s => s.id === 207333)) {
    const me = selectedNew.find(s => s.id === 207333);
    console.log("  [NEW] 207333 rank among selected:", selectedNew.indexOf(me) + 1, "/", selectedNew.length);
  }
  console.log("  [NEW] top10 names:", selectedNew.slice(0, 10).map(s => s.name));
  const me2 = selectedNew.find(s => s.id === 207333);
  if (me2) { const sc = intelComputeScoreDateFromLastAir(me2, SCORE_OPTS_TV, today, Math.min(...pool.map(m=>m.popularity||0)), Math.max(...pool.map(m=>m.popularity||0))); console.log("  207333 S_pop", sc.S_pop.toFixed(1), "S_date", sc.S_date.toFixed(1), "S_qual", sc.S_qual.toFixed(1), "score", sc.score.toFixed(4)); }

  // ── B: Hadestown composite gate simulation ──
  console.log("\n===== B) 方案B composite gate (rating-weighted) =====");
  const mov = await get("/movie/1439808?language=zh-CN");
  const pop = mov.popularity, rate = mov.vote_average;
  console.log(`  Hadestown pop=${pop.toFixed(2)} rating=${rate} votes=${mov.vote_count}`);
  const popNorm = (p, m) => Math.min(10, p / m);
  for (const [m, wR, thresh] of [[4, 0.7, 6.5], [5, 0.7, 6.5], [5, 0.75, 6.8], [5, 0.7, 6.0], [8, 0.7, 6.5]]) {
    const pn = popNorm(pop, m);
    const score = wR * rate + (1 - wR) * pn;
    console.log(`  gate pop_norm=min(10,pop/${m}), score=0.${Math.round(wR*100)}*r+0.${Math.round((1-wR)*100)}*pn >= ${thresh}: pn=${pn.toFixed(2)} score=${score.toFixed(2)} -> ${score >= thresh ? "PASS" : "FAIL"}`);
  }
}

main().catch(e => { console.error("FATAL", e.message); process.exit(1); });
