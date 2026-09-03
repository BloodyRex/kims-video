#!/usr/bin/env node
/**
 * TEMP probe — vote_count credibility for movie now-playing + TV ongoing.
 * Replicates the LIVE worker filters (language=zh-CN) over real TMDB pools, then
 * measures (a) vote_count distribution among CURRENT gate-passing candidates and
 * (b) how a Bayesian weighted rating R_w = (vR + mC)/(v+m) would re-rank / drop them.
 * Runs on GitHub runner (has secrets), no local token. DELETED after run.
 */
const TOKEN = process.env.TMDB_API_READ_ACCESS_TOKEN;

// ── live worker gates (read from workers-1.4.js, keep in sync) ──
const GATE = { wRating: 0.7, wPop: 0.3, floor: 6.0, popScale: 10, popCap10: 10 };
const TV = { popFloor: 30, yearCutoff: 2010 };
const hasChinese = (t) => /[\u4e00-\u9fff]/.test(t || "");
const cnFilter = (m) => hasChinese(m.title || m.name) && hasChinese(m.overview);
const ratingOk = (m) => !m.vote_average || m.vote_average >= 4;

const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });

async function pages(url, n) {
  const out = [];
  for (let i = 1; i <= n && i <= 500; i++) {
    const r = await fetch(`${url}&page=${i}&language=zh-CN`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!r.ok) { console.log(`  !! ${url} page${i}: HTTP ${r.status}`); break; }
    const j = await r.json();
    out.push(...(j.results || []));
  }
  return out;
}

function dist(arr, key) {
  const v = arr.map(x => x[key] ?? 0).sort((a, b) => a - b);
  const p = (q) => v[Math.floor(q * (v.length - 1))] ?? 0;
  const lt = (t) => v.filter(x => x < t).length;
  return {
    n: v.length,
    min: v[0], p10: p(0.1), p25: p(0.25), med: p(0.5), p75: p(0.75), max: v[v.length - 1],
    lt5: lt(5), lt10: lt(10), lt20: lt(20), lt50: lt(50), lt100: lt(100),
  };
}

// ── Bayesian weighted rating ──
function wRating(m, minV, C) {
  const R = m.vote_average || 0, v = m.vote_count || 0;
  if (v === 0) return C; // no votes → pure prior
  return (v * R + minV * C) / (v + minV);
}

// re-rank under weighted rating: how many current-pass candidates drop below gate floor
function flipUnderWeighted(cands, minV, C) {
  let flip = 0;
  for (const m of cands) {
    if (!cnPoolCount(m)) continue; // handled separately for CN relaxed path
    const pop = m.popularity || 0;
    const pop10 = Math.min(GATE.popCap10, pop / GATE.popScale);
    const cur = GATE.wRating * (m.vote_average || 0) + GATE.wPop * pop10;
    const nw = GATE.wRating * wRating(m, minV, C) + GATE.wPop * pop10;
    if (cur >= GATE.floor && nw < GATE.floor) flip++;
  }
  return flip;
}

let cnPoolIds = new Set();
function cnPoolCount(m) { return cnPoolIds.has(m.id); }

async function main() {
  console.log("TODAY(CN):", today, " 90d-ago:", daysAgo(90));

  // ═══ MOVIE: replicate recentMerged (US now_playing 4p + discover90d 3p) ═══
  const raw = [
    ...await pages("https://api.themoviedb.org/3/movie/now_playing?region=US", 4),
    ...await pages(`https://api.themoviedb.org/3/discover/movie?primary_release_date.gte=${daysAgo(90)}&primary_release_date.lte=${today}&sort_by=popularity.desc`, 3),
  ];
  const dedup = new Map();
  for (const m of raw) if (!dedup.has(m.id)) dedup.set(m.id, m);
  const movies = [...dedup.values()];

  // CN pool = discover hits (recent past-90d, mirrors cnPoolIds build) — proxy: origin countries
  // Proper worker cnPoolIds = discover past-90d entries. We approximate by those `origin_country` incl CN/HK/TW.
  cnPoolIds = new Set(movies.filter(m => (m.origin_country||[]).some(c => ["CN","HK","TW"].includes(c))).map(m => m.id));

  const movieCands = movies
    .filter(m => m.release_date && m.release_date >= daysAgo(90))
    .filter(m => cnPoolIds.has(m.id) || cnFilter(m));

  console.log("\n═══ MOVIE now-playing candidate pool (post cn/gate pre-filter) ═══");
  console.log("raw pool:", movies.length, "after 90d+cn filter:", movieCands.length);
  console.log("  CN-pool:", movieCands.filter(m => cnPoolIds.has(m.id)).length);

  // current gate survivors (no vote_count)
  const survivors = movieCands.filter(m =>
    cnPoolIds.has(m.id)
      ? (m.popularity||0) >= 8 && (!m.vote_average || m.vote_average >= 2)
      : (GATE.wRating*(m.vote_average||0) + GATE.wPop*Math.min(GATE.popCap10,(m.popularity||0)/GATE.popScale)) >= GATE.floor
  );
  console.log("current-gate (no vote_count) survivors:", survivors.length);
  const sc = survivors.filter(m => !cnPoolIds.has(m.id));
  const cnS = survivors.filter(m => cnPoolIds.has(m.id));
  console.log("\n vote_count distribution — ALL survivors:");
  console.log("  ", JSON.stringify(dist(survivors, "vote_count")));
  console.log(" vote_count — NON-CN (gateNowPlaying) survivors only:");
  console.log("  ", JSON.stringify(dist(sc, "vote_count")));
  console.log(" vote_count — CN-pool survivors only (n=" + cnS.length + "):");
  console.log("  ", JSON.stringify(dist(cnS, "vote_count")));

  // hard-minVotes impact (movie)
  console.log("\n hard minVotes would REMOVE these many NON-CN survivors:");
  for (const mv of [5, 10, 20, 50]) {
    console.log(`   minVotes=${mv}: remove ${sc.filter(m => (m.vote_count||0) < mv).length}/${sc.length}`);
  }

  // Bayesian weighting: flips below gate floor for non-CN survivors
  console.log("\n Bayesian R_w flips (non-CN survivors dropping below floor " + GATE.floor + "):");
  for (const C of [5.5, 6.0, 6.5]) {
    for (const mv of [10, 20, 50]) {
      // recompute on full movieCands as the gate does
      let flip = 0;
      for (const m of sc) {
        const pop10 = Math.min(GATE.popCap10, (m.popularity||0)/GATE.popScale);
        const nw = GATE.wRating*wRating(m,mv,C) + GATE.wPop*pop10;
        if (nw < GATE.floor) flip++;
      }
      console.log(`   m=${mv} C=${C}: ${flip}/${sc.length} drop out`);
    }
  }

  // ═══ TV: replicate ongoing pool (on_the_air 2p + trending/tv/week 3p) ═══
  console.log("\n═══ TV ongoing candidate pool ═══");
  const tvOn = await pages("https://api.themoviedb.org/3/tv/on_the_air", 2);
  const tvTr = await pages("https://api.themoviedb.org/3/trending/tv/week", 3);
  const tvDedup = new Map();
  for (const s of [...tvOn, ...tvTr]) if (!tvDedup.has(s.id)) tvDedup.set(s.id, s);
  const tvPool = [...tvDedup.values()];
  const tvCands = tvPool
    .filter(s => cnFilter(s))
    .filter(ratingOk)
    .filter(s => Number((s.first_air_date||"").slice(0,4)) >= TV.yearCutoff)
    .filter(s => (s.popularity||0) >= TV.popFloor);
  console.log("raw tv pool:", tvPool.length, "after filters:", tvCands.length);
  console.log(" vote_count distribution — TV ongoing candidates:");
  console.log("  ", JSON.stringify(dist(tvCands, "vote_count")));
  for (const mv of [5, 10, 20, 50]) {
    console.log(`   minVotes=${mv}: remove ${tvCands.filter(s => (s.vote_count||0) < mv).length}/${tvCands.length}`);
  }

  // TV: how does weighted S_qual shift the composite ranking order (top differences)
  console.log("\n TV — S_qual shift (qual score 0-100) under m=20 C=6.0 for top-pop candidate:");
  const byC = [...tvCands].sort((a,b)=>(b.popularity||0)-(a.popularity||0)).slice(0,15);
  for (const s of byC.slice(0,10)) {
    const rawQ = Math.round((s.vote_average||0)/10*100);
    const wq = Math.round(wRating(s,20,6.0)/10*100);
    console.log(`   ${s.name||s.original_name} | pop=${(s.popularity||0).toFixed(1)} R=${s.vote_average} v=${s.vote_count} | S_qual ${rawQ}->${wq}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });